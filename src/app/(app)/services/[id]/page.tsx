import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  CheckCheck,
  Church,
  Clock,
  FileText,
  ListChecks,
  MapPin,
  MessageSquare,
  MonitorPlay,
  Music2,
  Radio,
  Send,
  Sparkles,
  UserCheck,
  Users,
  AlertTriangle,
  Wand2,
  Share2,
  ListMusic,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ASSIGNMENT_STATUS, ITEM_TYPES, SERVICE_STATUS } from "@/lib/constants";
import { canAny, canDo as canDo2, isAdminTier, ledTeams } from "@/lib/perms";
import { addMinutes, fmtDate, fmtDurationRange, fmtTime, relativeDay, todayIn } from "@/lib/format";
import { buildSuggestions } from "@/lib/scheduling";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import {
  addServiceComment,
  saveAsTemplate,
  setServiceStatus,
} from "@/actions/services";
import { addServicePosition, autoSchedule, confirmAll, deleteAssignment, respondToAssignment, schedulePerson, unassign } from "@/actions/scheduling";
import { createTask, moveTask } from "@/actions/tasks";
import { TASK_PRIORITY, TASK_STATUS } from "@/lib/constants";
import { Badge as B } from "@/components/ui/primitives";

export const metadata = { title: "Service" };

const TABS = [
  { id: "overview", label: "Overview", icon: ListMusic },
  { id: "team", label: "Team", icon: Users },
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "discussion", label: "Discussion", icon: MessageSquare },
];

