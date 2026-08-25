import Link from "next/link";
import { Music4, Plus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo, hasGrantOrAdmin, ledTeams } from "@/lib/perms";
import { fmtDurationRange, relativeDay, todayIn } from "@/lib/format";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createRehearsal } from "@/actions/rehearsals";

export const metadata = { title: "Rehearsals" };

export default async function RehearsalsPage() {
  const user = await requireUser();
  const today = todayIn(user.organization.timezone);

  const [rehearsals, services, locations0] = await Promise.all([
    prisma.rehearsal.findMany({
      where: { organizationId: user.organizationId },
      include: { service: true, songs: true, members: true, team: { select: { name: true } } },
      orderBy: { date: "asc" },
    }),
    prisma.service.findMany({
      where: { organizationId: user.organizationId, date: { gte: today } },
      orderBy: { date: "asc" },
    }),
    prisma.venue.findMany({ include: { campus: true } }),
  ]);

  const upcoming = rehearsals.filter((r) => r.date >= today);
  const past = rehearsals.filter((r) => r.date < today).reverse().slice(0, 6);
  const manage = await canDo(user, "manage_rehearsals");
  // Leaders may only book rehearsals for their own teams; admins/grant holders for any.
  const wide = await hasGrantOrAdmin(user, "manage_rehearsals");
  const teamOptions = wide
    ? await prisma.team.findMany({ where: { organizationId: user.organizationId }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : await ledTeams(user);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Rehearsals</h1>
          <p className="mt-1 text-sm text-ink/50">{upcoming.length} upcoming · {past.length} recent</p>
        </div>
        {manage && (
          <Modal
            title="Create a rehearsal"
            trigger={<button className="btn-primary"><Plus className="h-4 w-4" /> New rehearsal</button>}
          >
            <form action={createRehearsal} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="rh-title">Title</label>
                  <input id="rh-title" name="title" required className="input" defaultValue="Band Rehearsal" />
                </div>
                <div>
                  <label className="label" htmlFor="rh-service">For service</label>
                  <select id="rh-service" name="serviceId" className="input">
                    <option value="">—</option>
                    {services.map((s) => (
                      <option key={s.id} value={s.id}>{s.title} · {s.date}</option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="label" htmlFor="rh-team">Team {wide ? "(optional)" : "(your team)"}</label>
                  <select id="rh-team" name="teamId" className="input" required={!wide}>
                    {wide && <option value="">— no specific team —</option>}
                    {teamOptions.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div>
                  <label className="label" htmlFor="rh-date">Date</label>
                  <input id="rh-date" name="date" type="date" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="rh-start">Start</label>
                  <input id="rh-start" name="startTime" type="time" className="input" defaultValue="18:00" />
                </div>
                <div>
                  <label className="label" htmlFor="rh-dur">Duration (min)</label>
                  <input id="rh-dur" name="durationMin" type="number" className="input" defaultValue={90} />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="rh-loc">Location</label>
                <input id="rh-loc" name="location" className="input" placeholder="e.g. Main Auditorium" />
              </div>
              <div>
                <label className="label" htmlFor="rh-obj">Objectives</label>
                <textarea id="rh-obj" name="objectives" rows={2} className="input" placeholder="e.g. Lock transitions, teach new song" />
              </div>
              <button className="btn-primary w-full">Create rehearsal</button>
            </form>
          </Modal>
        )}
      </div>

      {upcoming.length === 0 && past.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Music4 className="h-6 w-6" />} title="No rehearsals yet" hint="Schedule band practice, link it to a service, and track song readiness." />
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            {upcoming.map((r) => {
              const ready = r.songs.filter((s) => s.status === "READY").length;
              return (
                <Link key={r.id} href={`/rehearsals/${r.id}`} className="card flex flex-col gap-3 p-5 transition hover:border-brand-300 hover:shadow-pop">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-brand-600">{relativeDay(r.date, user.organization.timezone)}</p>
                      <p className="mt-1 font-extrabold text-ink">{r.title}</p>
                      <p className="text-sm text-ink/55">
                        {fmtDurationRange(r.startTime, r.endTime)}{r.location ? ` · ${r.location}` : ""}
                      </p>
                    </div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                      <Music4 className="h-5 w-5" />
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {r.team && (
                      <Badge className="w-fit border-line bg-paper text-ink/60">{r.team.name}</Badge>
                    )}
                    {r.service && (
                      <Badge className="w-fit border-line bg-paper text-ink/60">for {r.service.title}</Badge>
                    )}
                  </div>
                  <div className="mt-auto flex items-center justify-between text-xs text-ink/50">
                    <span>{r.songs.length} song{r.songs.length === 1 ? "" : "s"}</span>
                    {r.songs.length > 0 && (
                      <span className="chip border-emerald-200 bg-emerald-50 text-emerald-600">{ready}/{r.songs.length} ready</span>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-base font-bold tracking-tight text-ink">Recent</h2>
              <div className="card divide-y divide-line/70">
                {past.map((r) => (
                  <Link key={r.id} href={`/rehearsals/${r.id}`} className="flex items-center justify-between px-5 py-3 opacity-70 transition hover:bg-brand-50/40">
                    <span className="font-semibold text-ink/80">{r.title}</span>
                    <span className="text-xs text-ink/45">{r.date}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
