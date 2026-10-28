/**
 * Plain-language context handed to Claude when it has to classify a merchant
 * nobody has seen before. Edit this to match your household. Keep it short:
 * it is sent on every uncached merchant.
 */
export const HOUSEHOLD_NOTES = `
Two adults sharing a home: "me" (Kyle) and "her" (his wife).
Shared by default: groceries, rent/mortgage, utilities, household supplies,
restaurants we go to together, streaming subscriptions, travel together.
Lean "me": things that are clearly one person's hobby, clothing, personal care,
individual subscriptions, or lunches on a workday.
If a merchant could plausibly be either person's and nothing suggests whose,
say 50/50 and mark it for review.
`.trim();
