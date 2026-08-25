"use client";

import { useEffect } from "react";

/**
 * SessionKeepAlive — compatibility shim for cookie-blocked contexts.
 *
 * Normal browsers keep the session in an httpOnly cookie and this component
 * does nothing. But in embedded previews / strict browsers where cookies are
 * blocked entirely, the session travels as `?wf_token=…`. This shim keeps the
 * token attached to every client-side navigation, RSC fetch, server action,
 * JSON API call, link click and form submit — so the session never drops.
 */
export function SessionKeepAlive() {
  useEffect(() => {
    let token: string | null = null;
    try {
      token = new URLSearchParams(window.location.search).get("wf_token");
    } catch {}
    if (!token) {
      try {
        token = sessionStorage.getItem("wf_token");
      } catch {}
    }
    if (!token) return; // cookie mode — stay dormant
    try {
      sessionStorage.setItem("wf_token", token);
    } catch {}

    const withToken = (rawUrl: string): string | null => {
      try {
        if (!rawUrl || rawUrl.startsWith("#")) return null;
        if (rawUrl.startsWith("/_next/")) return null;
        if (/^(https?:)?\/\//i.test(rawUrl) || rawUrl.startsWith("mailto:") || rawUrl.startsWith("tel:")) {
          const u = new URL(rawUrl, window.location.href);
          if (u.origin !== window.location.origin) return null;
        }
        const u = new URL(rawUrl, window.location.href);
        if (u.searchParams.has("wf_token")) return null;
        u.searchParams.set("wf_token", token!);
        return u.pathname + u.search + (u.hash || "");
      } catch {
        return null;
      }
    };

    // 1) Patch fetch — covers Next router navigations, server actions, JSON APIs
    const origFetch = window.fetch.bind(window);
    (window as unknown as { fetch: typeof fetch }).fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      try {
        const raw: string | undefined =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input instanceof Request
                ? input.url
                : undefined;
        if (raw) {
          const patched = withToken(raw);
          if (patched) {
            if (input instanceof Request) {
              input = new Request(patched, input);
            } else {
              input = patched;
            }
          }
        }
      } catch {}
      return origFetch(input, init);
    };

    // 2) Anchor clicks (full-page loads): rewrite href before navigation
    const onClick = (e: MouseEvent) => {
      try {
        const target = e.target as HTMLElement | null;
        const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
        if (!anchor) return;
        const href = anchor.getAttribute("href");
        if (!href) return;
        const patched = withToken(href);
        if (patched) anchor.setAttribute("href", patched);
      } catch {}
    };
    document.addEventListener("click", onClick, true);

    // 3) Form submits: inject the token as a hidden field (GET searches, logout, uploads)
    const onSubmit = (e: SubmitEvent) => {
      try {
        const form = e.target as HTMLFormElement | null;
        if (!form || form.querySelector('input[name="wf_token"]')) return;
        const action = form.getAttribute("action") || window.location.pathname;
        if (/^https?:\/\//i.test(action)) {
          const u = new URL(action);
          if (u.origin !== window.location.origin) return;
        }
        const hidden = document.createElement("input");
        hidden.type = "hidden";
        hidden.name = "wf_token";
        hidden.value = token!;
        form.appendChild(hidden);
      } catch {}
    };
    document.addEventListener("submit", onSubmit, true);

    // 4) Keep the token in the address bar so refreshes stay authenticated
    const origPush = history.pushState.bind(history);
    history.pushState = (data, unused, url) => {
      const patched = typeof url === "string" ? withToken(url) : null;
      return origPush(data, unused, patched || (url as never));
    };
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (data, unused, url) => {
      const patched = typeof url === "string" ? withToken(url) : null;
      return origReplace(data, unused, patched || (url as never));
    };

    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
      (window as unknown as { fetch: typeof fetch }).fetch = origFetch;
      history.pushState = origPush;
      history.replaceState = origReplace;
    };
  }, []);

  return null;
}
