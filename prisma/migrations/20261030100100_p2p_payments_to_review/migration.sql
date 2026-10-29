-- Venmo, Zelle, PayPal and Cash App payments were filed as Transfer and left
-- out of spending. Paying someone else that way (rent, a cleaner, a friend's
-- share of dinner) is spending, so send outgoing ones to review. Money
-- received, and payments between Kyle and Jackie (their names in the
-- description), stay transfers. Decisions made by hand are left alone.
-- Mirrors isPeerPayment / namesHousehold in src/lib/classify.ts.
UPDATE "Transaction"
SET "category" = 'Other',
    "shareMe" = 50,
    "needsReview" = true,
    "classificationSource" = 'keyword',
    "note" = 'Venmo/Zelle payment: what was it for?',
    "classifiedAt" = NOW()
WHERE "amount" > 0
  AND "category" = 'Transfer'
  AND "classificationSource" IS DISTINCT FROM 'manual'
  AND (COALESCE("originalDescription", '') || ' ' || "rawName" || ' ' || "merchant") ~* '\m(venmo|zelle|paypal|cash app|square cash)\M'
  AND (COALESCE("originalDescription", '') || ' ' || "rawName" || ' ' || "merchant") !~* '\m(kyle|mcleland|jackie|jackelin|salinas)\M';
