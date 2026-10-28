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

export const prisma = globalForPrisma.prisma ?? create();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
