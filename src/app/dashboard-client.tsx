"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import type { Alert } from "@/lib/alerts";
import { renderDashboard } from "@/dashboard/render";
import "@/dashboard/dashboard.css";

export function DashboardClient({ data, alerts = [] }: { data: DashboardData; alerts?: Alert[] }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderDashboard(ref.current, { ...data, reviewHref: "/review", banksHref: "/banks", categoryHref: "/transactions" });
  }, [data]);
  return (
    <>
      {alerts.length ? (
        <div className="dash alerts" role="status">
          {alerts.map((a) => <Link key={a.text} href={a.href} className="alert">{a.text}</Link>)}
        </div>
      ) : null}
      <nav className="dash quicknav" aria-label="Ledger">
        <Link href="/expenses" className="pill">+ Add expense</Link>
        <Link href="/review" className="pill">Review{data.review.count ? ` (${data.review.count})` : ""}</Link>
        <Link href="/recurring" className="pill">Recurring</Link>
        <Link href="/ask" className="pill">Ask Claude</Link>
        <Link href="/banks" className="pill">Banks</Link>
      </nav>
      <main ref={ref} className="dash" />
    </>
  );
}
