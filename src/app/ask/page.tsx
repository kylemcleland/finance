import Link from "next/link";
import { AskChat } from "./chat";
import "@/dashboard/dashboard.css";

export default function AskPage() {
  return (
    <main className="dash">
      <header className="head">
        <div className="eyebrow">Household ledger</div>
        <h1>Ask Claude</h1>
        <div className="sub"><Link href="/">Back to the ledger</Link></div>
      </header>
      <AskChat />
    </main>
  );
}
