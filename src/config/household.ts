/** Display names. Internally accounts and splits use the codes "me" and "her". */
export const PEOPLE = { me: "Kyle", her: "Jackie" } as const;

/**
 * Plain-language context handed to Claude when it has to classify a merchant
 * nobody has seen before. Edit this to match your household. Keep it short:
 * it is sent on every uncached merchant.
 */
export const HOUSEHOLD_NOTES = `
Married couple sharing a home: "me" is Kyle, "her" is Jackie.
Shared by default: groceries, rent/mortgage, utilities, household supplies,
restaurants we go to together, streaming subscriptions, travel together.
Personal: one person's hobby, clothing, personal care, individual
subscriptions, or lunches on a workday.
Splits use five steps: 100 (all Kyle), 75 (mostly Kyle), 50 (shared),
25 (mostly Jackie), 0 (all Jackie).
If a merchant could plausibly be either person's and nothing suggests whose,
say 50 and mark it for review.
`.trim();
