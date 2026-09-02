import Link from "next/link";
import { ArrowLeft, CalendarPlus, Church, Info, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { addMinutes, todayIn } from "@/lib/format";
import { canDo } from "@/lib/perms";
import { createService } from "@/actions/services";
import { EmptyState } from "@/components/ui/primitives";

export const metadata = { title: "New event" };

function nextSunday(from: string): string {
  const d = new Date(from + "T12:00:00Z");
  const diff = (0 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export default async function NewServicePage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const presetDate = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  const user = await requireUser();
  const allowed = await canDo(user, "manage_services");

  if (!allowed) {
    return (
      <div className="card">
        <EmptyState
          icon={<Church className="h-6 w-6" />}
          title="You need rights to create events"
          hint="Only an administrator can grant event-creation rights. Ask your admin to enable “Create & edit events” for you under Settings → Roles & permissions."
          action={<Link href="/services" className="btn-primary">Back to events</Link>}
        />
      </div>
    );
  }

  const [types, campuses, venues, people, folders, teams] = await Promise.all([
    prisma.serviceType.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.campus.findMany({ where: { organizationId: user.organizationId } }),
    prisma.venue.findMany({ include: { campus: true } }),
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.eventFolder.findMany({ where: { organizationId: user.organizationId }, orderBy: { sortOrder: "asc" } }),
    prisma.team.findMany({ where: { organizationId: user.organizationId }, include: { positions: true } }),
  ]);

  const today = todayIn(user.organization.timezone);
  const worship = teams.find((t) => t.category === "WORSHIP");
  const production = teams.find((t) => t.category === "PRODUCTION");

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All events
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white">
          <CalendarPlus className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Create an event</h1>
          <p className="mt-0.5 text-sm text-ink/50">Set the essentials now — you can build the full plan right after.</p>
        </div>
      </div>

      <form action={createService} className="space-y-6">
        {/* Basics */}
        <fieldset className="card p-6">
          <legend className="sr-only">Basics</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="n-type">Event type</label>
              <select id="n-type" name="typeId" className="input" required defaultValue={types[0]?.id}>
                {types.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="n-folder">Folder</label>
              <select id="n-folder" name="folderId" className="input" defaultValue={folders[0]?.id || ""}>
                <option value="">— Unfiled —</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="n-title">Title <span className="normal-case text-ink/35">(optional — the type name is used otherwise)</span></label>
              <input id="n-title" name="title" className="input" placeholder="e.g. Thanksgiving Sunday" />
            </div>
            <div>
              <label className="label" htmlFor="n-date">Date</label>
              <input id="n-date" name="date" type="date" required className="input" defaultValue={presetDate || nextSunday(today)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="n-start">Start</label>
                <input id="n-start" name="startTime" type="time" className="input" defaultValue={types[0]?.defaultStart || "09:00"} />
              </div>
              <div>
                <label className="label" htmlFor="n-dur">Minutes</label>
                <input id="n-dur" name="durationMin" type="number" min={15} max={600} className="input" defaultValue={types[0]?.defaultDurationMin || 120} />
              </div>
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="label" htmlFor="n-repeat">Repeats</label>
                <select id="n-repeat" name="repeat" className="input" defaultValue="">
                  <option value="">No — one day only</option>
                  <option value="7">Every week</option>
                  <option value="14">Every 2 weeks</option>
                  <option value="28">Every 4 weeks</option>
                </select>
              </div>
              <div>
                <label className="label" htmlFor="n-until">Repeat until</label>
                <input id="n-until" name="repeatUntil" type="date" className="input" />
              </div>
            </div>
            <p className="mt-2 text-xs text-ink/50">
              Example: “Every week” + an end date creates this event on every week until then — no need to add them one by one.
            </p>
          </div>
        </fieldset>

        {/* Place */}
        <fieldset className="card p-6">
          <legend className="sr-only">Where</legend>
          <p className="mb-4 text-sm font-bold text-ink">Where</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="n-campus">Campus</label>
              <select id="n-campus" name="campusId" className="input" defaultValue={campuses[0]?.id}>
                {campuses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="n-venue">Venue</label>
              <select id="n-venue" name="venueId" className="input">
                <option value="">— none —</option>
                {venues.map((v) => (
                  <option key={v.id} value={v.id}>{v.name} · {v.campus.name}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Leaders */}
        <fieldset className="card p-6">
          <legend className="sr-only">Leaders</legend>
          <p className="mb-4 text-sm font-bold text-ink">Service team leads</p>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="n-wl">Worship leader</label>
              <select id="n-wl" name="worshipLeaderId" className="input">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="n-preacher">Preacher</label>
              <select id="n-preacher" name="preacherId" className="input">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="n-leader">Service leader</label>
              <select id="n-leader" name="serviceLeaderId" className="input">
                <option value="">—</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </fieldset>

        {/* Theme */}
        <fieldset className="card p-6">
          <legend className="sr-only">Theme</legend>
          <p className="mb-4 text-sm font-bold text-ink">Theme &amp; focus</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="n-theme">Theme</label>
              <input id="n-theme" name="theme" className="input" placeholder="e.g. God of Wonders" />
            </div>
            <div>
              <label className="label" htmlFor="n-scripture">Scripture</label>
              <input id="n-scripture" name="scripture" className="input" placeholder="e.g. Psalm 19:1" />
            </div>
            <div className="sm:col-span-2">
              <label className="label" htmlFor="n-notes">Notes</label>
              <textarea id="n-notes" name="notes" rows={3} className="input" placeholder="Anything the team should know…" />
            </div>
          </div>
        </fieldset>

        {/* Positions */}
        <div className="card p-6">
          <p className="text-sm font-bold text-ink">Volunteer positions</p>
          <p className="mt-1 text-xs text-ink/50">
            Pre-create open positions so you can schedule people immediately after creating the event.
          </p>
          <div className="mt-4 space-y-2.5">
            {[
              { team: worship, label: `${worship?.name ?? "Worship team"} (${worship?.positions.length ?? 0} positions)` },
              { team: production, label: `${production?.name ?? "Production team"} (${production?.positions.length ?? 0} positions)` },
            ].map(({ team, label }) => (
              <label key={label} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-paper/50 px-4 py-3">
                <span className="text-sm font-semibold text-ink">{label}</span>
                <input
                  type="checkbox"
                  name="seedPositions"
                  value={team?.id}
                  defaultChecked={!!team}
                  className="h-5 w-5 rounded"
                />
              </label>
            ))}
          </div>
          <input type="hidden" name="redirectTo" value="" />
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-brand-50 px-4 py-3 text-xs leading-relaxed text-brand-800">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            After creating, you'll land on the event page where you can build the order of service, use Auto Schedule for the team, and share it on WhatsApp.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn-primary"><Sparkles className="h-4 w-4" /> Create event</button>
          <Link href="/services" className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
