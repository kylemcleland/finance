import { describe, expect, it } from "vitest";
import { classify, classifyLocally, fallbackClassification, matchRule } from "./classify";
import { normalizeMerchant } from "./merchant";
import { stubClassifier } from "./claude";

const base = { rawName: "", amount: 10 };

describe("normalizeMerchant", () => {
  it("strips processor prefixes, ids and locations", () => {
    expect(normalizeMerchant("SQ *BLUE BOTTLE COFFEE 0412 OAKLAND CA")).toBe("blue bottle coffee oakland");
    expect(normalizeMerchant("TST* Pizzeria Delfina - Mis")).toBe("pizzeria delfina mis");
    expect(normalizeMerchant("AMZN Mktp US*2K4LM0ZQ3")).toBe("amzn mktp");
    expect(normalizeMerchant("TRADER JOE'S #123 SAN FRANCISCO")).toBe("trader joe s san francisco");
    expect(normalizeMerchant("NETFLIX.COM")).toBe("netflix");
    expect(normalizeMerchant("APPLE.COM/BILL")).toBe("apple bill");
    expect(normalizeMerchant("STEAMGAMES.COM 4259522")).toBe("steamgames");
  });
});

describe("matchRule", () => {
  const rules = [
    { pattern: "peloton", exact: false, category: "Health", shareMe: 100 },
    { pattern: "trader joe", exact: false, category: "Groceries", shareMe: 50 },
    { pattern: "trader joe s wine", exact: false, category: "Dining", shareMe: 50 },
    { pattern: "gym", exact: true, category: "Health", shareMe: 0 },
  ];
  it("prefers exact, then the longest substring", () => {
    expect(matchRule("gym", rules)?.shareMe).toBe(0);
    expect(matchRule("trader joe s wine shop", rules)?.category).toBe("Dining");
    expect(matchRule("trader joe s", rules)?.category).toBe("Groceries");
    expect(matchRule("unknown", rules)).toBeUndefined();
  });
});

describe("classifyLocally", () => {
  it("layer 1: rule wins over Plaid", () => {
    const r = classifyLocally(
      { ...base, merchant: "peloton", plaidCategoryPrimary: "GENERAL_MERCHANDISE" },
      [{ pattern: "peloton", exact: false, category: "Health", shareMe: 100 }],
    );
    expect(r).toMatchObject({ category: "Health", shareMe: 100, source: "rule" });
  });
  it("cache beats Plaid", () => {
    const r = classifyLocally(
      { ...base, merchant: "x", plaidCategoryPrimary: "FOOD_AND_DRINK" },
      [],
      { category: "Coffee", shareMe: 100, reason: "his coffee" },
    );
    expect(r).toMatchObject({ category: "Coffee", shareMe: 100, source: "claude", note: "his coffee" });
  });
  it("layer 2: shared categories get the category default", () => {
    const r = classifyLocally(
      { ...base, merchant: "safeway", plaidCategoryPrimary: "FOOD_AND_DRINK", plaidCategoryDetailed: "FOOD_AND_DRINK_GROCERIES" },
      [],
    );
    expect(r).toMatchObject({ category: "Groceries", shareMe: 50, source: "plaid" });
  });
  it("layer 2: personal categories are left for Claude or review", () => {
    const input = { ...base, merchant: "salon", plaidCategoryPrimary: "PERSONAL_CARE", plaidCategoryDetailed: "PERSONAL_CARE_HAIR_AND_BEAUTY" };
    expect(classifyLocally(input, [])).toBeNull();
    expect(fallbackClassification(input)).toMatchObject({ category: "Personal", shareMe: 50, needsReview: true });
  });
  it("layer 2b: keywords when there is no Plaid category", () => {
    expect(classifyLocally({ ...base, merchant: "trader joe s" }, [])).toMatchObject({ category: "Groceries", shareMe: 50, source: "keyword" });
    expect(classifyLocally({ ...base, merchant: "blue bottle coffee" }, [])).toBeNull();
  });
  it("returns null with no Plaid category and no keyword hit", () => {
    expect(classifyLocally({ ...base, merchant: "mystery" }, [])).toBeNull();
  });
});

describe("classify", () => {
  it("falls back to 50/50 + review when Claude is stubbed", async () => {
    const { result, fromClaude } = await classify({ ...base, merchant: "mystery" }, [], null, stubClassifier);
    expect(result).toEqual(fallbackClassification({ ...base, merchant: "mystery" }));
    expect(result).toMatchObject({ category: "Other", shareMe: 50, source: "unclassified", needsReview: true });
    expect(fromClaude).toBeUndefined();
  });
  it("uses and returns the Claude answer for caching", async () => {
    const fake = async () => ({ category: "Coffee" as const, shareMe: 100, needsReview: false, reason: "r", model: "m" });
    const { result, fromClaude } = await classify({ ...base, merchant: "new cafe" }, [], null, fake);
    expect(result).toMatchObject({ category: "Coffee", shareMe: 100, source: "claude" });
    expect(fromClaude).toEqual({ category: "Coffee", shareMe: 100, reason: "r", model: "m" });
  });
});
