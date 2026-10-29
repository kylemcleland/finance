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
