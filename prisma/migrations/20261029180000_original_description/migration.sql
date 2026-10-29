-- The bank's own transaction description, verbatim (Plaid's
-- include_original_description), shown on review to identify odd charges.
ALTER TABLE "Transaction" ADD COLUMN "originalDescription" TEXT;

-- Re-pull history once so rows synced before this get their description.
-- Sync inserts with skipDuplicates and only fills an empty
-- originalDescription on rows it already has, so categories, splits and
-- decisions are untouched. It resumes across Sync now taps and morning runs.
UPDATE "PlaidItem" SET "cursor" = NULL;
