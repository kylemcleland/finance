import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { env } from "./env";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function create() {
  if (!env.databaseUrl) {
    throw new Error("No database configured. Set DATABASE_URL (or deploy with Netlify DB, which sets NETLIFY_DB_URL).");
  }
  return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.databaseUrl, max: 5 }) });
}

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = create();
  return globalForPrisma.prisma;
}

/**
 * Created on first use rather than at import, so `next build` can load route
 * modules without a database URL (Netlify only provides it at runtime).
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
