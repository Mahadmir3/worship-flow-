import { NextResponse } from "next/server";
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

  let db: unknown = { ok: false, error: "DATABASE_URL not set" };
  if (url) {
    try {
      const prisma = await getPrisma();
      const started = Date.now();
      await prisma.$queryRaw`SELECT 1 AS ok`;
      db = { ok: true, ms: Date.now() - started };
    } catch (e) {
      const err = e as { message?: string; code?: string };
      db = { ok: false, code: err.code ?? null, error: String(err.message ?? e).slice(0, 300) };
    }
  }

  return NextResponse.json({
    time: new Date().toISOString(),
    databaseUrlSet: !!url,
    databaseUrlMasked: masked,
    db,
  });
}
