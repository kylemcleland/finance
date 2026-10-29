-- ATM withdrawals are not spending: re-file ones synced before the classifier
-- learned this (src/lib/categories.ts isAtmWithdrawal) as Transfer, which the
-- dashboard leaves out. Manual decisions are left alone. ATM fees stay Fees.
UPDATE "Transaction"
SET "category" = 'Transfer',
    "shareMe" = 50,
    "needsReview" = false,
    "note" = 'ATM withdrawal',
    "classificationSource" = CASE WHEN "plaidCategoryDetailed" = 'TRANSFER_OUT_WITHDRAWAL' THEN 'plaid' ELSE 'keyword' END,
    "classifiedAt" = NOW()
WHERE "classificationSource" IS DISTINCT FROM 'manual'
  AND (
    "plaidCategoryDetailed" = 'TRANSFER_OUT_WITHDRAWAL'
    OR (
      COALESCE("plaidCategoryDetailed", '') NOT LIKE 'BANK_FEES%'
      AND ("rawName" || ' ' || "merchant") ~* '\matm\M|cash withdrawal'
      AND ("rawName" || ' ' || "merchant") !~* '\matm\M.*\m(fee|surcharge)\M|\m(fee|surcharge)\M.*\matm\M'
    )
  );
