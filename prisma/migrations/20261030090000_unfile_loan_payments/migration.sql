-- The earlier card-payment text match also caught mortgage and car-loan
-- payments that Plaid had labelled correctly (e.g. "CITI MORTGAGE PAYMENT"),
-- filing them as Transfer. The classifier now trusts Plaid's label there;
-- send those rows back to be sorted again.
UPDATE "Transaction"
SET "category" = NULL, "shareMe" = NULL, "classificationSource" = NULL,
    "needsReview" = false, "note" = NULL, "classifiedAt" = NULL
WHERE "note" = 'Credit card payment'
  AND "classificationSource" = 'keyword'
  AND "plaidCategoryDetailed" IS NOT NULL
  AND "plaidCategoryDetailed" NOT LIKE 'TRANSFER%'
  AND "plaidCategoryDetailed" <> 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT';
