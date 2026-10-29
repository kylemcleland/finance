import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES, type Category, type Split } from "./categories";
import { HOUSEHOLD_NOTES, PEOPLE } from "@/config/household";
import { env } from "./env";

export const CLAUDE_MODEL = "claude-opus-5-5";

const ClassificationSchema = z.object({
  category: z.enum(CATEGORIES),
  share_me: z
    .union([z.literal(0), z.literal(25), z.literal(50), z.literal(75), z.literal(100)])
    .describe(`Percent of this purchase that is ${PEOPLE.me}'s. 100 all ${PEOPLE.me}, 75 mostly ${PEOPLE.me}, 50 shared, 25 mostly ${PEOPLE.her}, 0 all ${PEOPLE.her}.`),
  merchant_varies: z
    .boolean()
    .describe("True when purchases at this merchant could be for either person or the household (Target, Amazon), so the split must be decided per purchase."),
  needs_review: z.boolean().describe("True when the split is a guess a human should confirm."),
  reason: z.string().describe("One short sentence."),
});

export type ClaudeClassification = {
  category: Category;
  shareMe: Split;
  merchantVaries: boolean;
  needsReview: boolean;
  reason: string;
  model: string;
};

export type Cardholder = "me" | "her" | null | undefined;

export type ClassifyInput = {
  merchant: string;
  rawName: string;
  amount: number;
  plaidCategoryPrimary?: string | null;
  plaidCategoryDetailed?: string | null;
  account?: string | null;
  /** Who carries the card that was swiped, when known. A hint, not a verdict. */
  cardholder?: Cardholder;
  date?: string | null;
};

export type ClaudeClassifier = (input: ClassifyInput) => Promise<ClaudeClassification | null>;

/** Used when ANTHROPIC_API_KEY is not set: never guesses, so the caller falls through to review. */
export const stubClassifier: ClaudeClassifier = async () => null;

let client: Anthropic | undefined;

export const liveClassifier: ClaudeClassifier = async (input) => {
  // Bounded so a slow call cannot run a Netlify function past its time limit.
  client ??= new Anthropic({ timeout: 15_000, maxRetries: 1 });
  const response = await client.messages.parse({
    model: CLAUDE_MODEL,
    max_tokens: 1024,
    output_config: { effort: "low", format: zodOutputFormat(ClassificationSchema) },
    system: [
      "You assign a household budget category and a cost split to one bank transaction.",
      `Categories: ${CATEGORIES.join(", ")}.`,
      "Household notes:",
      HOUSEHOLD_NOTES,
    ].join("\n"),
    messages: [
      {
        role: "user",
        content: JSON.stringify(
          {
            merchant: input.merchant,
            bank_description: input.rawName,
            amount_usd: input.amount,
            date: input.date ?? null,
            plaid_category: input.plaidCategoryDetailed ?? input.plaidCategoryPrimary ?? null,
            account: input.account ?? null,
            card_swiped_by: input.cardholder ? PEOPLE[input.cardholder] : "unknown or joint",
          },
          null,
          2,
        ),
      },
    ],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) return null;
  const out = response.parsed_output;
  return {
    category: out.category,
    shareMe: out.share_me,
    merchantVaries: out.merchant_varies,
    needsReview: out.needs_review,
    reason: out.reason,
    model: response.model,
  };
};

export function defaultClassifier(): ClaudeClassifier {
  return env.hasAnthropic ? liveClassifier : stubClassifier;
}
