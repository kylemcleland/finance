import { describe, expect, it } from "vitest";
import { classify, classifyLocally, fallbackClassification, isPeerPayment, matchRule } from "./classify";
import { normalizeMerchant } from "./merchant";
import { isAtmWithdrawal, isCreditCardPayment, snapSplit, splitLabel } from "./categories";
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

describe("splits", () => {
  it("snap to the five steps and label them", () => {
    expect(snapSplit(60)).toBe(50);
    expect(snapSplit(70)).toBe(75);
    expect(snapSplit(10)).toBe(0);
    expect(splitLabel(100, "Kyle", "Jackie")).toBe("Kyle");
    expect(splitLabel(25, "Kyle", "Jackie")).toBe("Mostly Jackie");
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
  it("a varies rule fixes the category but leaves the split open", () => {
    const rules = [{ pattern: "target", exact: false, category: "Shopping", shareMe: null }];
    expect(classifyLocally({ ...base, merchant: "target sf" }, rules)).toBeNull();
    expect(fallbackClassification({ ...base, merchant: "target sf", cardholder: "her" }, rules)).toMatchObject({ category: "Shopping", shareMe: 0, needsReview: true });
  });
  it("cache beats Plaid, unless it says varies", () => {
    const input = { ...base, merchant: "x", plaidCategoryPrimary: "FOOD_AND_DRINK" };
    expect(classifyLocally(input, [], { category: "Coffee", shareMe: 100, reason: "his coffee" })).toMatchObject({ category: "Coffee", shareMe: 100, source: "claude", note: "his coffee" });
    expect(classifyLocally(input, [], { category: "Shopping", shareMe: null })).toBeNull();
  });
  it("layer 2: shared categories get the category default", () => {
    const r = classifyLocally({ ...base, merchant: "safeway", plaidCategoryPrimary: "FOOD_AND_DRINK", plaidCategoryDetailed: "FOOD_AND_DRINK_GROCERIES" }, []);
    expect(r).toMatchObject({ category: "Groceries", shareMe: 50, source: "plaid" });
  });
  it("layer 2: personal categories use the cardholder as a hint", () => {
    const salon = { ...base, merchant: "salon", plaidCategoryPrimary: "PERSONAL_CARE", plaidCategoryDetailed: "PERSONAL_CARE_HAIR_AND_BEAUTY" };
    expect(classifyLocally({ ...salon, cardholder: "her" }, [])).toMatchObject({ category: "Personal", shareMe: 0, needsReview: false });
    expect(classifyLocally({ ...salon, cardholder: "me" }, [])).toMatchObject({ shareMe: 100, needsReview: false });
    expect(classifyLocally(salon, [])).toBeNull();
    // Shopping on her card: probably hers, but a couch is possible, so review.
    const target = { ...base, merchant: "target", plaidCategoryPrimary: "GENERAL_MERCHANDISE", cardholder: "her" as const };
    expect(classifyLocally(target, [])).toMatchObject({ category: "Shopping", shareMe: 0, needsReview: true });
  });
  it("layer 2b: keywords when there is no Plaid category", () => {
    expect(classifyLocally({ ...base, merchant: "trader joe s" }, [])).toMatchObject({ category: "Groceries", shareMe: 50, source: "keyword" });
    expect(classifyLocally({ ...base, merchant: "blue bottle coffee", cardholder: "me" }, [])).toMatchObject({ category: "Coffee", shareMe: 100, source: "keyword" });
    expect(classifyLocally({ ...base, merchant: "blue bottle coffee" }, [])).toBeNull();
  });
  it("returns null with no Plaid category and no keyword hit", () => {
    expect(classifyLocally({ ...base, merchant: "mystery" }, [])).toBeNull();
  });
});

describe("classify", () => {
  it("falls back to 50/50 + review when Claude is stubbed", async () => {
    const { result, fromClaude } = await classify({ ...base, merchant: "mystery" }, [], null, stubClassifier);
    expect(result).toMatchObject({ category: "Other", shareMe: 50, source: "unclassified", needsReview: true });
    expect(fromClaude).toBeUndefined();
  });
  it("uses and returns the Claude answer for caching", async () => {
    const fake = async () => ({ category: "Coffee" as const, shareMe: 100 as const, merchantVaries: false, needsReview: false, reason: "r", model: "m" });
    const { result, fromClaude } = await classify({ ...base, merchant: "new cafe" }, [], null, fake);
    expect(result).toMatchObject({ category: "Coffee", shareMe: 100, source: "claude", needsReview: false });
    expect(fromClaude).toEqual({ category: "Coffee", shareMe: 100, reason: "r", model: "m" });
  });
  it("a varies verdict caches the category only and asks for review", async () => {
    const fake = async () => ({ category: "Shopping" as const, shareMe: 25 as const, merchantVaries: true, needsReview: false, reason: "could be either", model: "m" });
    const { result, fromClaude } = await classify({ ...base, merchant: "target" }, [], null, fake);
    expect(result).toMatchObject({ category: "Shopping", shareMe: 25, needsReview: true });
    expect(fromClaude?.shareMe).toBeNull();
  });
});

describe("ATM withdrawals", () => {
  const input = (rawName: string, plaidCategoryDetailed: string | null = null, merchant = normalizeMerchant(rawName)) => ({
    ...base, rawName, merchant, plaidCategoryPrimary: null, plaidCategoryDetailed, account: "Checking", cardholder: null, date: "2026-10-01",
  });
  it("files withdrawals as Transfer with no review", () => {
    for (const r of [
      classifyLocally(input("ATM WITHDRAWAL 123 MAIN ST SAN FRANCISCO CA"), []),
      classifyLocally(input("Non-Chase ATM Withdraw 10/14"), []),
      classifyLocally(input("CASH WITHDRAWAL BRANCH 0042"), []),
      classifyLocally(input("WELLS FARGO 4021", "TRANSFER_OUT_WITHDRAWAL"), []),
    ]) expect(r).toMatchObject({ category: "Transfer", needsReview: false, note: "ATM withdrawal" });
  });
  it("beats a merchant rule and leaves fees and lookalikes alone", () => {
    const rules = [{ pattern: "atm", exact: false, category: "Shopping", shareMe: 100 }];
    expect(classifyLocally(input("ATM WITHDRAWAL 9981"), rules)?.category).toBe("Transfer");
    expect(classifyLocally(input("NON-CHASE ATM FEE-WITH"), [])?.category).toBe("Fees");
    expect(classifyLocally(input("ATM SURCHARGE", "BANK_FEES_ATM_FEES"), [])?.category).toBe("Fees");
    expect(isAtmWithdrawal(input("ATMOSPHERE COFFEE"))).toBe(false);
    expect(isAtmWithdrawal(input("BATMAN STORE"))).toBe(false);
  });
});

describe("parseManualExpense", async () => {
  const { parseManualExpense } = await import("./manual");
  const today = new Date("2026-10-29T12:00:00Z");
  const good = { date: "2026-10-28", amount: "$1,234.567", description: "  Farmers   market ", category: "Groceries", share: "50" };
  it("cleans valid input", () => {
    expect(parseManualExpense(good, today)).toEqual({ ok: true, value: { date: "2026-10-28", amount: 1234.57, description: "Farmers market", category: "Groceries", shareMe: 50 } });
  });
  it.each([
    ["amount", { amount: "0" }], ["amount", { amount: "-5" }], ["amount", { amount: "abc" }],
    ["description", { description: "   " }],
    ["date", { date: "2026-11-15" }], ["date", { date: "10/28/2026" }],
    ["category", { category: "Bitcoin" }],
    ["split", { share: "60" }], ["split", { share: undefined }],
  ])("rejects bad %s", (error, patch) => {
    expect(parseManualExpense({ ...good, ...patch }, today)).toEqual({ ok: false, error });
  });
});

describe("credit card payments", () => {
  const input = (rawName: string, plaidCategoryDetailed: string | null = null) => ({
    ...base, rawName, merchant: normalizeMerchant(rawName), plaidCategoryPrimary: null, plaidCategoryDetailed, account: "Checking", cardholder: null, date: "2026-10-01",
  });
  it.each([
    "Payment Thank You - Web", "CHASE CREDIT CRD AUTOPAY PPD ID: 4760039224", "AMEX EPAYMENT ACH PMT", "APPLECARD GSBANK PAYMENT",
    "DISCOVER E-PAYMENT 7231", "CAPITAL ONE ONLINE PMT", "CITI AUTOPAY PAYMENT", "BK OF AMER VISA ONLINE PMT", "CREDIT CARD PAYMENT",
  ])("files %s as a transfer", (raw) => {
    expect(classifyLocally(input(raw), [{ pattern: normalizeMerchant(raw), exact: true, category: "Other", shareMe: 50 }]))
      .toMatchObject({ category: "Transfer", needsReview: false, note: "Credit card payment" });
  });
  it("trusts Plaid's category", () => {
    expect(classifyLocally(input("WEB PMT 0042", "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT"), [])).toMatchObject({ category: "Transfer", source: "plaid" });
  });
  it.each(["PG&E AUTOPAY", "GEICO AUTOPAY", "CITIZENS ENERGY PAYMENT", "COMCAST PAYMENT", "VISALIA CAFE"])("leaves %s alone", (raw) => {
    expect(isCreditCardPayment(input(raw))).toBe(false);
  });
});

describe("personFromName", async () => {
  const { personFromName } = await import("./sync");
  it.each([
    ["JACKELIN SALINAS", "her"], ["Jackie S", "her"], ["KYLE MCLELAND", "me"], ["K MCLELAND", "me"], ["J. SALINAS", "her"],
    ["JACKELIN MCLELAND", "her"], // first names win over surnames
    ["", null], [null, null], ["ALEX SMITH", null], ["KYLEE JONES", null], ["KYLE AND JACKIE", null],
  ])("%s -> %s", (name, who) => {
    expect(personFromName(name as string | null)).toBe(who);
  });
});

describe("review fixes", () => {
  const input = (rawName: string, extra: Record<string, unknown> = {}) => ({
    ...base, rawName, merchant: normalizeMerchant(rawName), plaidCategoryPrimary: null, plaidCategoryDetailed: null, account: "Card", cardholder: null, date: "2026-10-01", ...extra,
  });
  it("a varies rule is not settled by a cached split", () => {
    const rules = [{ pattern: "amazon", exact: false, category: "Shopping", shareMe: null }];
    expect(classifyLocally(input("AMAZON"), rules, { category: "Shopping", shareMe: 100 })).toBeNull();
  });
  it("Plaid's mortgage or auto label beats the card-payment text match", () => {
    expect(isCreditCardPayment(input("CITI MORTGAGE PAYMENT", { plaidCategoryDetailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT" }))).toBe(false);
    expect(isCreditCardPayment(input("CAPITAL ONE AUTO PAYMENT", { plaidCategoryDetailed: "LOAN_PAYMENTS_CAR_PAYMENT" }))).toBe(false);
    expect(isCreditCardPayment(input("CAPITAL ONE ONLINE PMT", { plaidCategoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" }))).toBe(true);
  });
  it("a Claude answer that drops a purchase out of spending goes to review", async () => {
    const claude = async () => ({ category: "Transfer" as const, shareMe: 50 as const, merchantVaries: false, needsReview: false, reason: "x", model: "m" });
    const { result } = await classify(input("ODD THING"), [], null, claude);
    expect(result).toMatchObject({ category: "Transfer", needsReview: true });
  });
});

describe("Venmo / Zelle", () => {
  const input = (rawName: string, amount = 120, extra: Record<string, unknown> = {}) => ({
    ...base, rawName, amount, merchant: normalizeMerchant(rawName), plaidCategoryPrimary: "TRANSFER_OUT", plaidCategoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER", account: "Checking", cardholder: null, date: "2026-10-01", ...extra,
  });
  it("paying someone else goes to review as spending", () => {
    expect(classifyLocally(input("Zelle payment to MARIA LOPEZ JPM99"), [])).toMatchObject({ category: "Other", needsReview: true, note: "Venmo/Zelle payment: what was it for?" });
    expect(classifyLocally(input("VENMO PAYMENT 1023 SAM RENT"), [])).toMatchObject({ category: "Other", needsReview: true });
  });
  it("money received, or between the two of us, stays a transfer", () => {
    expect(classifyLocally(input("VENMO CASHOUT", -60), [])).toMatchObject({ category: "Transfer", needsReview: false });
    expect(classifyLocally(input("Zelle payment to JACKELIN SALINAS"), [])).toMatchObject({ category: "Transfer", needsReview: false });
    expect(classifyLocally(input("Zelle from KYLE MCLELAND", 200), [])).toMatchObject({ category: "Transfer", needsReview: false });
  });
  it("a rule for a specific recipient wins", () => {
    const raw = "Zelle payment to MARIA LOPEZ";
    const rules = [{ pattern: normalizeMerchant(raw), exact: true, category: "Housing", shareMe: 50 }];
    expect(classifyLocally(input(raw), rules)).toMatchObject({ category: "Housing", source: "rule" });
  });
  it("is no longer a transfer by keyword alone", () => {
    expect(isPeerPayment({ rawName: "PAYPAL *NETFLIX", merchant: "paypal netflix", plaidCategoryDetailed: "ENTERTAINMENT_TV_AND_MOVIES" })).toBe(false);
    expect(isPeerPayment({ rawName: "PAYPAL INST XFER JOHN", merchant: "paypal inst xfer john", plaidCategoryDetailed: "TRANSFER_OUT_ACCOUNT_TRANSFER" })).toBe(true);
    expect(isPeerPayment({ rawName: "VENMO PAYMENT", merchant: "venmo payment" })).toBe(true);
    expect(isPeerPayment({ rawName: "TRADER JOE S", merchant: "trader joe s" })).toBe(false);
  });
});

describe("Pets and Wedding", () => {
  it("files pet stores, vets and walkers under Pets, not cars", async () => {
    const { categoryFromKeywords, categoryFromPlaid, CATEGORY_DEFAULT_SHARE_ME, ONE_OFF_CATEGORIES } = await import("./categories");
    for (const m of ["chewy", "petco", "pet food express", "vca animal hospital", "mission vet clinic", "rover", "wag labs"]) expect(categoryFromKeywords(m)).toBe("Pets");
    expect(categoryFromKeywords("land rover marin")).not.toBe("Pets");
    expect(categoryFromPlaid("MEDICAL", "MEDICAL_VETERINARY_SERVICES")).toBe("Pets");
    expect(CATEGORY_DEFAULT_SHARE_ME.Pets).toBe(50);
    expect(ONE_OFF_CATEGORIES.has("Wedding")).toBe(true);
  });
});

describe("monthly expenses", async () => {
  const { monthsDue, occurrenceDate } = await import("./manual");
  const now = new Date("2026-10-29T18:00:00Z"); // Oct 29 in Pacific time
  it("uses a short month's last day", () => {
    expect(occurrenceDate("2026-02", 31)).toBe("2026-02-28");
    expect(occurrenceDate("2028-02", 30)).toBe("2028-02-29");
    expect(occurrenceDate("2026-10", 1)).toBe("2026-10-01");
  });
  it("back-fills from the start month up to today", () => {
    expect(monthsDue({ startMonth: "2026-07", lastMonth: null, dayOfMonth: 1 }, now)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    // This month's day hasn't come yet.
    expect(monthsDue({ startMonth: "2026-09", lastMonth: null, dayOfMonth: 30 }, now)).toEqual(["2026-09"]);
  });
  it("only adds months after the last one filled", () => {
    expect(monthsDue({ startMonth: "2026-07", lastMonth: "2026-10", dayOfMonth: 1 }, now)).toEqual([]);
    expect(monthsDue({ startMonth: "2026-07", lastMonth: "2026-09", dayOfMonth: 1 }, now)).toEqual(["2026-10"]);
    expect(monthsDue({ startMonth: "2026-11", lastMonth: null, dayOfMonth: 1 }, now)).toEqual([]);
  });
  it("crosses the year", () => {
    expect(monthsDue({ startMonth: "2026-12", lastMonth: null, dayOfMonth: 1 }, new Date("2027-02-02T18:00:00Z"))).toEqual(["2026-12", "2027-01", "2027-02"]);
  });
});
