import { NextRequest, NextResponse } from "next/server";

/**
 * Session-token exchange for cookie-blocked contexts (embedded previews,
 * strict Safari ITP). If a request arrives with ?wf_token=..., promote it to
 * the session cookie for this request AND set it as a real cookie for the
 * future, so navigation keeps working wherever cookies are allowed.
 */
export function middleware(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("wf_token");
  if (!token) return NextResponse.next();

  const headers = new Headers(req.headers);
  const existing = req.cookies.get("wf_session")?.value;
  if (existing !== token) {
    headers.set("cookie", `wf_session=${token}`);
  }

  // Strip the token from the visible URL via rewrite (response cookie carries it onward).
  const url = req.nextUrl.clone();
  url.searchParams.delete("wf_token");

  const res = NextResponse.rewrite(url, { request: { headers } });
  res.cookies.set("wf_session", token, {
    httpOnly: true,
    sameSite: "none",
    secure: true,
    path: "/",
    maxAge: 30 * 86400,
  });
  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-512.png|manifest.webmanifest|sw.js|uploads/).*)"],
};
