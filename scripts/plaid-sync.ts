/**
 * Pull transactions for every linked bank with /transactions/sync, resuming
 * from the stored cursor. Re-runnable.
 *
 *   npm run plaid:sync
 */
import { prisma } from "@/lib/db";
import { syncPlaid } from "@/lib/sync";

syncPlaid(console.log)
  .then((r) => {
    if (r.items === 0) console.log("No linked banks. Run: npm run plaid:link");
    else console.log(`${r.items} bank(s): +${r.added} ~${r.modified} -${r.removed}\nNext: npm run classify`);
  })
  .catch((e) => { console.error(e?.response?.data ?? e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