export default async function ServiceDetailPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const service = await prisma.service.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      type: true,
      campus: true,
      venue: true,
      worshipLeader: true,
      preacher: true,
      serviceLeader: true,
      items: { orderBy: { sortOrder: "asc" }, include: { song: true } },
      assignments: { orderBy: [{ team: { name: "asc" } }, { positionName: "asc" }], include: { team: true, person: true } },
      comments: { orderBy: { createdAt: "asc" }, include: { user: true } },
      tasks: { orderBy: { createdAt: "desc" } },
      rehearsals: { orderBy: { date: "asc" } },
    },
  });
  if (!service) notFound();

  const today = todayIn(user.organization.timezone);
  const tab = searchParams.tab || "overview";
  const editable = await canDo2(user, "manage_services");
  const canSchedule = await canAny(user, ["schedule", "manage_services"]);
  const ledIds = new Set((await ledTeams(user)).map((t) => t.id));  const people = await prisma.person.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
    include: { teamMemberships: { select: { teamId: true } } },
  });

  // Smart suggestions for open/declined/replacement positions
  const { suggestions, warnings } = canSchedule
    ? await buildSuggestions(service.id, user.organizationId, true)
    : { suggestions: [], warnings: [] };

  const suggestionByAssignment = new Map(suggestions.map((s) => [s.assignmentId, s]));


  // teamId → member person ids (for the "who can fill this" browser)
  const teamMemberIds = new Map<string, Set<string>>();
  for (const p of people)
    for (const m of p.teamMemberships) {
      const set = teamMemberIds.get(m.teamId) || new Set<string>();
      set.add(p.id);
      teamMemberIds.set(m.teamId, set);
    }
  const browseFor = (a: (typeof service.assignments)[number]) => {
    const tokens = a.positionName.toLowerCase().split(/[\s/]+/).filter((w) => w.length > 2);
    const candById = new Map((suggestionByAssignment.get(a.id)?.candidates || []).map((c) => [c.personId, c]));
    const members = teamMemberIds.get(a.teamId) || new Set<string>();
    return people
      .filter((p) => tokens.length > 0 && tokens.some((t) => (p.skills || "").toLowerCase().includes(t)))
      .map((p) => ({ person: p, onTeam: members.has(p.id), cand: candById.get(p.id) }))
      .sort((x, y) => Number(y.onTeam) - Number(x.onTeam) || x.person.name.localeCompare(y.person.name));
  };

  const openCount = service.assignments.filter((a) => a.status === "OPEN").length;
  const pendingCount = service.assignments.filter((a) => a.status === "PENDING").length;
  const status = SERVICE_STATUS[service.status] || SERVICE_STATUS.PLANNING;

  const songs = service.items.filter((i) => i.songId);
  const totalMin = Math.round(service.items.reduce((n, i) => n + i.durationSec, 0) / 60);

  const whatsappText = encodeURIComponent(
    `${service.title} — ${fmtDate(service.date)} ${fmtDurationRange(service.startTime, service.endTime)}\n${service.campus?.name}${service.venue ? ` · ${service.venue.name}` : ""}\n\nOrder:\n${service.items.map((i) => `• ${i.title}`).join("\n")}`
  );

  return (
    <div className="space-y-6">
      <Link href="/services" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All services
      </Link>

      {/* Header */}
      <div className="card relative overflow-hidden p-6">
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ background: service.type?.color || "#323A8C" }} />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={status.className}>{status.label}</Badge>
              <Badge className="border-line bg-paper text-ink/60">{service.type?.name}</Badge>
              {service.date >= today && (
                <Badge className="border-brand-200 bg-brand-50 text-brand-700">{relativeDay(service.date, user.organization.timezone)}</Badge>
              )}
            </div>
            <h1 className="mt-2.5 text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{service.title}</h1>
            <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink/60">
              <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-brand-500" />{fmtDate(service.date)}</span>
              <span className="inline-flex items-center gap-1.5"><Clock className="h-4 w-4 text-brand-500" />{fmtDurationRange(service.startTime, service.endTime)}</span>
              <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-brand-500" />{service.campus?.name}{service.venue ? ` · ${service.venue.name}` : ""}</span>
            </div>
            {service.theme && (
              <p className="mt-3 text-sm font-semibold text-ink/75">
                Theme: <span className="text-brand-700">{service.theme}</span>
                {service.scripture ? ` · ${service.scripture}` : ""}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 no-print">
            <Link href={`/services/${service.id}/plan`} className="btn-primary">
              <ListMusic className="h-4 w-4" /> Open plan
            </Link>
            <Link href={`/services/${service.id}/live`} className="btn-secondary">
              <Radio className="h-4 w-4" /> Live mode
            </Link>
            <a
              href={`https://wa.me/?text=${whatsappText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              aria-label="Share order of service on WhatsApp"
            >
              <Share2 className="h-4 w-4" /> WhatsApp
            </a>
          </div>
        </div>

        <div className="mt-5 grid gap-3 border-t border-line pt-5 sm:grid-cols-2 lg:grid-cols-4">
          <MiniStat icon={<Users className="h-4 w-4" />} label="Team" value={`${service.assignments.filter((a) => a.personId).length}/${service.assignments.length} filled`} />
          <MiniStat icon={<AlertTriangle className="h-4 w-4" />} label="Open positions" value={openCount} tone={openCount ? "gold" : "green"} />
          <MiniStat icon={<UserCheck className="h-4 w-4" />} label="Pending" value={pendingCount} tone={pendingCount ? "gold" : "green"} />
          <MiniStat icon={<Clock className="h-4 w-4" />} label="Plan length" value={`${totalMin} min`} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink/50">
          {service.worshipLeader && <span>Worship leader: <b className="text-ink/75">{service.worshipLeader.name}</b></span>}
          {service.preacher && <span>Preacher: <b className="text-ink/75">{service.preacher.name}</b></span>}
          {service.serviceLeader && <span>Service leader: <b className="text-ink/75">{service.serviceLeader.name}</b></span>}
          {editable && (
            <span className="ml-auto flex gap-2 no-print">
              {service.status !== "READY" && (
                <form action={setServiceStatus}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <input type="hidden" name="status" value="READY" />
                  <button className="btn-secondary btn-sm"><CheckCheck className="h-3.5 w-3.5" /> Mark ready</button>
                </form>
              )}
              <Modal
                title="Save as template"
                trigger={<button className="btn-secondary btn-sm"><FileText className="h-3.5 w-3.5" /> Save as template</button>}
              >
                <form action={saveAsTemplate} className="space-y-4">
                  <input type="hidden" name="serviceId" value={service.id} />
                  <div>
                    <label className="label" htmlFor="tpl-name">Template name</label>
                    <input id="tpl-name" name="name" className="input" defaultValue={`${service.type?.name} — standard flow`} required />
                  </div>
                  <p className="text-xs text-ink/50">The order of service ({service.items.length} items) will be reusable when creating future services.</p>
                  <button className="btn-primary w-full">Save template</button>
                </form>
              </Modal>
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1.5 no-print" role="tablist">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/services/${service.id}?tab=${t.id}`}
            role="tab"
            aria-selected={tab === t.id}
            className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-semibold transition ${
              tab === t.id ? "bg-brand-700 text-white" : "text-ink/60 hover:bg-brand-50"
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
            {t.id === "team" && openCount > 0 && (
              <span className={`chip ${tab === t.id ? "border-white/30 bg-surface/20 text-white" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{openCount}</span>
            )}
            {t.id === "tasks" && service.tasks.filter((t2) => t2.status !== "DONE").length > 0 && (
              <span className={`chip ${tab === t.id ? "border-white/30 bg-surface/20 text-white" : "border-line bg-paper text-ink/60"}`}>
                {service.tasks.filter((t2) => t2.status !== "DONE").length}
              </span>
            )}
            {t.id === "discussion" && service.comments.length > 0 && (
              <span className={`chip ${tab === t.id ? "border-white/30 bg-surface/20 text-white" : "border-line bg-paper text-ink/60"}`}>{service.comments.length}</span>
            )}
          </Link>
        ))}
      </div>

      {tab === "overview" && (
        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Order of service"
                subtitle={`${service.items.length} items · ${totalMin} minutes`}
                icon={<ListMusic className="h-4 w-4" />}
                action={<Link href={`/services/${service.id}/plan`} className="text-xs font-bold text-brand-700 hover:underline no-print">Edit plan →</Link>}
              />
              {service.items.length === 0 ? (
                <EmptyState title="No items yet" hint="Open the plan builder to create the order of service." icon={<ListMusic className="h-6 w-6" />} />
              ) : (
                <ol className="divide-y divide-line/70">
                  {service.items.map((item) => {
                    let t = service.startTime;
                    // compute inline: cumulative before this item
                    return <OrderRow key={item.id} item={item} startTime={cumulative(service.items, service.startTime, item.sortOrder)} />;
                  })}
                </ol>
              )}
            </Card>

            {songs.length > 0 && (
              <Card>
                <CardHeader title="Setlist" icon={<Music2 className="h-4 w-4" />} />
                <ul className="divide-y divide-line/70">
                  {songs.map((s, i) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 px-5 py-3">
                      <span className="text-sm font-semibold text-ink">
                        {i + 1}. {s.song?.title || s.title}
                      </span>
                      <span className="flex items-center gap-2">
                        {s.key && <Badge className="border-brand-200 bg-brand-50 text-brand-700">Key {s.key}</Badge>}
                        <Link href={`/songs/${s.songId}`} className="text-xs font-bold text-brand-700 hover:underline no-print">Chart →</Link>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            {service.notes && (
              <Card>
                <CardHeader title="Notes" icon={<FileText className="h-4 w-4" />} />
                <p className="whitespace-pre-wrap px-5 py-4 text-sm leading-relaxed text-ink/75">{service.notes}</p>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {service.rehearsals.length > 0 && (
              <Card>
                <CardHeader title="Rehearsals" icon={<Music2 className="h-4 w-4" />} />
                <ul className="divide-y divide-line/70">
                  {service.rehearsals.map((r) => (
                    <li key={r.id}>
                      <Link href={`/rehearsals/${r.id}`} className="block px-5 py-3 transition hover:bg-brand-50/50">
                        <p className="text-sm font-semibold text-ink">{r.title}</p>
                        <p className="text-xs text-ink/50">{relativeDay(r.date, user.organization.timezone)} · {r.startTime}{r.location ? ` · ${r.location}` : ""}</p>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
            <Card>
              <CardHeader title="Production" subtitle="Technical crew on this service" icon={<MonitorPlay className="h-4 w-4" />} />
              <ul className="divide-y divide-line/70">
                {service.assignments.filter((a) => a.team.category === "PRODUCTION").map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 px-5 py-3">
                    <span className="text-sm text-ink/70">{a.positionName}</span>
                    <span className="flex items-center gap-2">
                      {a.person ? <><Avatar name={a.person.name} size={24} /><span className="text-xs font-semibold text-ink">{a.person.name}</span></> : <Badge className="border-amber-200 bg-amber-50 text-amber-700">open</Badge>}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-6">
          {canSchedule && (openCount > 0 || pendingCount > 0) && (
            <div className="card border-gold-200 bg-gold-50/60 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold-500 text-white">
                    <Wand2 className="h-5 w-5" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-ink">Smart scheduling</p>
                    <p className="text-xs text-ink/60">
                      Auto-fill {openCount} open position{openCount === 1 ? "" : "s"} using availability, skills and load — each pick sends a confirmation request.
                    </p>
                  </div>
                </div>
                <form action={autoSchedule}>
                  <input type="hidden" name="serviceId" value={service.id} />
                  <button className="btn-gold"><Sparkles className="h-4 w-4" /> Auto Schedule</button>
                </form>
              </div>
              {warnings.length > 0 && (
                <div className="mt-4 space-y-1.5 rounded-xl border border-gold-200 bg-surface/70 p-3.5">
                  <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold-800">
                    <AlertTriangle className="h-3.5 w-3.5" /> Scheduling engine warnings
                  </p>
                  {warnings.map((w, i) => (
                    <p key={i} className="text-xs leading-relaxed text-ink/70">• {w}</p>
                  ))}
                </div>
              )}
            </div>
          )}

          {(() => {
            const CAT_ORDER: Record<string, number> = { WORSHIP: 0, CHOIR: 1, PRODUCTION: 2, MINISTRY: 3, CUSTOM: 4 };
            const CAT_COLOR: Record<string, string> = {
              WORSHIP: "bg-brand-500", CHOIR: "bg-purple-500", PRODUCTION: "bg-cyan-500",
              MINISTRY: "bg-amber-500", CUSTOM: "bg-ink/30",
            };
            const byTeam = new Map<string, { id: string; name: string; category: string; rows: typeof service.assignments }>();
            for (const a of service.assignments) {
              const t = byTeam.get(a.team.id) || { id: a.team.id, name: a.team.name, category: a.team.category, rows: [] as typeof service.assignments };
              t.rows.push(a);
              byTeam.set(a.team.id, t);
            }
            const sections = [...byTeam.values()].sort((x, y) =>
              (CAT_ORDER[x.category] ?? 9) - (CAT_ORDER[y.category] ?? 9) || x.name.localeCompare(y.name)
            );
            if (!sections.length)
              return (
                <Card>
                  <div className="p-6">
                    <EmptyState title="No departments added yet" hint="Add positions when creating the event, or add one below from a department you lead." icon={<Users className="h-6 w-6" />} />
                  </div>
                </Card>
              );
            return sections.map((team) => {
              const rows = team.rows;
              const open = rows.filter((r) => r.status === "OPEN").length;
              const pending = rows.filter((r) => r.status === "PENDING").length;
              const declined = rows.filter((r) => ["DECLINED", "REPLACEMENT_REQUESTED"].includes(r.status)).length;
              const filled = rows.length - open - pending - declined;
              const canEditTeam = canSchedule || ledIds.has(team.id);
              return (
                <Card key={team.id}>
                  <CardHeader
                    title={
                      <span className="flex items-center gap-2">
                        <span className={`h-2.5 w-2.5 rounded-full ${CAT_COLOR[team.category] || "bg-ink/30"}`} aria-hidden />
                        {team.name}
                      </span>
                    }
                    subtitle={`${rows.length} position${rows.length === 1 ? "" : "s"} · ${filled} filled${open ? ` · ${open} open` : ""}${pending ? ` · ${pending} awaiting` : ""}${declined ? ` · ${declined} needs help` : ""}`}
                    icon={<Users className="h-4 w-4" />}
                    action={
                      canEditTeam ? (
                        <form action={addServicePosition} className="flex items-center gap-1.5">
                          <input type="hidden" name="serviceId" value={service.id} />
                          <input type="hidden" name="teamId" value={team.id} />
                          <input
                            name="positionName"
                            required
                            maxLength={60}
                            placeholder="e.g. Trumpet, Cajon, Translator…"
                            aria-label={`Add a position or instrument to ${team.name}`}
                            className="input w-44 py-1.5 text-xs"
                          />
                          <button className="btn-secondary btn-sm whitespace-nowrap">+ Add position</button>
                        </form>
                      ) : undefined
                    }
                  />
                  <ul className="divide-y divide-line/70">
                    {rows.map((a) => {
                      const sug = suggestionByAssignment.get(a.id);
                      const st = ASSIGNMENT_STATUS[a.status];
                      const mine = !!a.personId && a.personId === user.personId;
                      return (
                        <li key={a.id} className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold text-ink">{a.positionName}</p>
                              {a.person ? (
                                <Link href={`/people/${a.personId}`} className="text-sm font-semibold text-brand-700 hover:underline">
                                  {a.person.name}
                                </Link>
                              ) : (
                                <p className="text-sm font-semibold text-amber-600">Open — needs someone</p>
                              )}
                            </div>
                            <B className={st.className}>{st.label}</B>
                            {(mine || isAdminTier(user) || ledIds.has(a.teamId)) && a.status === "PENDING" && (
                              <span className="flex items-center gap-1.5">
                                <form action={respondToAssignment}>
                                  <input type="hidden" name="assignmentId" value={a.id} />
                                  <input type="hidden" name="action" value="accept" />
                                  <button className="btn-secondary btn-sm border-emerald-200 text-emerald-700">Accept</button>
                                </form>
                                {mine ? (
                                  <Modal
                                    title="Why are you declining?"
                                    subtitle={`${a.positionName} · ${a.team.name}`}
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
                                          placeholder="e.g. Traveling upcountry that weekend."
                                        />
                                      </div>
                                      <p className="text-xs leading-relaxed text-ink/50">Your reason is shared with the team leaders so they can find a replacement.</p>
                                      <button className="btn w-full border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100">Send decline with reason</button>
                                    </form>
                                  </Modal>
                                ) : (
                                  <form action={respondToAssignment}>
                                    <input type="hidden" name="assignmentId" value={a.id} />
                                    <input type="hidden" name="action" value="decline" />
                                    <button className="btn-ghost btn-sm text-ink/40">Decline</button>
                                  </form>
                                )}
                              </span>
                            )}
                            {(() => {
                              const list = (canSchedule || ledIds.has(a.teamId)) ? browseFor(a) : [];
                              if (!list.length) return null;
                              return (
                              <Modal
                                title={`${a.positionName} — skilled people`}
                                subtitle={`${list.length} match${list.length === 1 ? "" : "es"} for this position`}
                                wide
                                trigger={<button className="btn-secondary btn-sm"><Users className="h-3.5 w-3.5" /> {list.length} match{list.length === 1 ? "" : "es"}</button>}
                              >
                                <ul className="max-h-[62vh] divide-y divide-line overflow-y-auto">
                                  {list.map(({ person, onTeam, cand }) => (
                                    <li key={person.id} className="flex flex-wrap items-center gap-3 py-3">
                                      <Avatar name={person.name} size={34} />
                                      <div className="min-w-0 flex-1">
                                        <p className="text-sm font-bold text-ink">{person.name}</p>
                                        <p className="truncate text-xs text-ink/50">{person.skills || "No skills listed"}</p>
                                        {cand && cand.blocked === false && cand.warnings.length > 0 && (
                                          <p className="text-xs text-amber-600">&#9888; {cand.warnings.join(" · ")}</p>
                                        )}
                                        {cand && cand.blocked === false && cand.warnings.length === 0 && cand.fit.length > 0 && (
                                          <p className="text-xs text-emerald-600">&#10003; {cand.fit.join(" · ")}</p>
                                        )}
                                      </div>
                                      {onTeam && <Badge className="border-line bg-paper text-ink/55">in {a.team.name}</Badge>}
                                      {person.id === a.personId ? (
                                        <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700">current</Badge>
                                      ) : (
                                        <form action={schedulePerson}>
                                          <input type="hidden" name="assignmentId" value={a.id} />
                                          <input type="hidden" name="personId" value={person.id} />
                                          <button className="btn-primary btn-sm">Request</button>
                                        </form>
                                      )}
                                    </li>
                                  ))}
                                </ul>
                              </Modal>
                              );
                            })()}
                            {(canSchedule || ledIds.has(a.teamId)) && a.personId && (
                              <Modal
                                title={`Change — ${a.positionName}`}                                subtitle={`Currently ${a.person?.name}. Pick someone else and they'll get a new request.`}
                                trigger={<button className="btn-secondary btn-sm">Change</button>}
                              >
                                <form action={schedulePerson} className="space-y-4">
                                  <input type="hidden" name="assignmentId" value={a.id} />
                                  <div>
                                    <label className="label" htmlFor={`chg-${a.id}`}>Who takes over?</label>
                                    <select id={`chg-${a.id}`} name="personId" required className="input">
                                      {(() => {
                                        const recs = (sug?.candidates || []).filter((c) => !c.blocked).map((c) => c.personId);
                                        const seen = new Set(recs);
                                        return [
                                          ...recs.map((pid) => {
                                            const p = people.find((x) => x.id === pid);
                                            return p ? <option key={pid} value={pid}>{p.name} — recommended</option> : null;
                                          }),
                                          ...people
                                            .filter((p) => !seen.has(p.id) && p.id !== a.personId)
                                            .map((p) => <option key={p.id} value={p.id}>{p.name}</option>),
                                        ];
                                      })()}
                                    </select>
                                  </div>
                                  <p className="text-xs leading-relaxed text-ink/50">
                                    The new person receives a request notification. {a.person?.name}&apos;s current request is replaced automatically.
                                  </p>
                                  <button className="btn-primary w-full">Send new request</button>
                                </form>
                              </Modal>
                            )}
                            {canSchedule && a.personId && (
                              <form action={unassign}>
                                <input type="hidden" name="assignmentId" value={a.id} />
                                <button className="btn-ghost btn-sm text-ink/40">Clear</button>
                              </form>
                            )}
                            {canEditTeam && !a.personId && (
                              <form action={deleteAssignment}>
                                <input type="hidden" name="assignmentId" value={a.id} />
                                <button className="btn-ghost btn-sm text-ink/30" aria-label={`Remove ${a.positionName} row`}>✕</button>
                              </form>
                            )}
                          </div>
                          {a.note && <p className="mt-1.5 text-xs italic text-ink/55">“{a.note}”</p>}

                          {canSchedule && sug && sug.candidates.filter((c) => !c.blocked).length > 0 && (
                            <div className="mt-3 rounded-xl border border-line bg-paper/60 p-3">
                              <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-700">
                                <Sparkles className="h-3.5 w-3.5" /> Recommended {a.personId ? "replacements" : "people"}
                              </p>
                              <div className="flex flex-wrap gap-2">
                                {sug.candidates.filter((c) => !c.blocked).slice(0, 4).map((c) => (
                                  <form key={c.personId} action={schedulePerson} className="inline">
                                    <input type="hidden" name="assignmentId" value={a.id} />
                                    <input type="hidden" name="personId" value={c.personId} />
                                    <button
                                      className="flex items-center gap-2 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-xs font-semibold text-ink transition hover:border-brand-400 hover:bg-brand-50"
                                      title={c.warnings.join("\n") || c.fit.join(", ")}
                                    >
                                      <Avatar name={c.name} size={22} />
                                      {c.name.split(" ")[0]}
                                      {c.warnings.length > 0 && <span className="text-amber-500">⚠</span>}
                                    </button>
                                  </form>
                                ))}
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </Card>
              );
            });
          })()}
        </div>
      )}

      {tab === "tasks" && (
        <Card>
          <CardHeader title="Preparation tasks" subtitle="What needs to happen before this service" icon={<ListChecks className="h-4 w-4" />} />
          <div className="p-5">
            <form action={createTask} className="mb-5 grid gap-3 sm:grid-cols-[1.6fr_1.2fr_1fr_auto]">
              <input type="hidden" name="serviceId" value={service.id} />
              <input name="title" required placeholder="e.g. Print order of service" aria-label="Task title" className="input" />
              <select name="assigneeId" aria-label="Assign to" className="input">
                <option value="">Unassigned</option>
                {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <input name="dueDate" type="date" aria-label="Due date" className="input" defaultValue={service.date} />
              <button className="btn-primary"><FileText className="h-4 w-4" /> Add</button>
            </form>
            {service.tasks.length === 0 ? (
              <EmptyState title="No tasks yet" hint="Add preparation tasks so nothing falls through." icon={<ListChecks className="h-6 w-6" />} />
            ) : (
              <ul className="divide-y divide-line/70">
                {service.tasks.map((t) => {
                  const next = t.status === "TODO" ? "IN_PROGRESS" : t.status === "IN_PROGRESS" ? "DONE" : "TODO";
                  const btnLabel = t.status === "TODO" ? "Start" : t.status === "IN_PROGRESS" ? "Mark done" : "Reopen";
                  return (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 py-3">
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-semibold ${t.status === "DONE" ? "line-through text-ink/40" : "text-ink"}`}>{t.title}</p>
                        <p className="text-xs text-ink/50">{t.dueDate ? `due ${fmtDate(t.dueDate)}` : "no due date"}</p>
                      </div>
                      {t.priority && <B className={TASK_PRIORITY[t.priority]?.className}>{TASK_PRIORITY[t.priority]?.label || t.priority}</B>}
                      <form action={moveTask}>
                        <input type="hidden" name="taskId" value={t.id} />
                        <input type="hidden" name="status" value={next} />
                        <button className="btn-secondary btn-sm">{btnLabel}</button>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>
      )}

      {tab === "discussion" && (
        <Card>
          <CardHeader title="Team discussion" subtitle="Coordinate with everyone on this service" icon={<MessageSquare className="h-4 w-4" />} />
          <div className="p-5">
            <form action={addServiceComment} className="mb-5 flex gap-2">
              <input type="hidden" name="serviceId" value={service.id} />
              <input name="body" required placeholder="Share an update or ask a question…" aria-label="Write a comment" className="input flex-1" />
              <button className="btn-primary"><Send className="h-4 w-4" /> Post</button>
            </form>
            {service.comments.length === 0 ? (
              <EmptyState title="No messages yet" hint="Notes and questions for the whole team appear here." icon={<MessageSquare className="h-6 w-6" />} />
            ) : (
              <ul className="space-y-4">
                {service.comments.map((c) => (
                  <li key={c.id} className="flex gap-3">
                    <Avatar name={c.user?.name || "?"} size={36} />
                    <div className="min-w-0 flex-1 rounded-2xl border border-line bg-paper/60 px-4 py-3">
                      <p className="text-xs font-bold text-ink">
                        {c.user?.name || "Someone"} <span className="ml-1 font-normal text-ink/40">{fmtDate(new Date(c.createdAt).toISOString().slice(0, 10))}</span>
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-ink/80">{c.body}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Display helpers ──

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "gold" | "green";
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-2xl border p-3.5 ${
        tone === "gold"
          ? "border-gold-200 bg-gold-50/60"
          : tone === "green"
            ? "border-emerald-200 bg-emerald-50/60"
            : "border-line bg-paper/60"
      }`}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          tone === "gold" ? "bg-gold-500 text-white" : tone === "green" ? "bg-emerald-500 text-white" : "bg-brand-100 text-brand-700"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wide text-ink/45">{label}</p>
        <p className="truncate text-sm font-extrabold text-ink">{value}</p>
      </div>
    </div>
  );
}

/** Start time of a plan item, walking the durations of everything before it. */
function cumulative(items: { sortOrder: number; durationSec: number }[], startTime: string, sortOrder: number): string {
  let t = startTime;
  for (const it of [...items].sort((a, b) => a.sortOrder - b.sortOrder)) {
    if (it.sortOrder >= sortOrder) break;
    t = addMinutes(t, it.durationSec || 0);
  }
  return t;
}

function OrderRow({
  item,
  startTime,
}: {
  item: {
    id: string;
    title: string;
    type: string;
    durationSec: number;
    key?: string | null;
    notes?: string | null;
    songId?: string | null;
  };
  startTime: string;
}) {
  const t = ITEM_TYPES[item.type] || ITEM_TYPES.OTHER;
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/40">
      <span className="w-12 text-xs font-bold text-brand-700">{fmtTime(startTime)}</span>
      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: t.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-ink">{item.title}</p>
        {item.notes && <p className="truncate text-xs text-ink/50">{item.notes}</p>}
      </div>
      {item.key && <Badge className="border-brand-200 bg-brand-50 text-brand-700">Key {item.key}</Badge>}
      {item.songId && (
        <Link href={`/songs/${item.songId}`} className="text-xs font-bold text-brand-700 hover:underline no-print">
          Chart →
        </Link>
      )}
      <span className="chip border-line bg-paper text-ink/55">{t.label}</span>
      <span className="w-14 text-right text-xs font-semibold text-ink/45">{Math.round((item.durationSec || 0) / 60)} min</span>
    </li>
  );
}
