import { cache } from "react";
import { PrismaClient } from "@prisma/client";

/**
 * One client, two runtimes:
 *  - PostgreSQL (Supabase) in production / Cloudflare → PrismaPg driver adapter
 *    (no native engine; runs on Workers via nodejs_compat TCP).
 *  - SQLite for the local demo preview (plain engine client).
 *
 * Workers caveats (learned the hard way):
 *  1. Sockets do not survive isolate suspension — a connection reused across
 *     requests can hang forever. We therefore create a per-request pool
 *     (React cache) so nothing is shared between requests.
 *  2. Opening a fresh TLS connection per query is slow (~300-700ms each).
 *     Within a request all queries now share ONE pooled connection, and:
 *       - idleTimeoutMillis closes the socket seconds after the request ends
 *         (nothing lingers long enough to die silently), and
 *       - connectionTimeoutMillis guarantees a fast error instead of a hang
 *         in the worst case.
 */

function createClient(): Promise<PrismaClient> {
  return (async () => {
    const url = process.env.DATABASE_URL || "";
    if (url.startsWith("postgres")) {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      // Pool tuning via PrismaPg's config (it wires TLS correctly for workerd —
      // do NOT pass a hand-built Pool with an ssl object):
      //  - max 10: queries within one request run in PARALLEL (a Promise.all
      //    of 12 queries needs more than one wire, otherwise they queue
      //    single-file and the page crawls)
      //  - idleTimeoutMillis: sockets close seconds after the request ends,
      //    so nothing lingers to die silently across isolate suspensions
      //  - connectionTimeoutMillis: fast error instead of an infinite hang
      return new PrismaClient({
        adapter: new PrismaPg({
          connectionString: url,
          max: 10,
          idleTimeoutMillis: 10_000,
          connectionTimeoutMillis: 8_000,
        }),
        log: ["error", "warn"],
      });
    }
    return new PrismaClient({ log: ["error", "warn"] });
  })();
}

// Per-request singleton (React cache): repeated calls in the same render/action
// share one client+connection, but nothing is reused across requests.
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
