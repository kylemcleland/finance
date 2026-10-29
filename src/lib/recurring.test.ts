import { describe, expect, it } from "vitest";
import { findRecurring, type Charge } from "./recurring";

const now = new Date("2026-10-29T00:00:00Z");
const monthly = (merchant: string, amounts: number[], startMonth = 3, day = 5): Charge[] =>
  amounts.map((amount, i) => ({ merchant, amount, category: "Subscriptions", date: new Date(Date.UTC(2026, startMonth + i, day)) }));

describe("findRecurring", () => {
  it("finds a monthly subscription and its yearly cost", () => {
    const [r] = findRecurring(monthly("netflix", [15.49, 15.49, 15.49, 15.49, 15.49, 15.49, 15.49]), now);
    expect(r).toMatchObject({ merchant: "netflix", cadence: "monthly", lapsed: false, priceUpFrom: null });
    expect(Math.round(r.yearly)).toBe(186);
  });
  it("flags a price increase", () => {
    const [r] = findRecurring(monthly("spotify", [11.99, 11.99, 11.99, 11.99, 13.99]), now);
    expect(r.priceUpFrom).toBeCloseTo(11.99);
  });
  it("flags a new one and a lapsed one", () => {
    const fresh = monthly("max", [16.99, 16.99, 16.99], 7, 20);
    const old = monthly("gym", [80, 80, 80, 80], 1, 3);
    const rs = findRecurring([...fresh, ...old], now);
    expect(rs.find((r) => r.merchant === "max")?.isNew).toBe(true);
    expect(rs.find((r) => r.merchant === "gym")?.lapsed).toBe(true);
  });
  it("finds a yearly charge from two", () => {
    const rs = findRecurring([
      { merchant: "costco membership", amount: 65, category: "Shopping", date: new Date("2025-11-02") },
      { merchant: "costco membership", amount: 65, category: "Shopping", date: new Date("2026-11-01") },
    ], new Date("2026-11-10"));
    expect(rs[0]).toMatchObject({ cadence: "yearly" });
  });
  it("ignores irregular shopping and variable amounts", () => {
    const safeway: Charge[] = [3, 9, 12, 20, 21, 27].map((d, i) => ({ merchant: "safeway", amount: [40, 112, 63, 18, 95, 70][i], category: "Groceries", date: new Date(Date.UTC(2026, 9, d)) }));
    const coffee: Charge[] = Array.from({ length: 20 }, (_, i) => ({ merchant: "blue bottle", amount: 6, category: "Coffee", date: new Date(Date.UTC(2026, 9, 1 + i)) }));
    expect(findRecurring([...safeway, ...coffee], now)).toEqual([]);
  });
});

describe("findRecurring cost", () => {
  it("prices a subscription at its current amount after a rise", () => {
    const rs = findRecurring([15.49, 15.49, 15.49, 15.49, 17.99].map((amount, i) => ({ merchant: "netflix", amount, category: "Subscriptions", date: new Date(Date.UTC(2026, 5 + i, 5)) })), new Date("2026-10-29"));
    expect(Math.round(rs[0].yearly)).toBe(216);
  });
});
