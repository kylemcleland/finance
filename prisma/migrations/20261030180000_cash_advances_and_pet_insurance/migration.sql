-- Cash taken out abroad arrives as a "cash advance" (Fidelity: "CASH ADVANCE
-- Aerop. ..."): file it like any ATM withdrawal, as Transfer. Pet insurance
-- (Healthy Paws, Trupanion, ...) goes under Pets rather than Plaid's
-- insurance label. Decisions made by hand are left alone.
-- Mirrors isAtmWithdrawal and the Pets keywords in src/lib/categories.ts.
UPDATE "Transaction"
SET "category" = 'Transfer', "shareMe" = 50, "needsReview" = false, "note" = 'ATM withdrawal',
    "classificationSource" = CASE WHEN "plaidCategoryDetailed" = 'LOAN_PAYMENTS_CASH_ADVANCES' THEN 'plaid' ELSE 'keyword' END,
    "classifiedAt" = NOW()
WHERE "classificationSource" IS DISTINCT FROM 'manual'
  AND ("plaidCategoryDetailed" = 'LOAN_PAYMENTS_CASH_ADVANCES' OR "rawName" ~* '^cash advance\M');

UPDATE "Transaction"
SET "category" = 'Pets', "shareMe" = 50, "needsReview" = false, "classificationSource" = 'keyword', "classifiedAt" = NOW()
WHERE "classificationSource" IS DISTINCT FROM 'manual'
  AND "category" IS DISTINCT FROM 'Pets'
  AND "merchant" ~* 'healthy paws|trupanion|pets best|embrace pet|lemonade pet|figo pet|nationwide pet|aspca pet';
