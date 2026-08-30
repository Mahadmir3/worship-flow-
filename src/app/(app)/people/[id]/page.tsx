import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarCheck,
  CalendarOff,
  Mail,
  Phone,
  Trash2,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ASSIGNMENT_STATUS, ROLE_LABEL } from "@/lib/constants";
import { canDo } from "@/lib/perms";
import { fmtDate, relativeDay, todayIn } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { addBlockout, removeBlockout, updatePerson } from "@/actions/teams";

export const metadata = { title: "Person" };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function PersonPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const user = await requireUser();
  const person = await prisma.person.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      campus: true,
      user: true,
      teamMemberships: { include: { team: true } },
      blockouts: true,
      assignments: {
        include: { service: { include: { type: true } }, team: true },
        orderBy: { service: { date: "desc" } },
        take: 20,
      },
      attendance: { include: { service: true } },
    },
  });
  if (!person) notFound();

  const today = todayIn(user.organization.timezone);
  const campuses = await prisma.campus.findMany({ where: { organizationId: user.organizationId } });
  const manage = await canDo(user, "manage_people");
  const isSelf = person.id === user.personId;

  const upcoming = person.assignments.filter((a) => a.service.date >= today).reverse();
  const past = person.assignments.filter((a) => a.service.date < today);
  const attended = person.attendance.filter((a) => a.status === "PRESENT").length;
  const attendRate = person.attendance.length ? Math.round((attended / person.attendance.length) * 100) : null;

  return (
    <div className="space-y-6">
      <Link href="/people" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All people
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <Avatar name={person.name} size={64} />
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-ink">{person.name}</h1>
              <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/55">
                {person.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{person.email}</span>}
                {person.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{person.phone}</span>}
                {person.campus && <span>{person.campus.name}</span>}
              </p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {person.teamMemberships.map((tm) => (
                  <Link key={tm.id} href={`/teams/${tm.teamId}`}>
                    <Badge className="border-brand-100 bg-brand-50 text-brand-700">{tm.team.name}{tm.isLeader ? " · lead" : ""}</Badge>
                  </Link>
                ))}
                {person.user && <Badge className="border-gold-200 bg-gold-50 text-gold-700">{ROLE_LABEL[person.user.role] || person.user.role}</Badge>}
                {person.skills && <Badge className="border-line bg-paper text-ink/60">{person.skills}</Badge>}
              </div>
            </div>
          </div>
          {(manage || isSelf) && (
            <Modal title={`Edit ${person.name}`} trigger={<button className="btn-secondary btn-sm">Edit profile</button>}>
              <form action={updatePerson} className="space-y-4">
                <input type="hidden" name="personId" value={person.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="ed-name">Name</label>
                    <input id="ed-name" name="name" defaultValue={person.name} required className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="ed-campus">Campus</label>
                    <select id="ed-campus" name="campusId" defaultValue={person.campusId || ""} className="input">
                      <option value="">—</option>
                      {campuses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="ed-email">Email</label>
                    <input id="ed-email" name="email" type="email" defaultValue={person.email || ""} className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="ed-phone">Phone</label>
                    <input id="ed-phone" name="phone" defaultValue={person.phone || ""} className="input" />
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="label" htmlFor="ed-skills">Skills</label>
                    <input id="ed-skills" name="skills" defaultValue={person.skills || ""} className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="ed-freq">Preferred frequency</label>
                    <select id="ed-freq" name="preferredFrequency" defaultValue={String(person.preferredFrequency)} className="input">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <option key={n} value={n}>{n}× per month</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label" htmlFor="ed-notes">Notes</label>
                  <textarea id="ed-notes" name="notes" rows={3} defaultValue={person.notes || ""} className="input" />
                </div>
                <button className="btn-primary w-full">Save profile</button>
              </form>
            </Modal>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-5 sm:grid-cols-4">
          <Stat label="Served (records)" value={past.length} />
          <Stat label="Upcoming" value={upcoming.length} />
          <Stat label="Attendance" value={attendRate !== null ? `${attendRate}%` : "—"} />
          <Stat label="Prefers" value={`${person.preferredFrequency}×/month`} />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Assignments" subtitle="Upcoming & recent" icon={<CalendarCheck className="h-4 w-4" />} />
          {person.assignments.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <ul className="divide-y divide-line/70">
              {[...upcoming, ...past.slice(0, 6)].map((a) => {
                const st = ASSIGNMENT_STATUS[a.status];
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                    <p className={`w-24 shrink-0 text-xs font-semibold ${a.service.date >= today ? "text-ink/70" : "text-ink/40"}`}>
                      {fmtDate(a.service.date, { year: undefined })}
                    </p>
                    <div className="min-w-0 flex-1">
                      <Link href={`/services/${a.serviceId}`} className="truncate text-sm font-semibold text-ink hover:text-brand-700">
                        {a.service.title}
                      </Link>
                      <p className="text-xs text-ink/50">{a.positionName} · {a.team.name}</p>
                    </div>
                    <Badge className={st.className}>{st.label}</Badge>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Availability" subtitle="Blocked dates & recurring" icon={<CalendarOff className="h-4 w-4" />} />
            <div className="p-5">
              {(manage || isSelf) && (
                <Modal
                  title={`Block dates for ${person.name.split(" ")[0]}`}
                  trigger={<button className="btn-secondary btn-sm w-full">Add blockout</button>}
                >
                  <form action={addBlockout} className="space-y-4">
                    <input type="hidden" name="personId" value={person.id} />
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="label" htmlFor="pb-start">From</label>
                        <input id="pb-start" name="startDate" type="date" required className="input" />
                      </div>
                      <div>
                        <label className="label" htmlFor="pb-end">To</label>
                        <input id="pb-end" name="endDate" type="date" className="input" />
                      </div>
                    </div>
                    <div>
                      <label className="label" htmlFor="pb-reason">Reason</label>
                      <input id="pb-reason" name="reason" className="input" />
                    </div>
                    <button className="btn-primary w-full">Save</button>
                  </form>
                </Modal>
              )}
              <ul className="mt-4 space-y-2">
                {person.blockouts.length === 0 && (
                  <li className="rounded-xl border border-dashed border-line px-4 py-3 text-center text-xs text-emerald-600">
                    Fully available
                  </li>
                )}
                {person.blockouts.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3.5 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {b.weekday !== null ? `Every ${DAY_NAMES[b.weekday]}` : b.startDate === b.endDate ? fmtDate(b.startDate) : `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`}
                      </p>
                      {b.reason && <p className="text-xs text-ink/50">{b.reason}</p>}
                    </div>
                    {(manage || isSelf) && (
                      <form action={removeBlockout}>
                        <input type="hidden" name="blockoutId" value={b.id} />
                        <button className="rounded-lg p-1.5 text-ink/35 hover:bg-surface hover:text-rose-600" aria-label="Remove blockout">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {person.notes && (
            <Card>
              <CardHeader title="Notes" />
              <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-ink/70">{person.notes}</p>
            </Card>
          )}

          <Card>
            <CardHeader title="Attendance history" icon={<Zap className="h-4 w-4" />} />
            {person.attendance.length === 0 ? (
              <EmptyState title="No attendance records" />
            ) : (
              <ul className="divide-y divide-line/70">
                {person.attendance.slice(0, 8).map((att) => (
                  <li key={att.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                    <span className="text-ink/70">{fmtDate(att.service.date, { year: undefined })}</span>
                    <Badge className={att.status === "PRESENT" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : att.status === "LATE" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-rose-200 bg-rose-50 text-rose-700"}>
                      {att.status}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-paper px-3.5 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink/40">{label}</p>
      <p className="text-lg font-extrabold text-ink">{value}</p>
    </div>
  );
}
