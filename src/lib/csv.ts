/** Minimal RFC4180 CSV reader/writer. Enough for bank exports. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; } else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== "")) rows.push(row);
  return rows;
}

export function toCsv(rows: Array<Array<string | number | boolean | null | undefined>>): string {
  const esc = (v: string | number | boolean | null | undefined) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return rows.map((r) => r.map(esc).join(",")).join("\n") + "\n";
}

/** Parse "1,234.56", "$12.00", "(12.00)" and "-12.00" into a number. */
export function parseAmount(s: string): number {
  const t = s.trim();
  const neg = /^\(.*\)$/.test(t) || t.startsWith("-");
  const n = parseFloat(t.replace(/[^0-9.]/g, ""));
  if (Number.isNaN(n)) throw new Error(`Bad amount: ${JSON.stringify(s)}`);
  return neg ? -n : n;
}

/** Accepts YYYY-MM-DD, MM/DD/YYYY and M/D/YY. Returns a UTC midnight Date. */
export function parseDate(s: string): Date {
  const t = s.trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    return new Date(Date.UTC(y, +m[1] - 1, +m[2]));
  }
  throw new Error(`Bad date: ${JSON.stringify(s)}`);
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
