/**
 * Claude sorting runs in a Netlify background function (up to 15 minutes)
 * instead of inside a request (30 seconds). This module starts it, guards
 * against overlapping runs, and records its progress for the Banks page.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "./db";

const STATE_KEY = "sort-run";
export const SORT_FUNCTION_PATH = "/.netlify/functions/sort-background";
/** A run that started this long ago and never finished is treated as dead. */
const STALE_MS = 16 * 60 * 1000;

export type SortRun = {
  startedAt: string;
  finishedAt?: string;
  trigger: string;
  classified?: number;
  remaining?: number;
  failed?: number;
  lastError?: string | null;
};

export async function getSortRun(): Promise<SortRun | null> {
  const row = await prisma.appState.findUnique({ where: { key: STATE_KEY } });
  return (row?.value as SortRun | undefined) ?? null;
}

export async function setSortRun(run: SortRun) {
  await prisma.appState.upsert({ where: { key: STATE_KEY }, update: { value: run }, create: { key: STATE_KEY, value: run } });
}

export function isRunning(run: SortRun | null, now = Date.now()): boolean {
  return Boolean(run && !run.finishedAt && now - new Date(run.startedAt).getTime() < STALE_MS);
}

/** Proves a request to the background function came from this app. */
export function sortToken(): string {
  const secret = process.env.AUTH_SECRET ?? "";
  if (secret.length < 32) throw new Error("AUTH_SECRET is not set");
  return createHmac("sha256", secret).update("sort-background:v1").digest("hex");
}

export function checkSortToken(given: string | null): boolean {
  if (!given) return false;
  const expected = Buffer.from(sortToken());
  const got = Buffer.from(given);
  return got.length === expected.length && timingSafeEqual(got, expected);
}

/** Start a background sorting run unless one is already going. Returns whether one was started. */
export async function startBackgroundSort(origin: string, trigger: string): Promise<boolean> {
  if (isRunning(await getSortRun())) return false;
  const res = await fetch(new URL(SORT_FUNCTION_PATH, origin), {
    method: "POST",
    headers: { "x-ledger-token": sortToken(), "content-type": "application/json" },
    body: JSON.stringify({ trigger }),
    signal: AbortSignal.timeout(8_000),
  });
  return res.ok; // background functions answer 202 at once
}
