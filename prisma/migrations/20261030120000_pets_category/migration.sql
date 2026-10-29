-- New Pets category: re-file pet stores, vets and pet services that were
-- filed under Shopping, Health or Other (not ones decided by hand), and fix
-- Claude's cached answers for those merchants, which otherwise take priority
-- over Plaid's category. Mirrors the Pets keywords in src/lib/categories.ts.
UPDATE "Transaction"
SET "category" = 'Pets',
    "shareMe" = CASE WHEN "needsReview" THEN 50 ELSE COALESCE("shareMe", 50) END,
    "needsReview" = false,
    "classifiedAt" = NOW()
WHERE "classificationSource" IS DISTINCT FROM 'manual'
  AND ("category" IS NULL OR "category" IN ('Shopping', 'Health', 'Other'))
  AND (
    "plaidCategoryDetailed" IN ('GENERAL_MERCHANDISE_PET_SUPPLIES', 'MEDICAL_VETERINARY_SERVICES')
    OR "merchant" ~* 'petco|petsmart|pet food express|chewy|veterinar|\mvet\M|banfield|vca animal|bluepearl|^rover\M|wag labs|wagwalking|barkbox|the farmer s dog|ollie pets'
  );

UPDATE "MerchantCache"
SET "category" = 'Pets'
WHERE "category" IN ('Shopping', 'Health', 'Other')
  AND "merchant" ~* 'petco|petsmart|pet food express|chewy|veterinar|\mvet\M|banfield|vca animal|bluepearl|^rover\M|wag labs|wagwalking|barkbox|the farmer s dog|ollie pets';
