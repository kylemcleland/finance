/** Our budget categories. Keep this list short; it is what the dashboard groups by. */
export const CATEGORIES = [
  "Groceries",
  "Dining",
  "Coffee",
  "Transport",
  "Housing",
  "Utilities",
  "Health",
  "Shopping",
  "Entertainment",
  "Subscriptions",
  "Travel",
  "Personal",
  "Gifts",
  "Fees",
  "Income",
  "Transfer",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s);
}

/**
 * Default allocation per category: percent of the expense allocated to "me".
 * null means the category is inherently personal, so each transaction needs
 * a decision (a merchant rule, then Claude, then review).
 */
export const CATEGORY_DEFAULT_SHARE_ME: Record<Category, number | null> = {
  Groceries: 50,
  Dining: 50,
  Coffee: null,
  Transport: 50,
  Housing: 50,
  Utilities: 50,
  Health: null,
  Shopping: null,
  Entertainment: 50,
  Subscriptions: 50,
  Travel: 50,
  Personal: null,
  Gifts: null,
  Fees: 50,
  Income: 50,
  Transfer: 50,
  Other: null,
};

/** Suggested monthly budgets used by the seed script; edit freely in the DB later. */
export const DEFAULT_BUDGETS: Partial<Record<Category, number>> = {
  Groceries: 900,
  Dining: 500,
  Coffee: 80,
  Transport: 400,
  Housing: 3200,
  Utilities: 350,
  Health: 200,
  Shopping: 400,
  Entertainment: 150,
  Subscriptions: 120,
  Travel: 400,
  Personal: 200,
  Gifts: 100,
};

/** Plaid personal_finance_category.detailed -> our category (checked first). */
const PLAID_DETAILED: Record<string, Category> = {
  FOOD_AND_DRINK_GROCERIES: "Groceries",
  FOOD_AND_DRINK_COFFEE: "Coffee",
  FOOD_AND_DRINK_RESTAURANT: "Dining",
  FOOD_AND_DRINK_FAST_FOOD: "Dining",
  FOOD_AND_DRINK_BEER_WINE_AND_LIQUOR: "Dining",
  FOOD_AND_DRINK_VENDING_MACHINES: "Dining",
  FOOD_AND_DRINK_OTHER_FOOD_AND_DRINK: "Dining",
  RENT_AND_UTILITIES_RENT: "Housing",
  RENT_AND_UTILITIES_GAS_AND_ELECTRICITY: "Utilities",
  RENT_AND_UTILITIES_INTERNET_AND_CABLE: "Utilities",
  RENT_AND_UTILITIES_TELEPHONE: "Utilities",
  RENT_AND_UTILITIES_WATER: "Utilities",
  RENT_AND_UTILITIES_SEWAGE_AND_WASTE_MANAGEMENT: "Utilities",
  RENT_AND_UTILITIES_OTHER_UTILITIES: "Utilities",
  LOAN_PAYMENTS_MORTGAGE_PAYMENT: "Housing",
  ENTERTAINMENT_TV_AND_MOVIES: "Subscriptions",
  ENTERTAINMENT_MUSIC_AND_AUDIO: "Subscriptions",
  ENTERTAINMENT_VIDEO_GAMES: "Entertainment",
  ENTERTAINMENT_SPORTING_EVENTS_AMUSEMENT_PARKS_AND_MUSEUMS: "Entertainment",
  ENTERTAINMENT_CASINOS_AND_GAMBLING: "Entertainment",
  ENTERTAINMENT_OTHER_ENTERTAINMENT: "Entertainment",
  GENERAL_MERCHANDISE_GIFTS_AND_NOVELTIES: "Gifts",
  GENERAL_MERCHANDISE_SUPERSTORES: "Groceries",
  GENERAL_MERCHANDISE_PET_SUPPLIES: "Shopping",
  TRANSPORTATION_GAS: "Transport",
  TRANSPORTATION_PUBLIC_TRANSIT: "Transport",
  TRANSPORTATION_TAXIS_AND_RIDE_SHARES: "Transport",
  TRANSPORTATION_PARKING: "Transport",
  TRANSPORTATION_TOLLS: "Transport",
  TRANSPORTATION_BIKES_AND_SCOOTERS: "Transport",
  TRANSPORTATION_OTHER_TRANSPORTATION: "Transport",
  PERSONAL_CARE_GYMS_AND_FITNESS_CENTERS: "Health",
  PERSONAL_CARE_HAIR_AND_BEAUTY: "Personal",
  PERSONAL_CARE_LAUNDRY_AND_DRY_CLEANING: "Personal",
  PERSONAL_CARE_OTHER_PERSONAL_CARE: "Personal",
  GENERAL_SERVICES_INSURANCE: "Housing",
  GENERAL_SERVICES_AUTOMOTIVE: "Transport",
  GENERAL_SERVICES_STORAGE: "Housing",
  GENERAL_SERVICES_EDUCATION: "Personal",
  GENERAL_SERVICES_CHILDCARE: "Other",
  GOVERNMENT_AND_NON_PROFIT_DONATIONS: "Gifts",
  BANK_FEES_ATM_FEES: "Fees",
};

