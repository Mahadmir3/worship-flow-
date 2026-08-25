import { PrismaClient } from "@prisma/client";

/**
 * One client, two runtimes:
 *  - PostgreSQL (Supabase) in production / Cloudflare → uses the PrismaPg driver
 *    adapter (no native engine, Workers-compatible over nodejs_compat TCP).
 *  - SQLite for the local demo preview (no adapter needed).
 * The URL protocol decides.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

async function makeClient(): Promise<PrismaClient> {
  const url = process.env.DATABASE_URL || "";
  if (url.startsWith("postgres")) {
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const adapter = new PrismaPg({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error", "warn"] });
  }
  return new PrismaClient({ log: ["error", "warn"] });
}

/** Await this everywhere — e.g. `const prisma = await getPrisma()`. */
export async function getPrisma(): Promise<PrismaClient> {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = await makeClient();
  return globalForPrisma.prisma;
}

/**
 * Back-compat: many modules import { prisma } directly. On SQLite (local demo)
 * we can construct synchronously; on Postgres the import is async, so this
 * synchronous proxy lazily awaits the promise behind every call.
 */
export const prisma: PrismaClient = new Proxy({} as PrismaClient, {
  get(_t, prop, receiver) {
    if (!globalForPrisma.prisma) globalForPrisma.prisma = makeClient();
    const pending = globalForPrisma.prisma;
    const value = (pending as unknown as Record<string | symbol, unknown>)[prop];
    if (typeof value === "function") {
      const fn = value as (...args: unknown[]) => unknown;
      return (...args: unknown[]) => {
        const call = () => fn.apply(pending as unknown as object, args);
        return typeof (pending as unknown as Promise<unknown>).then === "function"
          ? (pending as unknown as Promise<PrismaClient>).then((c) =>
              (c as unknown as Record<string | symbol, (...a: unknown[]) => unknown>)[prop](...args)
            )
          : call();
      };
    }
    return value;
  },
}) as PrismaClient;

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = globalForPrisma.prisma;
