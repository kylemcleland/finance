-- Credit card bill payments are not spending (the purchases on the card
-- are): re-file ones synced before the classifier learned this
-- (src/lib/categories.ts isCreditCardPayment) as Transfer, which the
-- dashboard leaves out. Unlike the ATM migration this includes rows decided
-- by hand: a card payment only had a split because the review queue asked.
UPDATE "Transaction"
SET "category" = 'Transfer',
    "shareMe" = 50,
    "needsReview" = false,
    "note" = 'Credit card payment',
    "classificationSource" = CASE WHEN "plaidCategoryDetailed" = 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT' THEN 'plaid' ELSE 'keyword' END,
    "classifiedAt" = NOW()
WHERE "category" IS DISTINCT FROM 'Transfer'
  AND (
    "plaidCategoryDetailed" = 'LOAN_PAYMENTS_CREDIT_CARD_PAYMENT'
    OR ("rawName" || ' ' || "merchant") ~* 'payment thank you|credit ?card (payment|pmt|autopay)|crd (autopay|pmt|payment|epay)|card (payment|pmt)\M|\m(amex|american express|discover|capital one|capitalone|citi|citibank|barclays|barclaycard|apple ?card|applecard|synchrony|chase card|chase credit|visa|mastercard)\M.*\m(e-?payment|epay|pmt|payment|autopay|auto pay)\M'
  );
