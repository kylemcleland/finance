import { Suspense } from "react";
import { connection } from "next/server";
import { buildDashboardData } from "@/lib/dashboard-data";
import { buildAlerts } from "@/lib/alerts";
import { DashboardClient } from "./dashboard-client";
import { requireSession } from "@/lib/session";

async function Dashboard() {
  await connection(); // always read the database at request time
  await requireSession(); // the proxy also checks, but pages must not rely on it alone
  const [data, alerts] = await Promise.all([buildDashboardData(), buildAlerts()]);
  return <DashboardClient data={data} alerts={alerts} />;
}

export default function Page() {
  return (
    <Suspense fallback={<main className="dash">Loading the ledger…</main>}>
      <Dashboard />
    </Suspense>
  );
}
