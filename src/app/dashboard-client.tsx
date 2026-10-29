"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { DashboardData } from "@/lib/dashboard-data";
import { renderDashboard } from "@/dashboard/render";
import "@/dashboard/dashboard.css";

export function DashboardClient({ data }: { data: DashboardData }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderDashboard(ref.current, { ...data, reviewHref: "/review", banksHref: "/banks", categoryHref: "/transactions" });
  }, [data]);
  return (
    <>
      <nav className="dash quicknav" aria-label="Ledger">
        <Link href="/expenses" className="pill">+ Add expense</Link>
        <Link href="/review" className="pill">Review{data.review.count ? ` (${data.review.count})` : ""}</Link>
        <Link href="/banks" className="pill">Banks</Link>
      </nav>
      <main ref={ref} className="dash" />
    </>
  );
}
