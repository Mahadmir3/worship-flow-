import { cache } from "react";
import { PrismaClient } from "@prisma/client";

/**
 * One client, two runtimes:
 *  - PostgreSQL (Supabase) in production / Cloudflare → PrismaPg driver adapter
 *    (no native engine; runs on Workers via nodejs_compat TCP).
 *  - SQLite for the local demo preview (plain engine client).
 *
 * Workers caveat (learned the hard way): sockets do not survive isolate
 * suspension, so a pooled connection reused across requests hangs forever.
 * Per the OpenNext Cloudflare docs we therefore use `maxUses: 1` (one fresh
 * connection per query) and a per-request client (React cache()) — never a
 * global one. The exported `prisma` stays a chainable lazy proxy so call
 * sites are unchanged in both runtimes.
 */

function createClient(): Promise<PrismaClient> {
  return (async () => {
    const url = process.env.DATABASE_URL || "";
    if (url.startsWith("postgres")) {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaClient({
        adapter: new PrismaPg({ connectionString: url, maxUses: 1 }),
        log: ["error", "warn"],
      });
    }
    return new PrismaClient({ log: ["error", "warn"] });
  })();
}

// Per-request singleton (React cache): repeated calls in the same render/action
// share one client, but nothing is reused across requests.
export const getPrisma = cache(createClient);

// Preview-only convenience: a stable client for the SQLite demo/seed scripts.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export function getLocalPrisma(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = new PrismaClient();
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
      return getPrisma().then((client) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let value: any = client;
        for (const key of path) value = value?.[key];
        return typeof value === "function" ? value.apply(client, args) : value;
      });
    },
  });
}

export const prisma: PrismaClient = lazyProxy() as PrismaClient;
