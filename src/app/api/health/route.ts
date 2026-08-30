import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getPrisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Deployment self-test (safe): reports whether DATABASE_URL is present
 * (value masked — password never shown) and whether the app can reach the
 * database. Used to diagnose the live Cloudflare deployment.
 */
export async function GET() {
  const url = process.env.DATABASE_URL || "";
  const masked = url
    ? url.replace(/\/\/([^:/@]+):([^@]+)@/, "//$1:***@").slice(0, 90)
    : null;

  const out: Record<string, unknown> = {
    time: new Date().toISOString(),
    databaseUrlSet: !!url,
    databaseUrlMasked: masked,
  };

  // Probe A: the app's own lazy client
  try {
    const prisma = await getPrisma();
    await prisma.$queryRaw`SELECT 1 AS ok`;
    out.appClient = "OK";
  } catch (e) {
    const err = e as { message?: string };
    out.appClient = "FAIL " + String(err.message).slice(0, 150);
  }

  // Probe B: adapter wired directly inside this bundle
  try {
    const mod = (await import("@prisma/adapter-pg")) as unknown as {
      PrismaPg: new (o: { connectionString: string }) => object;
    };
    out.prismaPgType = typeof mod.PrismaPg;
    const adapter = new mod.PrismaPg({ connectionString: url });
    const client = new PrismaClient({ adapter } as never);
    const r = (await client.$queryRaw`SELECT 1 AS ok`) as unknown[];
    out.directAdapter = "OK " + JSON.stringify(r);
    await client.$disconnect();
  } catch (e) {
    const err = e as { message?: string };
    out.directAdapter = "FAIL " + String(err.message).slice(0, 150);
  }

  return NextResponse.json(out);
}
