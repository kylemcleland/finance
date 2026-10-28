/**
 * Turn a raw bank description into a stable merchant key for rule matching
 * and caching. "SQ *BLUE BOTTLE COFFEE 0412 OAKLAND CA" -> "blue bottle coffee".
 */
export function normalizeMerchant(raw: string): string {
  let s = raw.toLowerCase();
  s = s.replace(/^(sq|tst|sp|pp|py|pos|dd|wl|ach|chk|dbt|crd)\s*\*\s*/i, ""); // processor prefixes
  s = s.replace(/^(purchase|debit card purchase|pos purchase|recurring payment|payment to)\s+/i, "");
  s = s.replace(/https?:\/\/|www\.|\.(com|net|org|co)\b/g, " "); // keep the domain name, drop the TLD
  s = s.replace(/\b\d{2}\/\d{2}(\/\d{2,4})?\b/g, " "); // dates
  s = s.replace(/#?\b\d{3,}\b/g, " "); // store numbers, reference ids
  s = s.replace(/\b[a-z]*\d+[a-z0-9]*\b/g, " "); // alphanumeric ids
  s = s.replace(/[^a-z& ]+/g, " ");
  s = s.replace(/\s+/g, " ").trim();
  s = s.replace(/\s+(ca|ny|wa|or|tx|fl|il|co|az|nv|ma|nj|pa|ga|nc|va|md|dc|us|usa)$/i, "");
  return s || raw.toLowerCase().trim();
}
