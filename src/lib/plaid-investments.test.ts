import { describe, expect, it } from "vitest";
import { cashMovement, hasInvestmentAccounts } from "./plaid-investments";

const t = (type: string, subtype: string, amount = 100) => ({ type, subtype, amount }) as never;

describe("investment-account cash", () => {
  it("imports payments, moves and fees; skips trades and income", () => {
    expect(cashMovement(t("cash", "withdrawal"))).toEqual({ primary: null, detailed: null });
    expect(cashMovement(t("transfer", "send"))).toEqual({ primary: null, detailed: null });
    expect(cashMovement(t("cash", "deposit", -500))?.primary).toBe("TRANSFER_IN");
    expect(cashMovement(t("cash", "contribution", -500))?.primary).toBe("TRANSFER_IN");
    expect(cashMovement(t("cash", "distribution"))?.primary).toBe("TRANSFER_OUT");
    expect(cashMovement(t("fee", "account fee", 25))?.primary).toBe("BANK_FEES");
    for (const [type, sub] of [["buy", "buy"], ["sell", "sell"], ["cash", "dividend"], ["cash", "interest"], ["cash", "qualified dividend"], ["buy", "dividend reinvestment"], ["cash", "tax withheld"]]) {
      expect(cashMovement(t(type, sub))).toBeNull();
    }
    expect(cashMovement(t("cash", "withdrawal", 0))).toBeNull();
  });
  it("spots investment-type accounts", () => {
    expect(hasInvestmentAccounts([{ type: "depository" }, { type: "investment" }])).toBe(true);
    expect(hasInvestmentAccounts([{ type: "depository" }, { type: "credit" }, { type: null }])).toBe(false);
  });
});

describe("retirement accounts are skipped", async () => {
  const { isRetirement } = await import("./plaid-investments");
  it("by subtype or name", () => {
    expect(isRetirement({ subtype: "401k", name: "Plan" })).toBe(true);
    expect(isRetirement({ subtype: null, name: "Discord Inc. 401(k)" })).toBe(true);
    expect(isRetirement({ subtype: "roth", name: "My Roth IRA" })).toBe(true);
    expect(isRetirement({ subtype: "cash management", name: "Cash Management (Individual)" })).toBe(false);
    expect(isRetirement({ subtype: "brokerage", name: "Individual - TOD" })).toBe(false);
  });
  it("a link with only 401(k)s has no investment cash accounts", () => {
    expect(hasInvestmentAccounts([{ type: "investment", subtype: "401k", name: "Anthropic PBC 401(k)" }])).toBe(false);
    expect(hasInvestmentAccounts([{ type: "investment", subtype: "cash management", name: "Cash Management" }])).toBe(true);
  });
});
