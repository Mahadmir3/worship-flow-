"use client";

import { useState } from "react";
import { Loader2, LogIn } from "lucide-react";

/**
 * Fetch-based login: avoids full-page POST/303 redirect quirks in embedded
 * previews, detects cookie blocking, and falls back to a URL session token
 * (?wf_token=…) exchanged by middleware when cookies aren't allowed.
 */
export function LoginForm({ returnTo }: { returnTo: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function login(body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { Accept: "application/json" },
        body: new URLSearchParams({ ...body, returnTo }),
      });
      const json = await res.json().catch(() => ({}) as any);
      if (!res.ok || !json.ok) {
        const code = json?.error || "invalid";
        setError(
          code === "ratelimit"
            ? "Too many attempts — please wait a minute and try again."
            : code === "missing"
              ? "Please enter both email and password."
              : "Incorrect email or password. Please try again."
        );
        setBusy(false);
        return;
      }
      // Did the browser store our non-httpOnly probe cookie?
      const cookiesWork = document.cookie.split(";").some((c) => c.trim().startsWith("wf_probe="));
      const sep = json.redirect.includes("?") ? "&" : "?";
      const target = cookiesWork
        ? json.redirect
        : `${json.redirect}${sep}wf_token=${encodeURIComponent(json.token)}`;
      window.location.assign(target);
    } catch {
      setError("Network problem — please try again.");
      setBusy(false);
    }
  }

  return (
    <>
      {error && (
        <p role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
          {error}
        </p>
      )}
      <form
        className="card space-y-4 p-6"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          login({ email: String(fd.get("email") || ""), password: String(fd.get("password") || "") });
        }}
      >
        <div>
          <label htmlFor="email" className="label">Email</label>
          <input id="email" name="email" type="email" required autoComplete="email" className="input" placeholder="you@church.org" />
        </div>
        <div>
          <label htmlFor="password" className="label">Password</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" className="input" placeholder="••••••••" />
        </div>
        <button type="submit" disabled={busy} className="btn-primary w-full">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogIn className="h-4 w-4" />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </>
  );
}
