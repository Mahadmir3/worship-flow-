import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyPassword, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

// Simple in-memory rate limiter (per-IP). Use Redis in multi-instance prod.
const attempts = new Map<string, { count: number; reset: number }>();

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || rec.reset < now) {
    attempts.set(ip, { count: 1, reset: now + 60_000 });
    return false;
  }
  rec.count++;
  return rec.count > 20;
}

function baseInfo(req: NextRequest) {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (host.includes("localhost") ? "http" : "https");
  const wantsJson = (req.headers.get("accept") || "").includes("application/json");
  return { host, proto, base: `${proto}://${host}`, https: proto === "https", wantsJson };
}

function csrfOk(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return true; // same-origin form posts may omit Origin
  try {
    const originHost = new URL(origin).host;
    const allowed = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter(Boolean);
    return allowed.includes(originHost);
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  const { base, https, wantsJson } = baseInfo(req);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() || "local";
  if (rateLimited(ip)) {
    const body = { error: "Too many attempts. Please wait a minute and try again." };
    return wantsJson
      ? NextResponse.json(body, { status: 429 })
      : NextResponse.redirect(new URL("/login?error=ratelimit", base), 303);
  }

  if (!csrfOk(req)) {
    console.warn("[login] blocked cross-origin POST from", req.headers.get("origin"));
    const body = { error: "Invalid origin" };
    return wantsJson ? NextResponse.json(body, { status: 403 }) : new NextResponse(body.error, { status: 403 });
  }

  const form = await req.formData();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");
  const returnTo = String(form.get("returnTo") || "/dashboard");
  const safeReturn = returnTo.startsWith("/") ? returnTo : "/dashboard";

  const fail = (code: string) =>
    wantsJson
      ? NextResponse.json({ ok: false, error: code }, { status: 401 })
      : NextResponse.redirect(new URL(`/login?error=${code}`, base), 303);

  if (!email || !password) return fail("missing");

  const user = await prisma.user.findUnique({ where: { email }, include: { organization: true } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    console.log(`[login] failed credentials for ${email} from ${ip}`);
    return fail("invalid");
  }

  const token = await createSession(user.id, { thirdParty: https });
  await audit(user.organizationId, user.id, "auth.login", "User", user.id);
  console.log(`[login] ok ${email} → ${safeReturn} (thirdParty cookie: ${https})`);

  if (wantsJson) {
    // Client-side flow: the browser JS decides whether cookies stuck and navigates itself.
    const res = NextResponse.json({ ok: true, redirect: safeReturn, token });
    // Non-httpOnly probe cookie so the client can detect cookie blocking.
    res.cookies.set("wf_probe", "1", { sameSite: https ? "none" : "lax", secure: https, path: "/", maxAge: 60 });
    return res;
  }

  return NextResponse.redirect(new URL(safeReturn, base), 303);
}
