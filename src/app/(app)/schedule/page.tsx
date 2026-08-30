import Link from "next/link";
import {
  CalendarX2,
  Check,
  Church,
  Clock,
  MapPin,
  RefreshCcw,
  Trash2,
  X,
  CalendarClock,
  CalendarOff,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ASSIGNMENT_STATUS, can } from "@/lib/constants";
import { fmtDate, fmtDurationRange, relativeDay, todayIn, weekdayOf } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState, SectionTitle } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { respondToAssignment } from "@/actions/scheduling";
import { addBlockout, removeBlockout, setPreferredFrequency } from "@/actions/teams";

export const metadata = { title: "My schedule" };

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default async function SchedulePage() {
  const user = await requireUser();
  const today = todayIn(user.organization.timezone);
  const person = user.personId
    ? await prisma.person.findUnique({ where: { id: user.personId }, include: { blockouts: true } })
    : null;

  if (!person) {
    return (
      <div className="card">
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="No personal profile linked yet"
          hint="Ask your administrator to link your account to a person profile, then your schedule will appear here."
        />
      </div>
    );
  }

  const assignments = await prisma.assignment.findMany({
    where: {
      personId: person.id,
      service: { date: { gte: "2000-01-01" }, organizationId: user.organizationId },
    },
    include: { service: { include: { type: true, campus: true, venue: true } }, team: true },
    orderBy: { service: { date: "asc" } },
    take: 40,
  });

  const upcoming = assignments.filter((a) => a.service.date >= today);
  const history = assignments.filter((a) => a.service.date < today).slice(-8).reverse();
  const needsResponse = upcoming.filter((a) => a.status === "PENDING");
  const rest = upcoming.filter((a) => a.status !== "PENDING");

  const weekdays = Array.from({ length: 7 }, (_, i) => i);
  void weekdays;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">My schedule</h1>
        <p className="mt-1 text-sm text-ink/50">
          {needsResponse.length > 0
            ? `You have ${needsResponse.length} request${needsResponse.length > 1 ? "s" : ""} waiting for a response.`
            : "You're up to date — thank you for serving! 🙏"}
        </p>
      </div>

      {needsResponse.length > 0 && (
        <section>
          <SectionTitle>Needs your response</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {needsResponse.map((a) => (
              <div key={a.id} className="card border-amber-200 bg-amber-50/40 p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-700">{relativeDay(a.service.date, user.organization.timezone)}</p>
                    <p className="mt-1 font-extrabold text-ink">{a.service.title}</p>
                    <p className="mt-0.5 text-sm text-ink/60">
                      {fmtDate(a.service.date)} · {fmtDurationRange(a.service.startTime, a.service.endTime)}
                    </p>
                    <p className="mt-2 chip border-brand-200 bg-brand-50 text-brand-700">{a.positionName} · {a.team.name}</p>
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-amber-600 shadow-card">
                    <Clock className="h-5 w-5" />
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <form action={respondToAssignment}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <input type="hidden" name="action" value="accept" />
                    <button className="btn bg-emerald-600 text-white hover:bg-emerald-700 btn-sm">
                      <Check className="h-4 w-4" /> Accept
                    </button>
                  </form>
                  <form action={respondToAssignment}>
                    <input type="hidden" name="assignmentId" value={a.id} />
                    <input type="hidden" name="action" value="decline" />
                    <button className="btn btn-sm border border-rose-200 bg-surface text-rose-600 hover:bg-rose-50">
                      <X className="h-4 w-4" /> Decline
                    </button>
                  </form>
                  <Modal
                    title="Request a replacement"
                    subtitle="Your team leader will be notified and will look for a substitute."
                    trigger={
                      <button className="btn btn-sm border border-line bg-surface text-ink/70 hover:bg-brand-50">
                        <RefreshCcw className="h-4 w-4" /> Request replacement
                      </button>
                    }
                  >
                    <form action={respondToAssignment} className="space-y-4">
                      <input type="hidden" name="assignmentId" value={a.id} />
                      <input type="hidden" name="action" value="replacement" />
                      <p className="text-sm text-ink/60">
                        {a.service.title} · {fmtDate(a.service.date)} — {a.positionName}
                      </p>
                      <div>
                        <label className="label" htmlFor={`note-${a.id}`}>Note for your leader (optional)</label>
                        <textarea id={`note-${a.id}`} name="note" rows={3} className="input" placeholder="e.g. Traveling that weekend" />
                      </div>
                      <button className="btn-primary w-full">Send request</button>
                    </form>
                  </Modal>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-8">
          {rest.length > 0 && (
            <section>
              <SectionTitle>Upcoming assignments</SectionTitle>
              <Card>
                <ul className="divide-y divide-line/70">
                  {rest.map((a) => {
                    const st = ASSIGNMENT_STATUS[a.status];
                    return (
                      <li key={a.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
                        <div className="w-14 shrink-0 text-center">
                          <p className="text-[10px] font-bold uppercase text-brand-500">{new Date(a.service.date + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}</p>
                          <p className="text-xl font-extrabold leading-none text-ink">{a.service.date.slice(8)}</p>
                        </div>
                        <div className="min-w-0 flex-1">
                          <Link href={`/services/${a.serviceId}`} className="truncate font-semibold text-ink hover:text-brand-700">
                            {a.service.title}
                          </Link>
                          <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink/50">
                            <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtTime(a.service.startTime)}</span>
                            <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{a.service.campus?.name}</span>
                          </p>
                        </div>
                        <span className="chip border-brand-200 bg-brand-50 text-brand-700">{a.positionName}</span>
                        <Badge className={st.className}>{st.label}</Badge>
                      </li>
                    );
                  })}
                </ul>
              </Card>
            </section>
          )}

          {history.length > 0 && (
            <section>
              <SectionTitle>Recently served</SectionTitle>
              <Card>
                <ul className="divide-y divide-line/70">
                  {history.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 px-5 py-3 opacity-70">
                      <p className="w-20 shrink-0 text-xs font-semibold text-ink/50">{fmtDate(a.service.date, { weekday: undefined })}</p>
                      <p className="min-w-0 flex-1 truncate text-sm text-ink/70">{a.service.title}</p>
                      <span className="chip border-line bg-paper text-ink/55">{a.positionName}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </div>

        {/* Availability */}
        <div className="space-y-6">
          <Card>
            <CardHeader title="My availability" subtitle="Block dates you cannot serve" icon={<CalendarOff className="h-4 w-4" />} />
            <div className="p-5">
              <Modal
                title="Mark unavailable"
                trigger={<button className="btn-primary w-full"><CalendarX2 className="h-4 w-4" /> Add blockout dates</button>}
              >
                <form action={addBlockout} className="space-y-4">
                  <input type="hidden" name="personId" value={person.id} />
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label" htmlFor="bo-start">From</label>
                      <input id="bo-start" name="startDate" type="date" required className="input" />
                    </div>
                    <div>
                      <label className="label" htmlFor="bo-end">To</label>
                      <input id="bo-end" name="endDate" type="date" className="input" />
                    </div>
                  </div>
                  <div>
                    <label className="label" htmlFor="bo-reason">Reason (kept private to leaders)</label>
                    <input id="bo-reason" name="reason" className="input" placeholder="e.g. Travel, exams, family" />
                  </div>
                  <div>
                    <label className="label" htmlFor="bo-recur">Or block a recurring weekday</label>
                    <select id="bo-recur" name="recurring" className="input">
                      <option value="">— one-time only —</option>
                      {DAY_NAMES.map((d, i) => (
                        <option key={d} value={i}>Every {d}</option>
                      ))}
                    </select>
                  </div>
                  <button className="btn-primary w-full">Save availability</button>
                </form>
              </Modal>

              <ul className="mt-4 space-y-2">
                {person.blockouts.length === 0 && (
                  <li className="rounded-xl border border-dashed border-line px-4 py-3 text-center text-xs text-ink/45">
                    No blockouts — you're marked available.
                  </li>
                )}
                {person.blockouts.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-2 rounded-xl border border-rose-100 bg-rose-50/60 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">
                        {b.weekday !== null ? `Every ${DAY_NAMES[b.weekday]}` : b.startDate === b.endDate ? fmtDate(b.startDate) : `${fmtDate(b.startDate)} – ${fmtDate(b.endDate)}`}
                      </p>
                      {b.reason && <p className="truncate text-xs text-ink/50">{b.reason}</p>}
                    </div>
                    <form action={removeBlockout}>
                      <input type="hidden" name="blockoutId" value={b.id} />
                      <button className="rounded-lg p-1.5 text-ink/35 hover:bg-surface hover:text-rose-600" aria-label="Remove blockout">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          <Card>
            <CardHeader title="Serving frequency" subtitle="How often you'd like to serve" icon={<CalendarClock className="h-4 w-4" />} />
            <div className="p-5">
              <form action={setPreferredFrequency} className="flex items-end gap-3">
                <input type="hidden" name="personId" value={person.id} />
                <div className="flex-1">
                  <label className="label" htmlFor="freq">Times per month</label>
                  <select id="freq" name="preferredFrequency" defaultValue={String(person.preferredFrequency)} className="input">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}× per month</option>
                    ))}
                  </select>
                </div>
                <button className="btn-secondary">Save</button>
              </form>
              <p className="mt-3 text-xs leading-relaxed text-ink/50">
                The scheduling engine uses this to protect you from burnout — it warns leaders before
                over-scheduling you.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}
