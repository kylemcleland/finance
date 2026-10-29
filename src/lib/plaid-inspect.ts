/**
 * What Plaid actually returns for one bank link, read fresh and saved
 * nowhere: for tracking down an account whose activity never shows up.
 */
import { plaidClient } from "./plaid";
import { plaidErrorCode } from "./plaid-link";

type Sample = { date: string; name: string; amount: number; label: string };
export type AccountReport = {
  plaidAccountId: string;
  name: string;
  mask: string | null;
  type: string;
  subtype: string | null;
  balance: number | null;
  bank: { count: number; latest: Sample[] };
  investments: { count: number; kinds: Record<string, number>; latest: Sample[] };
};
export type InspectReport = {
  accounts: AccountReport[];
  bank: { status: string | null; pages: number; complete: boolean; error?: string };
  investments: { total: number; error?: string };
};

const KEEP = 15;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

function add(list: Sample[], s: Sample) {
  list.push(s);
  list.sort((a, b) => b.date.localeCompare(a.date));
  if (list.length > KEEP) list.length = KEEP;
}

export async function inspectItem(
  accessToken: string,
  opts: { deadline?: number; plaid?: Pick<ReturnType<typeof plaidClient>, "transactionsSync" | "investmentsTransactionsGet">; now?: Date } = {},
): Promise<InspectReport> {
  const plaid = opts.plaid ?? plaidClient();
  const now = opts.now ?? new Date();
  const deadline = opts.deadline ?? Date.now() + 20_000;
  const byId = new Map<string, AccountReport>();
  const account = (a: { account_id: string; name: string; mask?: string | null; type: string; subtype?: string | null; balances?: { current?: number | null } }) => {
    let r = byId.get(a.account_id);
    if (!r) {
      r = {
        plaidAccountId: a.account_id, name: a.name, mask: a.mask ?? null, type: String(a.type), subtype: a.subtype ? String(a.subtype) : null,
        balance: a.balances?.current ?? null, bank: { count: 0, latest: [] }, investments: { count: 0, kinds: {}, latest: [] },
      };
      byId.set(a.account_id, r);
    }
    return r;
  };
  const report: InspectReport = { accounts: [], bank: { status: null, pages: 0, complete: false }, investments: { total: 0 } };

  // The whole bank feed from the start (no cursor), the way a first sync sees it.
  try {
    let cursor: string | undefined;
    for (;;) {
      if (Date.now() > deadline) break;
      const { data: d } = await plaid.transactionsSync({ access_token: accessToken, cursor, count: 500, options: { include_original_description: true } });
      report.bank.pages++;
      report.bank.status = d.transactions_update_status ? String(d.transactions_update_status) : null;
      for (const a of d.accounts) account(a);
      for (const t of d.added) {
        const r = byId.get(t.account_id);
        if (!r) continue;
        r.bank.count++;
        add(r.bank.latest, {
          date: t.date, name: t.original_description ?? t.name, amount: t.amount,
          label: t.personal_finance_category?.detailed ?? t.personal_finance_category?.primary ?? "",
        });
      }
      cursor = d.next_cursor;
      if (!d.has_more) { report.bank.complete = true; break; }
    }
  } catch (e) {
    report.bank.error = plaidErrorCode(e);
  }

  // The investment feed for the same two years the importer reads.
  try {
    let offset = 0;
    for (;;) {
      if (Date.now() > deadline) break;
      const { data: d } = await plaid.investmentsTransactionsGet({
        access_token: accessToken, start_date: ymd(new Date(now.getTime() - 730 * 86400_000)), end_date: ymd(now), options: { count: 500, offset },
      });
      for (const a of d.accounts) account(a);
      report.investments.total = d.total_investment_transactions;
      for (const t of d.investment_transactions) {
        const r = byId.get(t.account_id);
        if (!r) continue;
        const kind = `${t.type} / ${t.subtype}`;
        r.investments.count++;
        r.investments.kinds[kind] = (r.investments.kinds[kind] ?? 0) + 1;
        add(r.investments.latest, { date: t.date, name: t.name, amount: t.amount, label: kind });
      }
      offset += d.investment_transactions.length;
      if (!d.investment_transactions.length || offset >= d.total_investment_transactions) break;
    }
  } catch (e) {
    report.investments.error = plaidErrorCode(e);
  }

  report.accounts = [...byId.values()];
  return report;
}
