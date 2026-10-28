/**
 * Import a bank CSV export into the local database.
 *
 *   npm run import:csv -- --file samples/sample-transactions.csv
 *   npm run import:csv -- --file chase.csv --account "Joint Checking" --negate
 *
 * Columns are detected by header name (date / description|name|merchant /
 * amount / account). Override with --date-col, --desc-col, --amount-col,
 * --account-col. By default positive amounts are money out, as Plaid does it;
 * pass --negate for banks that export spending as negative numbers.
 * --account names the account for every row when the CSV has no account column.
 * --cardholder me|her marks a newly created account as one person's card.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { parseArgs } from "@/lib/args";
import { parseAmount, parseCsv, parseDate } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { normalizeMerchant } from "@/lib/merchant";

function findCol(headers: string[], candidates: string[], override?: string | true): number {
  if (typeof override === "string") {
    const i = headers.findIndex((h) => h.toLowerCase() === override.toLowerCase());
    if (i < 0) throw new Error(`Column ${override} not found in ${headers.join(", ")}`);
    return i;
  }
  for (const c of candidates) {
    const i = headers.findIndex((h) => h.toLowerCase().replace(/[^a-z]/g, "") === c);
    if (i >= 0) return i;
  }
  return -1;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (typeof args.file !== "string") throw new Error("--file is required");
  const rows = parseCsv(readFileSync(args.file, "utf8"));
  const headers = rows[0].map((h) => h.trim());
  const dateCol = findCol(headers, ["date", "transactiondate", "postingdate", "posteddate"], args["date-col"]);
  const descCol = findCol(headers, ["description", "name", "merchant", "payee", "memo"], args["desc-col"]);
  const amountCol = findCol(headers, ["amount", "transactionamount"], args["amount-col"]);
  const accountCol = findCol(headers, ["account", "accountname", "card"], args["account-col"]);
  if (dateCol < 0 || descCol < 0 || amountCol < 0) {
    throw new Error(`Could not find date/description/amount columns in: ${headers.join(", ")}`);
  }
  const sign = args.negate ? -1 : 1;

  const accounts = await prisma.account.findMany();
  const accountByName = new Map(accounts.map((a) => [a.name.toLowerCase(), a.id]));
  const resolveAccount = async (name: string) => {
    const key = name.toLowerCase();
    let id = accountByName.get(key);
    if (!id) {
      const cardholder = args.cardholder === "me" || args.cardholder === "her" ? args.cardholder : null;
      const created = await prisma.account.create({ data: { name, cardholder } });
      accountByName.set(key, created.id);
      id = created.id;
      console.log(`Created account "${name}"`);
    }
    return id;
  };

  let imported = 0, skipped = 0;
  for (const r of rows.slice(1)) {
    const accountName = accountCol >= 0 ? r[accountCol] : String(args.account ?? "Joint Checking");
    const date = parseDate(r[dateCol]);
    const amount = sign * parseAmount(r[amountCol]);
    const rawName = r[descCol].trim();
    const accountId = await resolveAccount(accountName);
    const externalId =
      "csv:" + createHash("sha1").update([date.toISOString(), rawName, amount, accountName].join("|")).digest("hex").slice(0, 20);
    const exists = await prisma.transaction.findUnique({ where: { externalId } });
    if (exists) { skipped++; continue; }
    await prisma.transaction.create({
      data: { externalId, source: "csv", date, amount, merchant: normalizeMerchant(rawName), rawName, accountId },
    });
    imported++;
  }
  console.log(`Imported ${imported} transactions, skipped ${skipped} already present.`);
  console.log("Next: npm run classify");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
