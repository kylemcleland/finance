/**
 * Generate samples/sample-transactions.csv: six months of plausible household
 * spending across a joint account and two personal cards. Deterministic.
 * Replace it with a real bank export when you have one.
 */
import { writeFileSync } from "node:fs";
import { toCsv, ymd } from "@/lib/csv";

let seed = 20261028;
const rand = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296; };
const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)];
const amt = (lo: number, hi: number) => Math.round((lo + rand() * (hi - lo)) * 100) / 100;

type Gen = { desc: () => string; amount: () => number; account: string; perMonth: number; dayOfMonth?: number; trend?: number };

const JOINT = "Joint Checking", KYLE = "Kyle Card", HER = "Her Card";
const GENS: Gen[] = [
  { desc: () => "BAY PROPERTY MGMT RENT", amount: () => 3150, account: JOINT, perMonth: 1, dayOfMonth: 1 },
  { desc: () => "PG&E ONLINE PAYMENT", amount: () => amt(95, 210), account: JOINT, perMonth: 1, dayOfMonth: 12 },
  { desc: () => "COMCAST XFINITY", amount: () => 89.99, account: JOINT, perMonth: 1, dayOfMonth: 18 },
  { desc: () => "NETFLIX.COM", amount: () => 22.99, account: JOINT, perMonth: 1, dayOfMonth: 5 },
  { desc: () => "SPOTIFY USA", amount: () => 19.99, account: KYLE, perMonth: 1, dayOfMonth: 9 },
  { desc: () => pick(["TRADER JOE'S #123 SAN FRANCISCO CA", "SAFEWAY #1490 SAN FRANCISCO CA", "WHOLEFDS MKT 10245 SF CA", "COSTCO WHSE #0144"]), amount: () => amt(28, 190), account: JOINT, perMonth: 9, trend: 0.03 },
  { desc: () => pick(["SQ *BLUE BOTTLE COFFEE 0412 OAKLAND CA", "PHILZ COFFEE 24TH ST", "STARBUCKS STORE 05891"]), amount: () => amt(4.5, 9.75), account: KYLE, perMonth: 10, trend: 0.08 },
  { desc: () => pick(["TST* PIZZERIA DELFINA - MIS", "DOORDASH*THAI HOUSE", "CHIPOTLE 1234", "SQ *SOUVLA", "NOPA RESTAURANT SF", "SUSHI ZONE"]), amount: () => amt(18, 140), account: JOINT, perMonth: 6, trend: -0.04 },
  { desc: () => pick(["DOORDASH*BURMA LOVE", "UBER EATS", "GRUBHUB*TACOS EL PATRON"]), amount: () => amt(22, 48), account: KYLE, perMonth: 3 },
  { desc: () => pick(["UBER *TRIP", "LYFT *RIDE SUN 9PM", "CLIPPER AUTOLOAD", "SHELL OIL 57444", "CHEVRON 0091223"]), amount: () => amt(8, 72), account: pick([JOINT, KYLE, HER]), perMonth: 7 },
  { desc: () => pick(["AMZN Mktp US*2K4LM0ZQ3", "AMAZON.COM*HG7TY", "TARGET 00012345 SF CA"]), amount: () => amt(12, 160), account: pick([JOINT, HER, KYLE]), perMonth: 5, trend: 0.05 },
  { desc: () => pick(["CVS/PHARMACY #09876", "WALGREENS #5566", "KAISER PERMANENTE COPAY"]), amount: () => amt(9, 85), account: pick([KYLE, HER]), perMonth: 2 },
  { desc: () => "PELOTON* MEMBERSHIP", amount: () => 44, account: KYLE, perMonth: 1, dayOfMonth: 15 },
  { desc: () => pick(["SEPHORA.COM", "THE NAIL LOUNGE SF", "DRYBAR HAYES VALLEY"]), amount: () => amt(35, 120), account: HER, perMonth: 2 },
  { desc: () => pick(["ZARA USA", "UNIQLO SF", "NORDSTROM RACK"]), amount: () => amt(30, 180), account: HER, perMonth: 1 },
  { desc: () => pick(["REI #93 SF", "STEAMGAMES.COM 4259522", "APPLE.COM/BILL"]), amount: () => amt(10, 140), account: KYLE, perMonth: 1 },
  { desc: () => pick(["AMC THEATRES 2041", "TICKETMASTER", "SFMOMA MEMBERSHIP"]), amount: () => amt(24, 160), account: JOINT, perMonth: 1 },
  { desc: () => pick(["SOUTHWEST AIR 5262", "AIRBNB * HMK8T2", "ALASKA AIR 0272"]), amount: () => amt(180, 620), account: JOINT, perMonth: 0.4 },
  { desc: () => pick(["ETSY.COM", "PAPER SOURCE SF", "1-800-FLOWERS"]), amount: () => amt(25, 90), account: pick([KYLE, HER]), perMonth: 0.6 },
  { desc: () => "MYSTERY VENDOR LLC", amount: () => amt(15, 60), account: JOINT, perMonth: 0.5 },
  { desc: () => "ACME CORP PAYROLL DIRECT DEP", amount: () => -5400, account: JOINT, perMonth: 1, dayOfMonth: 1 },
  { desc: () => "ACME CORP PAYROLL DIRECT DEP", amount: () => -5400, account: JOINT, perMonth: 1, dayOfMonth: 15 },
  { desc: () => "VENMO PAYMENT 1032 FROM SARA", amount: () => -amt(20, 80), account: KYLE, perMonth: 1 },
];

const rows: Array<[string, string, string, string]> = [];
const start = new Date(Date.UTC(2026, 4, 1)); // May 2026
for (let m = 0; m < 6; m++) {
  const year = start.getUTCFullYear(), month = start.getUTCMonth() + m;
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  for (const g of GENS) {
    const expected = g.perMonth * (1 + (g.trend ?? 0) * m);
    let n = Math.floor(expected);
    if (rand() < expected - n) n++;
    for (let i = 0; i < n; i++) {
      const day = g.dayOfMonth ?? 1 + Math.floor(rand() * daysInMonth);
      const d = new Date(Date.UTC(year, month, Math.min(day, daysInMonth)));
      if (d > new Date(Date.UTC(2026, 9, 28))) continue;
      rows.push([ymd(d), g.desc(), g.amount().toFixed(2), g.account]);
    }
  }
}
rows.sort((a, b) => a[0].localeCompare(b[0]));
writeFileSync("samples/sample-transactions.csv", toCsv([["date", "description", "amount", "account"], ...rows]));
console.log(`Wrote samples/sample-transactions.csv with ${rows.length} rows`);
