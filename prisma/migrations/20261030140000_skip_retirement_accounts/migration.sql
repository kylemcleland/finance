-- Remember each account's Plaid subtype (401k, cash management, ...).
ALTER TABLE "Account" ADD COLUMN "subtype" TEXT;

-- Retirement accounts (a workplace 401(k)) were read as if they were cash
-- accounts, importing fund fees, internal gain/loss entries and payroll
-- contributions, some of them twice. None of that is household spending:
-- remove what was imported from them. The import now skips retirement
-- accounts by subtype; their names are the only clue for rows already in.
DELETE FROM "Transaction" t
USING "Account" a
WHERE t."accountId" = a.id
  AND t."externalId" LIKE 'inv:%'
  AND a.name ~* '(401 ?\(?k\)?|403 ?\(?b\)?|\m457\M|\mira\M|roth|pension|retirement|\mtsp\M|thrift savings|keogh)';
