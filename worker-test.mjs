import { PrismaClient } from "@prisma/client";

async function tryQuery(label, buildClient) {
  try {
    const prisma = await buildClient();
    const r = await prisma.$queryRaw`SELECT 1 AS ok`;
    await prisma.$disconnect();
    return { [label]: "OK " + JSON.stringify(r) };
  } catch (e) {
    return { [label]: "FAIL " + String(e && e.message ? e.message : e).slice(0, 150) };
  }
}

export default {
  async fetch(req, env) {
    const out = {};
    // B: dynamic import + env binding
    Object.assign(out, await tryQuery("dyn_env", async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
    }));
    // C: dynamic import + process.env  (EXACT app pattern)
    Object.assign(out, await tryQuery("dyn_processEnv", async () => {
      const { PrismaPg } = await import("@prisma/adapter-pg");
      return new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
    }));
    // E: EXACT db.ts replica incl. captured url
    const url = process.env.DATABASE_URL || "";
    Object.assign(out, await tryQuery("dbts_replica", async () => {
      if (url.startsWith("postgres")) {
        const { PrismaPg } = await import("@prisma/adapter-pg");
        return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }), log: ["error", "warn"] });
      }
      return new PrismaClient({ log: ["error", "warn"] });
    }));
    return Response.json(out);
  },
};
