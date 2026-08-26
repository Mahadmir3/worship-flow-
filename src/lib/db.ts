import { PrismaClient } from "@prisma/client";

/**
 * One client, two runtimes:
 *  - PostgreSQL (Supabase) in production / Cloudflare → PrismaPg driver adapter
 *    (no native engine; runs on Workers via nodejs_compat TCP).
 *  - SQLite for the local demo preview (plain engine client).
 * The DATABASE_URL protocol decides. Constructing the Postgres client is async
 * (dynamic adapter import), so the exported `prisma` is a chainable lazy proxy:
 * any property path + call resolves through the client promise, e.g.
 * `await prisma.user.findUnique(...)` works unchanged everywhere.
 */

const globalForPrisma = globalThis as unknown as { prisma?: Promise<PrismaClient> };

function clientPromise(): Promise<PrismaClient> {
  if (!globalForPrisma.prisma) {
    const url = process.env.DATABASE_URL || "";
    globalForPrisma.prisma = (async () => {
      if (url.startsWith("postgres")) {
        const { PrismaPg } = await import("@prisma/adapter-pg");
        return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: ["error", "warn"] });
      }
      return new PrismaClient({ log: ["error", "warn"] });
    })();
  }
  return globalForPrisma.prisma;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyProxy(path: string[] = []): any {
  return new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === "then") return undefined; // never act like a promise itself
      if (typeof prop === "symbol") return undefined;
      return lazyProxy([...path, prop]);
    },
    apply(_t, _thisArg, args) {
      return clientPromise().then((client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = client;
        for (const key of path) value = value?.[key];
        return typeof value === "function" ? value.apply(client, args) : value;
      });
    },
  });
}

export const prisma: PrismaClient = lazyProxy() as PrismaClient;

/** Direct access to the real client when needed (scripts, transactions). */
export function getPrisma(): Promise<PrismaClient> {
  return clientPromise();
}
