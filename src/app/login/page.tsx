import { redirect } from "next/navigation";
import { Church, Sparkles, ListMusic, Users, CalendarClock, ShieldCheck } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { BRAND } from "@/lib/brand";
import { LoginForm } from "@/components/LoginForm";

const FEATURES = [
  { icon: <CalendarClock className="h-5 w-5" />, title: "Plan services in minutes", text: "Drag-and-drop order of service with automatic timings." },
  { icon: <Users className="h-5 w-5" />, title: "Smart volunteer scheduling", text: "Auto-schedule respects availability, skills and rest." },
  { icon: <ListMusic className="h-5 w-5" />, title: "Charts, lyrics & media", text: "Transpose chord charts and share rehearsal tracks." },
  { icon: <ShieldCheck className="h-5 w-5" />, title: "Built for every role", text: "From worship pastor to first-time volunteer." },
];

export default async function LoginPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ error?: string; returnTo?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await getSessionUser();
  if (user) redirect("/dashboard");

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* Brand panel */}
      <div className="wf-decor relative flex flex-col justify-between overflow-hidden bg-gradient-to-br from-brand-900 via-brand-800 to-brand-950 px-8 py-10 text-white lg:w-[46%] lg:px-14 lg:py-14">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold-500/15 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gold-500">
              <Church className="h-6 w-6" />
            </span>
            <div>
              <p className="text-xl font-extrabold tracking-tight">{BRAND.name}</p>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-gold-300">Service Suite</p>
            </div>
          </div>
          <h1 className="mt-10 max-w-md text-3xl font-extrabold leading-tight tracking-tight lg:text-4xl">
            {BRAND.tagline}
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-brand-100/85">
            The modern operating system for church worship teams — service planning, volunteer
            scheduling, music and communication in one beautiful, fast workspace.
          </p>
          <div className="mt-10 hidden grid-cols-2 gap-4 sm:grid">
            {FEATURES.map((f) => (
              <div key={f.title} className="rounded-2xl bg-surface/5 p-4 ring-1 ring-white/10">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gold-500/20 text-gold-300">
                  {f.icon}
                </span>
                <p className="mt-3 text-sm font-bold">{f.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-brand-100/70">{f.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Form panel */}
      <div className="flex flex-1 items-center justify-center bg-paper px-6 py-12">
        <div className="w-full max-w-md">
          <h2 className="text-2xl font-extrabold tracking-tight text-ink">Welcome back</h2>
          <p className="mt-1 text-sm text-ink/55">Sign in to your church workspace.</p>
          <div className="mt-6">
            <LoginForm returnTo={searchParams.returnTo || "/dashboard"} />
          </div>
          <p className="mt-6 text-center text-sm text-ink/55">
            New church? <a href="/signup" className="font-bold text-brand-700 hover:underline">Create a free workspace</a>
          </p>
        </div>
      </div>
    </div>
  );
}
