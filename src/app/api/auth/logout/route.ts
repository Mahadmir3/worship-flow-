import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { destroySession } from "@/lib/auth";

export async function POST(req: NextRequest) {
  // Cookie-based session (normal browsers)
  await destroySession();

  // Token-based session (cookie-blocked contexts) — read from form or query
  let token: string | null = null;
  try {
    const form = await req.formData();
    token = (form.get("wf_token") as string) || null;
  } catch {}
  if (!token) token = req.nextUrl.searchParams.get("wf_token");
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
  }

  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (host.includes("localhost") ? "http" : "https");
  const res = NextResponse.redirect(new URL("/login", `${proto}://${host}`), 303);
  res.cookies.delete("wf_session");
  return res;
}
