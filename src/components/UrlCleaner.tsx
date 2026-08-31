"use client";

import { useEffect } from "react";

/**
 * After sign-in the app may land on a URL like /dashboard?wf_token=… (the
 * middleware uses that parameter to set the session cookie in cookie-blocked
 * contexts). Once we're rendering, the cookie is in place, so the parameter
 * has done its job — remove it from the address bar. Left in place it gets
 * attached to every router fetch, the middleware rewrites those requests to a
 * different URL, and Next's router then (silently) discards the responses —
 * pages/actions look like nothing happened.
 */
export function UrlCleaner() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (!url.searchParams.has("wf_token")) return;
    url.searchParams.delete("wf_token");
    window.history.replaceState(null, "", url.toString());
  }, []);
  return null;
}
