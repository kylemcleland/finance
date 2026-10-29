-- One-off purchases (a wedding deposit, a couch) still count as spending but
-- are left out of pace and yearly estimates. A merchant rule can mark every
-- purchase at a merchant as one-off.
ALTER TABLE "Transaction" ADD COLUMN "oneOff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "MerchantRule" ADD COLUMN "oneOff" BOOLEAN NOT NULL DEFAULT false;
