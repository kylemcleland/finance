/**
 * Cash movements in investment-type accounts (e.g. a Fidelity cash management
 * account that pays the mortgage). Plaid's transaction feed only covers bank
 * and card accounts; for these it has to be read through the Investments
 * product. Only real cash movements become transactions: payments out, money
 * moved in or out, and fees. Trades, dividends and interest are skipped.
 */
import type { InvestmentTransaction } from "plaid";
import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { normalizeMerchant } from "./merchant";
import { saveAccount } from "./plaid-items";
import { plaidErrorCode } from "./plaid-link";

const INVESTMENT_TYPES = new Set(["investment", "brokerage"]);
/** Money leaving the account to pay for something: sorted like any purchase. */
const PAYMENTS = new Set(["withdrawal", "send", "transfer", "request", "pending debit"]);
/** Money moving between our own accounts. */
const MOVES_IN = new Set(["deposit", "contribution"]);
const MOVES_OUT = new Set(["distribution"]);
const FEES = new Set(["account fee", "management fee", "miscellaneous fee", "transfer fee", "legal fee", "trust fee", "margin expense"]);

export type InvestmentsStatus =
  | { status: "ok"; fullSyncAt: string }
  | { status: "consent" | "not-enabled" | "unsupported" | "error"; code: string; at: string };

export function hasInvestmentAccounts(accounts: Array<{ type: string | null }>): boolean {
  return accounts.some((a) => a.type != null && INVESTMENT_TYPES.has(a.type));
}

/** Which investment transactions to import, and the Plaid category hint to give them. */
export function cashMovement(t: Pick<InvestmentTransaction, "type" | "subtype" | "amount">): { primary: string | null; detailed: string | null } | null {
  if (t.type === "buy" || t.type === "sell" || t.type === "cancel" || !t.amount) return null;
  const sub = String(t.subtype);
  if (FEES.has(sub)) return { primary: "BANK_FEES", detailed: null };
  if (MOVES_IN.has(sub)) return { primary: "TRANSFER_IN", detailed: "TRANSFER_IN_ACCOUNT_TRANSFER" };
  if (MOVES_OUT.has(sub)) return { primary: "TRANSFER_OUT", detailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" };
  if (PAYMENTS.has(sub)) return { primary: null, detailed: null }; // the description decides (a mortgage, a card payment, a transfer)
  return null;
}

const ymd = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Import cash movements for one Item. The first run covers two years; later
 * runs the last 45 days (rows already stored are skipped). Returns the new
 * status to record; never throws for Plaid errors.
 */
export async function syncInvestmentCash(
  item: { id: string; accessToken: string },
  previous: InvestmentsStatus | undefined,
  plaid: Pick<ReturnType<typeof plaidClient>, "investmentsTransactionsGet"> = plaidClient(),
  now = new Date(),
): Promise<{ status: InvestmentsStatus; added: number }> {
  const full = previous?.status !== "ok";
  const start = new Date(now.getTime() - (full ? 730 : 45) * 86400_000);
  let added = 0;
  try {
    let offset = 0;
    for (;;) {
      const res = await plaid.investmentsTransactionsGet({
        access_token: item.accessToken, start_date: ymd(start), end_date: ymd(now), options: { count: 500, offset },
      });
      const d = res.data;
      for (const a of d.accounts) await saveAccount(a, item.id);
      const accounts = await prisma.account.findMany({ where: { itemId: item.id } });
      const byPlaidId = new Map(accounts.map((a) => [a.plaidAccountId!, a.id]));
      const rows = d.investment_transactions.flatMap((t) => {
        const kind = cashMovement(t);
        const accountId = byPlaidId.get(t.account_id);
        if (!kind || !accountId) return [];
        return [{
          externalId: `inv:${t.investment_transaction_id}`,
          source: "plaid",
          date: new Date(`${t.date}T00:00:00Z`),
          amount: t.amount, // positive = cash out, as for bank transactions
          merchant: normalizeMerchant(t.name),
          rawName: t.name,
          originalDescription: t.name,
          plaidCategoryPrimary: kind.primary,
          plaidCategoryDetailed: kind.detailed,
          pending: String(t.subtype) === "pending debit",
          accountId,
        }];
      });
      if (rows.length) added += (await prisma.transaction.createMany({ data: rows, skipDuplicates: true })).count;
      offset += d.investment_transactions.length;
      if (!d.investment_transactions.length || offset >= d.total_investment_transactions) break;
    }
    return { status: { status: "ok", fullSyncAt: full ? now.toISOString() : (previous as { fullSyncAt: string }).fullSyncAt }, added };
  } catch (e) {
    const code = plaidErrorCode(e);
    const at = now.toISOString();
    if (code === "ADDITIONAL_CONSENT_REQUIRED" || code === "ITEM_LOGIN_REQUIRED") return { status: { status: "consent", code, at }, added };
    if (code === "INVALID_PRODUCT" || code === "PRODUCT_NOT_ENABLED") return { status: { status: "not-enabled", code, at }, added };
    if (code === "PRODUCTS_NOT_SUPPORTED" || code === "NO_INVESTMENT_ACCOUNTS" || code === "NO_INVESTMENT_AUTH_ACCOUNTS") return { status: { status: "unsupported", code, at }, added };
    return { status: { status: "error", code, at }, added };
  }
}
