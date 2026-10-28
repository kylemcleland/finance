import {
  CATEGORY_DEFAULT_SHARE_ME,
  categoryFromKeywords,
  categoryFromPlaid,
  isCategory,
  type Category,
} from "./categories";
import type { ClassifyInput, ClaudeClassifier } from "./claude";

export type ClassificationSource = "rule" | "plaid" | "keyword" | "claude" | "manual" | "unclassified";

export type Classification = {
  category: Category;
  shareMe: number;
  source: ClassificationSource;
  needsReview: boolean;
  note?: string;
};

export type Rule = { pattern: string; exact: boolean; category: string; shareMe: number };
export type Cached = { category: string; shareMe: number; reason?: string | null };

export function matchRule(merchant: string, rules: Rule[]): Rule | undefined {
  const m = merchant.toLowerCase();
  // Exact rules win, then the longest substring match (most specific).
  const exact = rules.find((r) => r.exact && r.pattern.toLowerCase() === m);
  if (exact) return exact;
  return rules
    .filter((r) => !r.exact && m.includes(r.pattern.toLowerCase()))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
}

/**
 * Layer 1 (rules) and layer 2 (Plaid category + account owner) are synchronous
 * and free. Returns null when only Claude or a human can decide the split.
 */
export function classifyLocally(
  input: ClassifyInput,
  rules: Rule[],
  cache?: Cached | null,
): Classification | null {
  const rule = matchRule(input.merchant, rules);
  if (rule && isCategory(rule.category)) {
    return { category: rule.category, shareMe: rule.shareMe, source: "rule", needsReview: false };
  }

  if (cache && isCategory(cache.category)) {
    return {
      category: cache.category,
      shareMe: cache.shareMe,
      source: "claude",
      needsReview: false,
      note: cache.reason ?? undefined,
    };
  }

  const fromPlaid = categoryFromPlaid(input.plaidCategoryPrimary, input.plaidCategoryDetailed);
  const category = fromPlaid ?? categoryFromKeywords(input.merchant);
  if (!category) return null;
  const source: ClassificationSource = fromPlaid ? "plaid" : "keyword";

  const defaultShare = CATEGORY_DEFAULT_SHARE_ME[category];
  if (defaultShare !== null) {
    return { category, shareMe: defaultShare, source, needsReview: false };
  }
  // Personal category: the account that paid tells us whose it is.
  if (input.accountOwner === "me") return { category, shareMe: 100, source, needsReview: false };
  if (input.accountOwner === "her") return { category, shareMe: 0, source, needsReview: false };
  return null;
}

/** Fallback when every layer declines: split evenly and flag for review. */
export function fallbackClassification(input: ClassifyInput): Classification {
  const category =
    categoryFromPlaid(input.plaidCategoryPrimary, input.plaidCategoryDetailed) ??
    categoryFromKeywords(input.merchant) ??
    "Other";
  return { category, shareMe: 50, source: "unclassified", needsReview: true };
}

export async function classify(
  input: ClassifyInput,
  rules: Rule[],
  cache: Cached | null | undefined,
  claude: ClaudeClassifier,
): Promise<{ result: Classification; fromClaude?: Cached & { model: string } }> {
  const local = classifyLocally(input, rules, cache);
  if (local) return { result: local };

  const answer = await claude(input);
  if (answer) {
    return {
      result: {
        category: answer.category,
        shareMe: answer.shareMe,
        source: "claude",
        needsReview: answer.needsReview,
        note: answer.reason,
      },
      fromClaude: { category: answer.category, shareMe: answer.shareMe, reason: answer.reason, model: answer.model },
    };
  }
  return { result: fallbackClassification(input) };
}
