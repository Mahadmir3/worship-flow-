import Link from "next/link";
import { CheckCircle2, Church, ListMusic, Mic2, Plus, Rocket, Sparkles, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { Card } from "@/components/ui/primitives";
import { completeOnboardingStep } from "@/actions/settings";
import { createService } from "@/actions/services";
import { createPerson } from "@/actions/teams";
import { createSong } from "@/actions/songs";

export const metadata = { title: "Welcome — guided setup" };

export default async function OnboardingPage() {
  const user = await requireUser();
  const org = await prisma.organization.findUnique({
    where: { id: user.organizationId },
    include: {
      campuses: true,
      serviceTypes: true,
      teams: true,
      people: true,
      songs: { take: 4 },
      services: { take: 4 },
    },
  });
  if (!org) return null;

  const steps = [
    { id: "church", label: "Church information", done: org.name !== "My Church" && !!org.timezone, icon: Church },
    { id: "campus", label: "Campus", done: org.campuses.length > 0, icon: Church },
    { id: "types", label: "Service types", done: org.serviceTypes.length > 0, icon: Sparkles },
    { id: "teams", label: "Teams", done: org.teams.length > 0, icon: Users },
    { id: "people", label: "Import people", done: org.people.length > 1, icon: Mic2 },
    { id: "songs", label: "Add songs", done: org.songs.length > 0, icon: ListMusic },
    { id: "service", label: "First service", done: org.services.length > 0, icon: Plus },
    { id: "invite", label: "Invite volunteers", done: org.people.length > 2, icon: Users },
  ];
  const nextStep = steps.find((s) => !s.done);
  const allDone = steps.every((s) => s.done);

  const firstCampus = org.campuses[0];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="text-center">
        <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-500 text-white">
          <Rocket className="h-7 w-7" />
        </span>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
          Welcome to WorshipFlow, {user.name.split(" ")[0]}
        </h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/55">
          Let's set up <b>{org.name}</b> step by step. Each step saves immediately — you can come back anytime.
        </p>
      </div>

      <div className="flex items-center justify-center gap-1.5">
        {steps.map((s) => (
          <span
            key={s.id}
            className={`h-2 rounded-full transition-all ${s.done ? "w-8 bg-emerald-500" : nextStep?.id === s.id ? "w-8 bg-gold-500" : "w-4 bg-brand-100"}`}
            aria-label={`${s.label}: ${s.done ? "complete" : "pending"}`}
          />
        ))}
      </div>

      {/* Step: church info */}
      <StepCard step={1} title="Church information" icon={<Church className="h-5 w-5" />} done={steps[0].done}>
        <form action={completeOnboardingStep} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="step" value="church" />
          <div className="sm:col-span-3">
            <label className="label" htmlFor="ob-church">Church name</label>
            <input id="ob-church" name="name" defaultValue={org.name} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ob-tz">Time zone</label>
            <select id="ob-tz" name="timezone" defaultValue={org.timezone} className="input">
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>{tz}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="label" htmlFor="ob-cur">Currency</label>
            <select id="ob-cur" name="currency" defaultValue={org.currency} className="input">
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-3">
            <button className="btn-primary">Save church information</button>
          </div>
        </form>
      </StepCard>

      {/* Step: campus */}
      <StepCard step={2} title="Your first campus" icon={<Church className="h-5 w-5" />} done={steps[1].done}>
        {org.campuses.length > 0 ? (
          <p className="text-sm text-ink/60">
            <b>{org.campuses.map((c) => c.name).join(", ")}</b> — add more later in Settings → Organization.
          </p>
        ) : (
          <form action={completeOnboardingStep} className="grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="step" value="campus" />
            <div className="sm:col-span-2">
              <label className="label" htmlFor="ob-campus">Campus name</label>
              <input id="ob-campus" name="name" required className="input" placeholder="e.g. Main Campus" />
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary">Create campus</button>
            </div>
          </form>
        )}
      </StepCard>

      {/* Step: types & teams summary */}
      <StepCard step={3} title="Service types & teams" icon={<Users className="h-5 w-5" />} done={steps[2].done && steps[3].done}>
        <p className="text-sm leading-relaxed text-ink/60">
          We pre-created <b>{org.serviceTypes.length} service types</b> (Sunday morning, midweek, youth…) and{" "}
          <b>{org.teams.length} teams</b> with standard positions. Customise them anytime under Services and Teams.
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {org.teams.map((t) => (
            <span key={t.id} className="chip border-brand-100 bg-brand-50 text-brand-700">{t.name}</span>
          ))}
        </div>
      </StepCard>

      {/* Step: people */}
      <StepCard step={5} title="Add your people" icon={<Mic2 className="h-5 w-5" />} done={steps[4].done}>
        <form action={createPerson} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ob-pname">Name</label>
            <input id="ob-pname" name="name" required className="input" placeholder="e.g. Sarah Nakato" />
          </div>
          <div>
            <label className="label" htmlFor="ob-pemail">Email</label>
            <input id="ob-pemail" name="email" type="email" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="ob-pskills">Skills</label>
            <input id="ob-pskills" name="skills" className="input" placeholder="e.g. Vocals, Keys" />
          </div>
          <div>
            <label className="label" htmlFor="ob-pteam">Team</label>
            <select id="ob-pteam" name="teamId" className="input">
              <option value="">—</option>
              {org.teams.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </div>
          <div className="sm:col-span-2">
            <button className="btn-secondary">Add person</button>
            <span className="ml-3 text-xs text-ink/45">{org.people.length} added so far</span>
          </div>
        </form>
      </StepCard>

      {/* Step: songs */}
      <StepCard step={6} title="Add your first songs" icon={<ListMusic className="h-5 w-5" />} done={steps[5].done}>
        <form action={createSong} className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="ob-song">Title</label>
            <input id="ob-song" name="title" required className="input" placeholder="e.g. Way Maker" />
          </div>
          <div>
            <label className="label" htmlFor="ob-songkey">Key</label>
            <input id="ob-songkey" name="defaultKey" className="input" placeholder="e.g. G" />
          </div>
          <div className="sm:col-span-2">
            <button className="btn-secondary">Add song</button>
            <span className="ml-3 text-xs text-ink/45">{org.songs.length} in library</span>
          </div>
        </form>
      </StepCard>

      {/* Step: first service */}
      <StepCard step={7} title="Create your first service" icon={<Plus className="h-5 w-5" />} done={steps[6].done}>
        {org.services.length > 0 ? (
          <p className="text-sm text-ink/60">
            <Link href={`/services/${org.services[0].id}`} className="font-bold text-brand-700 hover:underline">
              {org.services[0].title}
            </Link>{" "}
            is ready — open it to build the plan and schedule teams.
          </p>
        ) : (
          <form action={createService} className="grid gap-4 sm:grid-cols-3">
            <input type="hidden" name="date" defaultValue={nextSundayISO()} />
            <input type="hidden" name="startTime" defaultValue="09:00" />
            <input type="hidden" name="durationMin" defaultValue="120" />
            {firstCampus && <input type="hidden" name="campusId" value={firstCampus.id} />}
            {org.serviceTypes[0] && <input type="hidden" name="typeId" value={org.serviceTypes[0].id} />}
            <div className="sm:col-span-3 rounded-2xl bg-paper px-4 py-3 text-sm text-ink/65">
              We'll create <b>{org.serviceTypes[0]?.name || "a Sunday service"}</b> for this coming Sunday at 9:00 AM
              with open positions from your teams.
            </div>
            <div className="sm:col-span-3">
              <button className="btn-primary" name="seedPositions" value="on">Create service</button>
            </div>
          </form>
        )}
      </StepCard>

      <div className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <p className="font-bold text-ink">{allDone ? "You're all set! 🎉" : "Ready to jump in?"}</p>
          <p className="mt-0.5 text-sm text-ink/55">
            {allDone
              ? "Your workspace is configured. Invite your volunteers and start planning."
              : "You can finish the remaining steps later from Settings."}
          </p>
        </div>
        <form action={completeOnboardingStep}>
          <input type="hidden" name="step" value="finish" />
          <button className="btn-gold"><Rocket className="h-4 w-4" /> {allDone ? "Go to dashboard" : "Finish setup"}</button>
        </form>
      </div>
    </div>
  );
}

function StepCard({
  step,
  title,
  icon,
  done,
  children,
}: {
  step: number;
  title: string;
  icon: React.ReactNode;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center gap-3">
        <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${done ? "bg-emerald-500 text-white" : "bg-brand-700 text-white"}`}>
          {done ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </span>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-ink/40">Step {step}</p>
          <h2 className="font-bold text-ink">{title}</h2>
        </div>
        {done && <span className="ml-auto chip border-emerald-200 bg-emerald-50 text-emerald-600">Done</span>}
      </div>
      {children}
    </Card>
  );
}

function nextSundayISO(): string {
  const d = new Date();
  const diff = (0 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}
