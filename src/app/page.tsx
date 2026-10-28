import { Suspense } from "react";
import { connection } from "next/server";
import { buildDashboardData } from "@/lib/dashboard-data";
import { DashboardClient } from "./dashboard-client";

async function Dashboard() {
  await connection(); // always read the database at request time
  const data = await buildDashboardData();
  return <DashboardClient data={data} />;
}

export default function Page() {
  return (
    <Suspense fallback={<main className="dash">Loading the ledger…</main>}>
      <Dashboard />
    </Suspense>
  );
}
