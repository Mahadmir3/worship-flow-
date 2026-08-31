import Link from "next/link";
import {
  Bell,
  CalendarPlus,
  CheckCheck,
  Church,
  Clock,
  ListPlus,
  MapPin,
  Music4,
  Plus,
  Send,
  UserCheck,
  Users,
  AlertTriangle,
  History,
  Check,
  X,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAny, canDo } from "@/lib/perms";
import {
  fmtDate,
  fmtTime,
  fmtDurationRange,
  relativeDay,
  todayIn,
  daysUntil,
} from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState, LinkButton, SectionTitle, StatCard } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createSong } from "@/actions/songs";
import { respondToAssignment, submitServingProposal } from "@/actions/scheduling";
import { SubmitButton } from "@/components/SubmitButton";
import { createTeam } from "@/actions/teams";
import { createRehearsal } from "@/actions/rehearsals";
import { KEYS } from "@/lib/music";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const orgId = user.organizationId;
  const tz = user.organization.timezone;
  const today = todayIn(tz);
  const isLeader = await canAny(user, ["manage_services", "schedule"]);
  const canCreateService = await canDo(user, "manage_services");
  const isVolunteer = user.role === "VOLUNTEER";

  const person = user.personId
    ? await prisma.person.findUnique({ where: { id: user.personId } })
    : null;

  const [todays, upcoming, pending, openCount, rehearsals, tasks, activity, notifications, types, campuses, people, teamsCount] =
    await Promise.all([
      prisma.service.findMany({
        where: { organizationId: orgId, date: today },
        include: { type: true, campus: true },
        orderBy: { startTime: "asc" },
      }),
      prisma.service.findMany({
        where: { organizationId: orgId, date: { gt: today } },
        include: { type: true, campus: true, assignments: true },
        orderBy: { date: "asc" },
        take: 4,
      }),
      isLeader
        ? prisma.assignment.findMany({
            where: {
              status: "PENDING",
              service: { date: { gte: today }, organizationId: orgId },
            },
            include: { person: true, service: true, team: true },
            orderBy: { service: { date: "asc" } },
            take: 5,
          })
        : [],
      prisma.assignment.count({
        where: { status: "OPEN", service: { date: { gte: today }, organizationId: orgId } },
      }),
      prisma.rehearsal.findMany({
        where: { organizationId: orgId, date: { gte: today } },
        orderBy: { date: "asc" },
        take: 3,
      }),
      person
        ? prisma.task.findMany({
            where: { assigneeId: person.id, status: { not: "DONE" } },
            orderBy: { dueDate: "asc" },
            take: 5,
          })
        : [],
      false || isLeader
        ? prisma.auditLog.findMany({
            where: { organizationId: orgId },
            orderBy: { createdAt: "desc" },
            take: 6,
          })
        : [],
      prisma.notification.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      prisma.serviceType.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
      prisma.campus.findMany({ where: { organizationId: orgId } }),
      prisma.person.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
      prisma.team.count({ where: { organizationId: orgId } }),
    ]);

  const myPlan = isVolunteer && user.personId
    ? await prisma.assignment.findMany({
        where: {
          personId: user.personId,
          status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
          service: { date: { gte: today }, organizationId: orgId },
        },
        include: { service: { include: { campus: true } }, team: true },
        orderBy: { service: { date: "asc" } },
        take: 6,
      })
    : [];
  const planTeams = isVolunteer
    ? await prisma.team.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } })
    : [];

  const peopleOptions = people.map((p) => ({ id: p.id, name: p.name }));
  const firstUpcomingService = upcoming[0];

  return (
    <div className="space-y-8">
      {/* Greeting */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink/50">
            {greeting()} · {fmtDate(today, { year: undefined })}
          </p>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
            Hello, {user.name.split(" ")[0]} 👋
          </h1>
        </div>
        <p className="text-xs text-ink/40">
          {user.organization.name} · {tz.replace("_", " ")}
        </p>
      </div>

      {isVolunteer ? (
        <section aria-label="My plan">
          <SectionTitle>My plan</SectionTitle>
          <div className="grid grid-cols-2 gap-3">
            <QuickLink href="/messages" icon={<Send className="h-5 w-5" />} label="Send Announcement" tone="rose" />
            <Modal
              title="Serving proposal"
              subtitle="Tell a department you'd like to serve — their leaders get your message."
              trigger={
                <button className="card flex h-full flex-col items-center justify-center gap-2.5 p-4 text-center transition hover:border-brand-300 hover:shadow-pop">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white"><UserCheck className="h-5 w-5" /></span>
                  <span className="text-xs font-bold text-ink">Serving Proposal</span>
                </button>
              }
            >
              <form action={submitServingProposal} className="space-y-4">
                <div>
                  <label className="label" htmlFor="sp-team">Which department?</label>
                  <select id="sp-team" name="teamId" required className="input">
                    {planTeams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="sp-msg">Your message</label>
                  <textarea
                    id="sp-msg"
                    name="message"
                    required
                    rows={4}
                    className="input"
                    placeholder="e.g. I'd love to join the media team — I have camera experience and I'm free on weekends."
                  />
                </div>
                <button className="btn-primary w-full">Send proposal</button>
              </form>
            </Modal>
          </div>

          <Card>
            <CardHeader
              title="Where I'm serving"
              subtitle={myPlan.length ? `Next: ${relativeDay(myPlan[0].service.date, tz)}` : "Nothing scheduled yet"}
              icon={<UserCheck className="h-4 w-4" />}
            />
            {myPlan.length === 0 ? (
              <EmptyState title="You're not scheduled yet" hint="When a leader schedules you, the plan appears here." icon={<Users className="h-6 w-6" />} />
            ) : (
              <ul className="divide-y divide-line/70">
                {myPlan.map((a) => (
                  <li key={a.id} className="px-5 py-4">
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <Link href={`/services/${a.serviceId}?tab=team`} className="text-sm font-bold text-ink hover:text-brand-700">{a.service.title}</Link>
                        <p className="text-xs text-ink/50">
                          {relativeDay(a.service.date, tz)} · {fmtTime(a.service.startTime)} — {a.positionName} · {a.team.name}
                        </p>
                      </div>
                      <span className={`chip ${a.status === "PENDING" ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"}`}>
                        {a.status === "PENDING" ? "Needs your response" : "You're confirmed"}
                      </span>
                      {a.status === "PENDING" && (
                        <span className="flex gap-1.5">
                          <form action={respondToAssignment}>
                            <input type="hidden" name="assignmentId" value={a.id} />
                            <input type="hidden" name="action" value="accept" />
                            <SubmitButton pendingText="Accepting…" className="btn-secondary btn-sm border-emerald-200 text-emerald-700">Accept</SubmitButton>
                          </form>
                          <Modal
                            title="Why are you declining?"
                            subtitle={`${a.service.title} — ${a.positionName}`}
                            trigger={<button className="btn-ghost btn-sm text-ink/40">Decline</button>}
                          >
                            <form action={respondToAssignment} className="space-y-4">
                              <input type="hidden" name="assignmentId" value={a.id} />
                              <input type="hidden" name="action" value="decline" />
                              <div>
                                <label className="label" htmlFor={`why-${a.id}`}>Reason</label>
                                <textarea
                                  id={`why-${a.id}`}
                                  name="note"
                                  required
                                  rows={3}
                                  className="input"
                                  placeholder="e.g. Traveling upcountry that weekend — back on Monday."
                                />
                              </div>
                              <p className="text-xs leading-relaxed text-ink/50">Your reason is shared with the team leaders so they can find a replacement.</p>
                              <SubmitButton pendingText="Sending…" className="btn w-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Send decline with reason</SubmitButton>
                            </form>
                          </Modal>
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </section>
      ) : (
      <section aria-label="Quick actions">
        <SectionTitle>Quick actions</SectionTitle>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {canCreateService ? (
            <Link href="/services/new" className="card flex flex-col items-center gap-2.5 p-4 text-center transition hover:border-brand-300 hover:shadow-pop">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-700 text-white"><Plus className="h-5 w-5" /></span>
              <span className="text-xs font-bold text-ink">Create Event</span>
            </Link>
          ) : null}

          <QuickLink href={firstUpcomingService ? `/services/${firstUpcomingService.id}?tab=team` : "/services"} icon={<UserCheck className="h-5 w-5" />} label="Schedule Volunteers" tone="gold" />
          <QuickLink href="/songs" icon={<ListPlus className="h-5 w-5" />} label="Add Song" tone="green" />
          <QuickLink href="/teams" icon={<Users className="h-5 w-5" />} label="Create Team" tone="cyan" />
          <QuickLink href="/rehearsals" icon={<Music4 className="h-5 w-5" />} label="Create Rehearsal" tone="brand-light" />
          <QuickLink href="/messages" icon={<Send className="h-5 w-5" />} label="Send Announcement" tone="rose" />
        </div>
      </section>
      )}

      {/* Today + stats */}
      {!isVolunteer && todays.length > 0 && (
        <section>
          <SectionTitle>Today</SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {todays.map((svc) => (
              <Link key={svc.id} href={`/services/${svc.id}`} className="card flex items-center gap-4 p-5 transition hover:border-brand-300">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-700 text-white">
                  <Church className="h-6 w-6" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-bold text-ink">{svc.title}</p>
                  <p className="text-sm text-ink/55">
                    {fmtTime(svc.startTime)} · {svc.campus?.name}
                  </p>
                </div>
                <span className="chip border-brand-200 bg-brand-50 text-brand-700">{fmtTime(svc.startTime)}</span>
              </Link>
            ))}
          </div>
        </section>
      )}

{!isVolunteer && (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Upcoming services" value={upcoming.length} sub="next four planned" icon={<Church className="h-5 w-5" />} />
        <StatCard label="Open positions" value={openCount} sub="across upcoming services" tone={openCount ? "gold" : "green"} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Rehearsals ahead" value={rehearsals.length} sub={rehearsals[0] ? `next ${relativeDay(rehearsals[0].date, tz)}` : "none scheduled"} tone="cyan" icon={<Music4 className="h-5 w-5" />} />
        <StatCard label="My tasks" value={tasks.length} sub={tasks[0]?.dueDate ? `due ${relativeDay(tasks[0].dueDate!, tz)}` : "nothing due"} tone="green" icon={<CheckCheck className="h-5 w-5" />} />
      </div>
)}

      <div className={`grid gap-6 ${isVolunteer ? "" : "lg:grid-cols-2"}`}>
        {/* Upcoming services */}
        <Card>
          <CardHeader title="Upcoming services" icon={<Church className="h-4 w-4" />} action={<Link href="/services" className="text-xs font-bold text-brand-700 hover:underline">All →</Link>} />
          {upcoming.length === 0 ? (
            <EmptyState title="No services planned yet" hint="Create your first service to get rolling." icon={<CalendarPlus className="h-6 w-6" />} />
          ) : (
            <ul className="divide-y divide-line/70">
              {upcoming.map((svc) => {
                const open = svc.assignments.filter((a) => a.status === "OPEN").length;
                return (
                  <li key={svc.id}>
                    <Link href={`/services/${svc.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-brand-50/50">
                      <div className="w-14 shrink-0 text-center">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-brand-500">
                          {new Date(svc.date + "T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })}
                        </p>
                        <p className="text-xl font-extrabold leading-none text-ink">{svc.date.slice(8)}</p>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{svc.title}</p>
                        <p className="truncate text-xs text-ink/50">
                          {fmtTime(svc.startTime)} · {svc.campus?.name} · {svc.assignments.length} positions
                        </p>
                      </div>
                      {open > 0 ? (
                        <span className="chip border-amber-200 bg-amber-50 text-amber-700">{open} open</span>
                      ) : (
                        <span className="chip border-emerald-200 bg-emerald-50 text-emerald-600">full team</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

{!isVolunteer && (
        <>
        {/* Pending confirmations (leaders) / rehearsals (everyone) */}
        {isLeader ? (
          <Card>
            <CardHeader title="Pending confirmations" subtitle="Volunteers waiting to respond" icon={<UserCheck className="h-4 w-4" />} />
            {pending.length === 0 ? (
              <EmptyState title="All confirmed 🎉" hint="No pending responses on upcoming services." />
            ) : (
              <ul className="divide-y divide-line/70">
                {pending.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-5 py-3.5">
                    <Avatar name={p.person?.name || "?"} size={36} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{p.person?.name || "Unassigned"}</p>
                      <p className="truncate text-xs text-ink/50">
                        {p.positionName} · {fmtDate(p.service.date, { year: undefined })}
                      </p>
                    </div>
                    <Link href={`/services/${p.serviceId}?tab=team`} className="text-xs font-bold text-brand-700 hover:underline">Manage</Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        ) : (
          <Card>
            <CardHeader title="Rehearsals" icon={<Music4 className="h-4 w-4" />} />
            {rehearsals.length === 0 ? (
              <EmptyState title="No rehearsals scheduled" />
            ) : (
              <ul className="divide-y divide-line/70">
                {rehearsals.map((r) => (
                  <li key={r.id}>
                    <Link href={`/rehearsals/${r.id}`} className="flex items-center gap-4 px-5 py-3.5 transition hover:bg-brand-50/50">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-ink">{r.title}</p>
                        <p className="text-xs text-ink/50">{relativeDay(r.date, tz)} · {fmtTime(r.startTime)}{r.location ? ` · ${r.location}` : ""}</p>
                      </div>
                      <span className="chip border-line bg-paper text-ink/60">{daysUntil(r.date, today) >= 0 ? relativeDay(r.date, tz) : ""}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
        </>
      )}
      </div>

{!isVolunteer && (
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Notifications */}
        <Card>
          <CardHeader title="Notifications" icon={<Bell className="h-4 w-4" />} />
          {notifications.length === 0 ? (
            <EmptyState title="Nothing new" hint="You're all caught up." />
          ) : (
            <ul className="divide-y divide-line/70">
              {notifications.map((n) => (
                <li key={n.id} className="px-5 py-3.5">
                  <p className="text-sm font-semibold text-ink">{n.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* My tasks */}
        <Card>
          <CardHeader title="My tasks" icon={<CheckCheck className="h-4 w-4" />} action={<Link href="/tasks" className="text-xs font-bold text-brand-700 hover:underline">All →</Link>} />
          {tasks.length === 0 ? (
            <EmptyState title="No open tasks" hint="Nice and clear." />
          ) : (
            <ul className="divide-y divide-line/70">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{t.title}</p>
                  {t.dueDate && <Badge className="border-line bg-paper text-ink/60">{relativeDay(t.dueDate, tz)}</Badge>}
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Recent activity (leaders) */}
        <Card>
          <CardHeader title="Recent activity" icon={<History className="h-4 w-4" />} />
          {activity.length === 0 ? (
            <EmptyState title="Activity will show here" hint="Plan changes, scheduling and confirmations." />
          ) : (
            <ul className="divide-y divide-line/70">
              {activity.map((a) => (
                <li key={a.id} className="px-5 py-3">
                  <p className="text-xs text-ink/70">
                    <span className="font-semibold text-ink">{actionLabel(a.action)}</span> · {timeAgo(a.createdAt)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      )}
    </div>
  );
}

function QuickLink({ href, icon, label, tone }: { href: string; icon: React.ReactNode; label: string; tone: string }) {
  const tones: Record<string, string> = {
    gold: "bg-gold-500 text-white",
    green: "bg-emerald-600 text-white",
    cyan: "bg-cyan-600 text-white",
    rose: "bg-rose-500 text-white",
    "brand-light": "bg-brand-500 text-white",
  };
  return (
    <Link href={href} className="card flex flex-col items-center gap-2.5 p-4 text-center transition hover:border-brand-300 hover:shadow-pop">
      <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tones[tone]}`}>{icon}</span>
      <span className="text-xs font-bold text-ink">{label}</span>
    </Link>
  );
}

function nextSunday(from: string): string {
  const d = new Date(from + "T12:00:00Z");
  const diff = (0 - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function greeting(): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Africa/Kampala" }).format(new Date()));
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function actionLabel(action: string): string {
  const map: Record<string, string> = {
    "service.create": "Service created",
    "service.update": "Service updated",
    "service.autoschedule": "Auto-schedule run",
    "service.live.cursor": "Live mode advanced",
    "assignment.schedule": "Volunteer scheduled",
    "assignment.accept": "Assignment accepted",
    "assignment.decline": "Assignment declined",
    "assignment.replacement": "Replacement requested",
    "song.create": "Song added",
    "team.create": "Team created",
    "person.create": "Person added",
    "auth.login": "Signed in",
  };
  return map[action] || action;
}

function timeAgo(d: Date): string {
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
}
