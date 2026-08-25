import { redirect } from "next/navigation";
import Link from "next/link";
import { Church } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";

export default async function SignupPage({ searchParams: searchParamsPromise }: { searchParams: Promise<{ error?: string }> }) {
  const searchParams = await searchParamsPromise;
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-brand-900 to-brand-950 px-4 py-10">
      <div className="w-full max-w-lg">
        <div className="mb-6 flex items-center justify-center gap-3 text-white">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-500">
            <Church className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xl font-extrabold tracking-tight">{BRAND.name}</p>
            <p className="text-xs uppercase tracking-[0.2em] text-gold-300">Create your workspace</p>
          </div>
        </div>

        <div className="card p-7">
          <h1 className="text-xl font-extrabold tracking-tight text-ink">Start your free workspace</h1>
          <p className="mt-1 text-sm text-ink/55">
            We'll set up your first campus, service types and teams — it takes about two minutes.
          </p>

          {searchParams.error === "exists" && (
            <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
              That email already has an account. Try signing in instead.
            </p>
          )}
          {searchParams.error === "invalid" && (
            <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-700">
              Please fill in every field (password must be at least 8 characters).
            </p>
          )}

          <form action="/api/auth/signup" method="post" className="mt-6 space-y-4">
            <div>
              <label htmlFor="orgName" className="label">Church / ministry name</label>
              <input id="orgName" name="orgName" required className="input" placeholder="e.g. Grace Community Church" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="label">Your name</label>
                <input id="name" name="name" required className="input" placeholder="e.g. David Mukisa" />
              </div>
              <div>
                <label htmlFor="email" className="label">Your email</label>
                <input id="email" name="email" type="email" required className="input" placeholder="you@church.org" />
              </div>
            </div>
            <div>
              <label htmlFor="password" className="label">Password (min 8 characters)</label>
              <input id="password" name="password" type="password" required minLength={8} className="input" placeholder="••••••••" />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="timezone" className="label">Time zone</label>
                <select id="timezone" name="timezone" className="input" defaultValue="Africa/Kampala">
                  {TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>{tz}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="currency" className="label">Currency</label>
                <select id="currency" name="currency" className="input" defaultValue="UGX">
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <button type="submit" className="btn-primary w-full">Create workspace</button>
            <p className="text-center text-xs text-ink/45">
              You'll become the Owner and can invite your team in the next step.
            </p>
          </form>
        </div>

        <p className="mt-5 text-center text-sm text-white/70">
          Already have an account?{" "}
          <Link href="/login" className="font-bold text-gold-300 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
