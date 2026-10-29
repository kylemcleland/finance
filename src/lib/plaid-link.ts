/**
 * Linking banks through Plaid Hosted Link: start a session (a plaid.com URL
 * that works on a phone), then finish it by exchanging the result for an
 * access token. Shared by the Banks page and `npm run plaid:link`.
 */
import { CountryCode, Products } from "plaid";
import { prisma } from "./db";
import { plaidClient } from "./plaid";
import { saveItem } from "./plaid-items";

/** Returns the plaid.com URL to open. With a completion URI, Plaid sends the browser there when done. */
export async function startHostedLink(completionRedirectUri?: string): Promise<string> {
  const res = await plaidClient().linkTokenCreate({
    client_name: "Shared Expenses",
    language: "en",
    country_codes: [CountryCode.Us],
    user: { client_user_id: "household" },
    products: [Products.Transactions],
    transactions: { days_requested: 730 },
    hosted_link: {
      url_lifetime_seconds: 60 * 60 * 24,
      is_mobile_app: false,
      ...(completionRedirectUri ? { completion_redirect_uri: completionRedirectUri } : {}),
    },
  });
  const { link_token, hosted_link_url, expiration } = res.data;
  if (!hosted_link_url) throw new Error("Plaid did not return a hosted_link_url");
  await prisma.plaidLinkSession.create({
    data: { linkToken: link_token, url: hosted_link_url, expiresAt: new Date(expiration) },
  });
  return hosted_link_url;
}

/**
 * Plaid "update mode" for a bank whose login expired: the person logs in again
 * on Plaid's page and the existing link (and its access token) starts working
 * again. No new link is created, so none of the plan's 10 links is used up.
 */
export async function startReconnect(itemId: string, completionRedirectUri: string): Promise<string> {
  const item = await prisma.plaidItem.findUniqueOrThrow({ where: { id: itemId } });
  const res = await plaidClient().linkTokenCreate({
    client_name: "Shared Expenses",
    language: "en",
    country_codes: [CountryCode.Us],
    user: { client_user_id: "household" },
    access_token: item.accessToken,
    hosted_link: { url_lifetime_seconds: 60 * 60, is_mobile_app: false, completion_redirect_uri: completionRedirectUri },
  });
  if (!res.data.hosted_link_url) throw new Error("Plaid did not return a hosted_link_url");
  return res.data.hosted_link_url;
}

export type FinishReport = {
  linked: Array<{ institution: string; accounts: string[] }>;
  /** Sessions not completed yet (the bank login is still open, or was abandoned). */
  waiting: number;
  expired: number;
};

/** Exchange every completed Hosted Link session and store the bank. Safe to run repeatedly. */
export async function finishHostedLinks(): Promise<FinishReport> {
  const plaid = plaidClient();
  const report: FinishReport = { linked: [], waiting: 0, expired: 0 };
  for (const s of await prisma.plaidLinkSession.findMany()) {
    const got = await plaid.linkTokenGet({ link_token: s.linkToken });
    const result = (got.data.link_sessions ?? []).flatMap((ls) => ls.results?.item_add_results ?? []).at(-1);
    if (!result) {
      if (s.expiresAt < new Date()) {
        await prisma.plaidLinkSession.delete({ where: { linkToken: s.linkToken } });
        report.expired++;
      } else report.waiting++;
      continue;
    }
    const exchanged = await plaid.itemPublicTokenExchange({ public_token: result.public_token });
    const { item, accounts } = await saveItem({
      accessToken: exchanged.data.access_token,
      itemId: exchanged.data.item_id,
      institutionId: result.institution?.institution_id,
      institution: result.institution?.name,
    });
    await prisma.plaidLinkSession.delete({ where: { linkToken: s.linkToken } });
    report.linked.push({
      institution: item.institution ?? item.itemId,
      accounts: accounts.map((a) => `${a.name} ****${a.mask ?? ""}`),
    });
  }
  return report;
}

/** Plaid's error code from an API error, for showing on the page. */
export function plaidErrorCode(e: unknown): string {
  const data = (e as { response?: { data?: { error_code?: string } } })?.response?.data;
  return data?.error_code ?? (e instanceof Error ? e.message : "UNKNOWN");
}
