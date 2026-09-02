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
    let url = process.env.DATABASE_URL || "";
    // Prefer Hyperdrive when available (production on Cloudflare): it keeps
    // warm pooled connections to the database so requests skip the slow
    // TLS+auth handshake to Europe on every query.
    try {
      const { getCloudflareContext } = await import("@opennextjs/cloudflare");
      const { env } = await getCloudflareContext({ async: true });
      const cs = (env as { HYPERDRIVE?: { connectionString?: string } })?.HYPERDRIVE?.connectionString;
      if (cs) url = cs;
    } catch {
      // not on Cloudflare (local dev/preview) — fall back to DATABASE_URL
    }
    if (url.startsWith("postgres")) {
      const { PrismaPg } = await import("@prisma/adapter-pg");
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
      const run = () =>
        getPrisma().then((client) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          let value: any = client;
          for (const key of path) value = value?.[key];
          return typeof value === "function" ? value.apply(client, args) : value;
        });
      return run().catch((err: unknown) => {
        // The Supabase pooler very rarely drops an idle connection mid-request
        // ("Connection closed." / "Network connection lost"). Reads are safe to
        // retry once after a beat — that heals the blip instead of showing an
        // error page. Writes are NOT retried (could double-apply).
        const op = path[path.length - 1];
        const msg = err instanceof Error ? err.message : String(err);
        const read =
          /^(findMany|findFirst|findUnique|findUniqueOrThrow|findFirstOrThrow|count|aggregate|groupBy|\$queryRaw|\$queryRawUnsafe)$/.test(op);
        const conn = /Connection closed|Network connection lost|Connection terminated|ECONNRESET|Connection ended/i.test(msg);
        if (read && conn) {
          return new Promise((resolve, reject) =>
            setTimeout(() => run().then(resolve, reject), 350)
          );
        }
        throw err;
      });
    },
  });
}

export const prisma: PrismaClient = lazyProxy() as PrismaClient;
