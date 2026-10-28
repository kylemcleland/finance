import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";
import { HOUSEHOLD_NOTES } from "@/config/household";
import { env } from "./env";

export const CLAUDE_MODEL = "claude-opus-5-5";

const ClassificationSchema = z.object({
  category: z.enum(CATEGORIES),
  share_me: z
    .number()
    .int()
    .min(0)
    .max(100)
    .describe("Percent of this expense allocated to 'me'. 50 means split evenly."),
  needs_review: z
    .boolean()
    .describe("True when the split is a guess a human should confirm."),
  reason: z.string().describe("One short sentence."),
});

export type ClaudeClassification = {
  category: Category;
  shareMe: number;
  needsReview: boolean;
  reason: string;
  model: string;
};

export type ClassifyInput = {
  merchant: string;
  rawName: string;
  amount: number;
  plaidCategoryPrimary?: string | null;
  plaidCategoryDetailed?: string | null;
  account?: string | null;
  date?: string | null;
};

export type ClaudeClassifier = (input: ClassifyInput) => Promise<ClaudeClassification | null>;

/** Used when ANTHROPIC_API_KEY is not set: never guesses, so the caller falls through to review. */
export const stubClassifier: ClaudeClassifier = async () => null;

let client: Anthropic | undefined;

export const liveClassifier: ClaudeClassifier = async (input) => {
  client ??= new Anthropic();
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
            plaid_category: input.plaidCategoryDetailed ?? input.plaidCategoryPrimary ?? null,
            account: input.account ?? null,
            date: input.date ?? null,
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
    needsReview: out.needs_review,
    reason: out.reason,
    model: response.model,
  };
};

export function defaultClassifier(): ClaudeClassifier {
  return env.hasAnthropic ? liveClassifier : stubClassifier;
}