/** Plaid personal_finance_category.primary -> our category (fallback). */
const PLAID_PRIMARY: Record<string, Category> = {
  INCOME: "Income",
  TRANSFER_IN: "Transfer",
  TRANSFER_OUT: "Transfer",
  LOAN_PAYMENTS: "Other",
  BANK_FEES: "Fees",
  ENTERTAINMENT: "Entertainment",
  FOOD_AND_DRINK: "Dining",
  GENERAL_MERCHANDISE: "Shopping",
  HOME_IMPROVEMENT: "Housing",
  MEDICAL: "Health",
  PERSONAL_CARE: "Personal",
  GENERAL_SERVICES: "Other",
  GOVERNMENT_AND_NON_PROFIT: "Other",
  TRANSPORTATION: "Transport",
  TRAVEL: "Travel",
  RENT_AND_UTILITIES: "Utilities",
};

export function categoryFromPlaid(
  primary?: string | null,
  detailed?: string | null,
): Category | null {
  if (detailed && PLAID_DETAILED[detailed]) return PLAID_DETAILED[detailed];
  if (primary && PLAID_PRIMARY[primary]) return PLAID_PRIMARY[primary];
  return null;
}

/**
 * Keyword fallback for transactions with no Plaid category (CSV imports).
 * Matched case-insensitively against the normalized merchant; first hit wins.
 */
const KEYWORDS: Array<[RegExp, Category]> = [
  [/payroll|direct dep|salary|gusto|adp\b/, "Income"],
  [/rent\b|mortgage|hoa\b|landlord|property mgmt/, "Housing"],
  [/pg ?& ?e|pge\b|edison|con ed|comcast|xfinity|at ?& ?t\b|verizon|t mobile|water dist|sonic\.net|utility/, "Utilities"],
  [/venmo|zelle|transfer|payment thank you|cashout/, "Transfer"],
  [/trader joe|safeway|whole foods|wholefds|costco|kroger|aldi|sprouts|berkeley bowl|grocery|market\b|instacart/, "Groceries"],
  [/starbucks|blue bottle|philz|peet|coffee|cafe\b|caffe/, "Coffee"],
  [/doordash|grubhub|uber ?eats|caviar|chipotle|restaurant|pizza|pizzeria|sushi|taco|ramen|kitchen|grill|bistro|thai|burger|bakery|brewing|wine bar|bar\b/, "Dining"],
  [/netflix|spotify|hulu|hbo|max\.com|disney|apple bill|apple services|youtube|icloud|google storage|nyt|new york times|patreon|audible|kindle unltd|openai|anthropic|chatgpt/, "Subscriptions"],
  [/uber|lyft|shell|chevron|76\b|arco|exxon|bp\b|clipper|bart|muni|parking|toll|fastrak|car wash|jiffy lube|autozone|tesla supercharg|evgo|chargepoint/, "Transport"],
  [/kaiser|cvs|walgreens|pharmacy|dental|dentist|medical|clinic|optometry|peloton|gym|fitness|yoga|equinox|crossfit/, "Health"],
  [/southwest|united|delta|alaska air|jetblue|airbnb|hotel|marriott|hilton|hyatt|expedia|amtrak|hertz|avis/, "Travel"],
  [/amc\b|cinemark|steamgames|sfmoma|ticketmaster|stubhub|steam\b|playstation|nintendo|eventbrite|museum|bowling/, "Entertainment"],
  [/salon|barber|nail|spa\b|sephora|ulta|dry clean|laundromat/, "Personal"],
  [/flowers|gift/, "Gifts"],
  [/overdraft|atm fee|monthly fee|service fee|interest charge|late fee/, "Fees"],
  [/amazon|amzn|target|walmart|best buy|ikea|home depot|lowe s|etsy|apple store|nordstrom|zara|uniqlo|rei\b/, "Shopping"],
];

export function categoryFromKeywords(merchant: string): Category | null {
  const m = merchant.toLowerCase();
  for (const [re, cat] of KEYWORDS) if (re.test(m)) return cat;
  return null;
}

/**
 * Cash taken out at an ATM is not spending (the cash is spent later), so it is
 * filed as a Transfer, which the dashboard leaves out. Plaid's own
 * TRANSFER_OUT_WITHDRAWAL, or a bank description that says ATM or cash
 * withdrawal. ATM fees are real costs and stay under Fees.
 * Mirrored in prisma/migrations/*_exclude_atm_withdrawals for rows synced earlier.
 */
const ATM_TEXT = /\batm\b|cash withdrawal/i;
const ATM_FEE = /\batm\b.*\b(fee|surcharge)\b|\b(fee|surcharge)\b.*\batm\b/i;
export function isAtmWithdrawal(t: { rawName: string; merchant: string; plaidCategoryDetailed?: string | null }): boolean {
  if (t.plaidCategoryDetailed === "TRANSFER_OUT_WITHDRAWAL") return true;
  if (t.plaidCategoryDetailed?.startsWith("BANK_FEES")) return false;
  const text = `${t.rawName} ${t.merchant}`;
  return ATM_TEXT.test(text) && !ATM_FEE.test(text);
}

/** Personal-category purchases where the cardholder is a safe guess, no review needed. */
export const PERSONAL_BY_CARDHOLDER = new Set<Category>(["Coffee", "Personal", "Health", "Gifts"]);

/** The five allowed splits: percent of the expense that is "me". */
export const SPLITS = [0, 25, 50, 75, 100] as const;
export type Split = (typeof SPLITS)[number];
export function snapSplit(n: number): Split {
  return SPLITS.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), 50 as Split);
}
export function splitLabel(share: number, me: string, her: string): string {
  const s = snapSplit(share);
  return s === 100 ? me : s === 75 ? `Mostly ${me}` : s === 50 ? "Shared" : s === 25 ? `Mostly ${her}` : her;
}
