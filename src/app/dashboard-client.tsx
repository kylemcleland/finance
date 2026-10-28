"use client";

import { useEffect, useRef } from "react";
import type { DashboardData } from "@/lib/dashboard-data";
import { renderDashboard } from "@/dashboard/render";
import "@/dashboard/dashboard.css";

export function DashboardClient({ data }: { data: DashboardData }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) renderDashboard(ref.current, { ...data, reviewHref: "/review" });
  }, [data]);
  return <main ref={ref} className="dash" />;
}
