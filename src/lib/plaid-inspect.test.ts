import { describe, expect, it } from "vitest";
import { inspectItem } from "./plaid-inspect";

const cash = { account_id: "c", name: "Cash Management", mask: "8557", type: "depository", subtype: "cash management", balances: { current: 900 } };
const k401 = { account_id: "k", name: "401(K) Plan", mask: "7288", type: "investment", subtype: "401k", balances: { current: 1 } };

describe("inspectItem", () => {
  it("counts each feed per account and keeps the latest rows", async () => {
    const pages = [
      { accounts: [cash, k401], added: [{ account_id: "c", date: "2026-10-01", name: "MORTGAGE", amount: 3000, personal_finance_category: { primary: "LOAN_PAYMENTS", detailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT" } }], has_more: true, next_cursor: "1", transactions_update_status: "HISTORICAL_UPDATE_COMPLETE" },
      { accounts: [cash, k401], added: [], has_more: false, next_cursor: "2", transactions_update_status: "HISTORICAL_UPDATE_COMPLETE" },
    ];
    const plaid = {
      transactionsSync: async () => ({ data: pages.shift() }),
      investmentsTransactionsGet: async () => ({
        data: {
          accounts: [cash, k401], total_investment_transactions: 2,
          investment_transactions: [
            { account_id: "k", date: "2026-08-03", name: "CONTRIBUTION", amount: -500, type: "cash", subtype: "contribution" },
            { account_id: "c", date: "2026-09-01", name: "BILL PAY", amount: 3000, type: "cash", subtype: "loan payment" },
          ],
        },
      }),
    } as never;
    const r = await inspectItem("token", { plaid, now: new Date("2026-10-29T00:00:00Z") });
    expect(r.bank).toEqual({ status: "HISTORICAL_UPDATE_COMPLETE", pages: 2, complete: true });
    const c = r.accounts.find((a) => a.mask === "8557")!;
    expect(c.bank.count).toBe(1);
    expect(c.bank.latest[0].label).toBe("LOAN_PAYMENTS_MORTGAGE_PAYMENT");
    expect(c.investments.kinds).toEqual({ "cash / loan payment": 1 });
    expect(r.accounts.find((a) => a.mask === "7288")!.investments.count).toBe(1);
  });

  it("reports a feed's error instead of failing", async () => {
    const plaid = {
      transactionsSync: async () => { throw Object.assign(new Error("x"), { response: { data: { error_code: "PRODUCT_NOT_READY" } } }); },
      investmentsTransactionsGet: async () => { throw Object.assign(new Error("x"), { response: { data: { error_code: "NO_INVESTMENT_ACCOUNTS" } } }); },
    } as never;
    const r = await inspectItem("token", { plaid });
    expect(r.bank.error).toBe("PRODUCT_NOT_READY");
    expect(r.investments.error).toBe("NO_INVESTMENT_ACCOUNTS");
    expect(r.accounts).toEqual([]);
  });
});
