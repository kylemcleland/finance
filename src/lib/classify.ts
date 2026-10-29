import {
  CATEGORY_DEFAULT_SHARE_ME,
  PERSONAL_BY_CARDHOLDER,
  categoryFromKeywords,
  categoryFromPlaid,
  isAtmWithdrawal,
  isCreditCardPayment,
  isCategory,
  snapSplit,
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

/** shareMe null = varies: category is known, the split is decided per purchase. */
export type Rule = { pattern: string; exact: boolean; category: string; shareMe: number | null };
export type Cached = { category: string; shareMe: number | null; reason?: string | null };

export function matchRule(merchant: string, rules: Rule[]): Rule | undefined {
  const m = merchant.toLowerCase();
  // Exact rules win, then the longest substring match (most specific).
  const exact = rules.find((r) => r.exact && r.pattern.toLowerCase() === m);
  if (exact) return exact;
  return rules
    .filter((r) => !r.exact && m.includes(r.pattern.toLowerCase()))
    .sort((a, b) => b.pattern.length - a.pattern.length)[0];
}

/** The cardholder's own share when we lean on who swiped: all theirs. */
const hintShare = (input: ClassifyInput): number | null =>
  input.cardholder === "me" ? 100 : input.cardholder === "her" ? 0 : null;

/**
 * Layer 1 (rules) and layer 2 (Plaid or keyword category, plus the cardholder
 * hint) are synchronous and free. Returns null when only Claude or a human
 * can decide the split. A "varies" rule or cache entry also returns null for
 * the split so Claude sees the individual purchase; the category is reused.
 */
export function classifyLocally(
  input: ClassifyInput,
  rules: Rule[],
  cache?: Cached | null,
): Classification | null {
  if (isAtmWithdrawal(input)) {
    const source: ClassificationSource = input.plaidCategoryDetailed === "TRANSFER_OUT_WITHDRAWAL" ? "plaid" : "keyword";
    return { category: "Transfer", shareMe: 50, source, needsReview: false, note: "ATM withdrawal" };
  }
  if (isCreditCardPayment(input)) {
    const source: ClassificationSource = input.plaidCategoryDetailed === "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT" ? "plaid" : "keyword";
    return { category: "Transfer", shareMe: 50, source, needsReview: false, note: "Credit card payment" };
  }
  const rule = matchRule(input.merchant, rules);
  if (rule && isCategory(rule.category) && rule.shareMe !== null) {
    return { category: rule.category, shareMe: rule.shareMe, source: "rule", needsReview: false };
  }
  // A "varies" rule (no split) means every purchase is judged on its own, so a
  // cached per-merchant split must not settle it.
  if (!rule && cache && isCategory(cache.category) && cache.shareMe !== null) {
    return { category: cache.category, shareMe: cache.shareMe, source: "claude", needsReview: false, note: cache.reason ?? undefined };
  }
  const fixedCategory = rule && isCategory(rule.category) ? rule.category : cache && isCategory(cache.category) ? cache.category : null;
  if (fixedCategory) return null; // varies: split per purchase

  const fromPlaid = categoryFromPlaid(input.plaidCategoryPrimary, input.plaidCategoryDetailed);
  const category = fromPlaid ?? categoryFromKeywords(input.merchant);
  if (!category) return null;
  const source: ClassificationSource = fromPlaid ? "plaid" : "keyword";

  const defaultShare = CATEGORY_DEFAULT_SHARE_ME[category];
  if (defaultShare !== null) return { category, shareMe: defaultShare, source, needsReview: false };

  // Personal category and we know who swiped: theirs, and safe enough for
  // coffee or a haircut. Shopping and Other still get a review.
  const hint = hintShare(input);
  if (hint !== null) return { category, shareMe: hint, source, needsReview: !PERSONAL_BY_CARDHOLDER.has(category) };
  return null;
}

/** The category we can name even when nobody can decide the split. */
export function knownCategory(input: ClassifyInput, rules: Rule[], cache?: Cached | null): Category | null {
  const rule = matchRule(input.merchant, rules);
  if (rule && isCategory(rule.category)) return rule.category;
  if (cache && isCategory(cache.category)) return cache.category;
  return categoryFromPlaid(input.plaidCategoryPrimary, input.plaidCategoryDetailed) ?? categoryFromKeywords(input.merchant);
}

/** Fallback when every layer declines: lean on the cardholder or split evenly, and flag for review. */
export function fallbackClassification(input: ClassifyInput, rules: Rule[] = [], cache?: Cached | null): Classification {
  const category = knownCategory(input, rules, cache) ?? "Other";
  return { category, shareMe: hintShare(input) ?? 50, source: "unclassified", needsReview: true };
}

export type ClassifyOutcome = {
  result: Classification;
  /** Present when Claude answered, so the caller can cache it. shareMe null = merchant varies. */
  fromClaude?: { category: Category; shareMe: number | null; reason: string; model: string };
};

export async function classify(
  input: ClassifyInput,
  rules: Rule[],
  cache: Cached | null | undefined,
  claude: ClaudeClassifier,
): Promise<ClassifyOutcome> {
  const local = classifyLocally(input, rules, cache);
  if (local) return { result: local };

  const answer = await claude(input);
  if (answer) {
    const shareMe = snapSplit(answer.shareMe);
    // Transfer and Income drop a row out of spending entirely; a person should
    // confirm that (it is also what a bank description written to steer
    // Claude would aim for).
    const leavesSpending = answer.category === "Transfer" || answer.category === "Income";
    return {
      result: { category: answer.category, shareMe, source: "claude", needsReview: answer.needsReview || answer.merchantVaries || leavesSpending, note: answer.reason },
      fromClaude: { category: answer.category, shareMe: answer.merchantVaries ? null : shareMe, reason: answer.reason, model: answer.model },
    };
  }
  return { result: fallbackClassification(input, rules, cache) };
}
