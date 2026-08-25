import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TEAM_CATEGORY } from "@/lib/constants";
import { canManageTeam } from "@/lib/perms";
import { fmtDate, relativeDay, todayIn } from "@/lib/format";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { addPosition, addTeamMember, deletePosition, removeTeamMember } from "@/actions/teams";

export const metadata = { title: "Team" };

export default async function TeamDetailPage({
  params: paramsPromise,
  searchParams: searchParamsPromise,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await paramsPromise;
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const q = (searchParams.q || "").trim().toLowerCase();
  const team = await prisma.team.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      leader: true,
      positions: { orderBy: { sortOrder: "asc" } },
      members: { where: { status: "ACTIVE" }, include: { person: { include: { blockouts: true } } } },
      campus: true,
    },
  });
  if (!team) notFound();

  const today = todayIn(user.organization.timezone);
  const editable = await canManageTeam(user, team.id);
  const members = q
    ? team.members.filter((m) =>
        [m.person.name, m.person.email, m.person.skills, m.skills].filter(Boolean).join(" ").toLowerCase().includes(q)
      )
    : team.members;

  const [people, upcoming, recent] = await Promise.all([
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: {
        teamId: team.id,
        status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
        service: { date: { gte: today } },
      },
      include: { service: true, person: true },
      orderBy: { service: { date: "asc" } },
      take: 12,
    }),
    prisma.assignment.findMany({
      where: {
        teamId: team.id,
        status: { in: ["ACCEPTED", "CONFIRMED"] },
        service: { date: { lt: today, gte: shift(today, -90) } },
      },
      include: { service: true, person: true },
      orderBy: { service: { date: "desc" } },
      take: 30,
    }),
  ]);

  const cat = TEAM_CATEGORY[team.category] || TEAM_CATEGORY.CUSTOM;
  const memberIds = new Set(team.members.map((m) => m.personId));
  const serveCount = new Map<string, number>();
  for (const r of recent) {
    if (r.personId) serveCount.set(r.personId, (serveCount.get(r.personId) || 0) + 1);
  }

  return (
    <div className="space-y-6">
      <Link href="/teams" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
        <ArrowLeft className="h-4 w-4" /> All teams
      </Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-white" style={{ background: cat.color }}>
              <Users className="h-7 w-7" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-ink">{team.name}</h1>
                <Badge className="border-line bg-paper text-ink/55">{cat.label}</Badge>
              </div>
              <p className="mt-1 text-sm text-ink/55">
                {team.members.length} members · {team.positions.length} positions
                {team.leader ? ` · led by ${team.leader.name}` : ""}
                {team.campus ? ` · ${team.campus.name}` : ""}
              </p>
              {team.description && <p className="mt-2 max-w-xl text-sm text-ink/60">{team.description}</p>}
            </div>
          </div>
          {editable && (
            <div className="flex gap-2">
              <Modal
                title="Add member"
                trigger={<button className="btn-primary btn-sm"><UserPlus className="h-4 w-4" /> Add member</button>}
              >
                <form action={addTeamMember} className="space-y-4">
                  <input type="hidden" name="teamId" value={team.id} />
                  <div>
                    <label className="label" htmlFor="m-person">Person</label>
                    <select id="m-person" name="personId" required className="input">
                      {people.filter((p) => !memberIds.has(p.id)).map((p) => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label" htmlFor="m-skills">Skills (e.g. “Drums, Percussion”)</label>
                    <input id="m-skills" name="skills" className="input" />
                  </div>
                  <button className="btn-primary w-full">Add to team</button>
                </form>
              </Modal>
              <Modal
                title="Add position"
                trigger={<button className="btn-secondary btn-sm"><Plus className="h-4 w-4" /> Add position</button>}
              >
                <form action={addPosition} className="space-y-4">
                  <input type="hidden" name="teamId" value={team.id} />
                  <div>
                    <label className="label" htmlFor="p-name">Position name</label>
                    <input id="p-name" name="name" required className="input" placeholder="e.g. Cello" />
                  </div>
                  <button className="btn-primary w-full">Add position</button>
                </form>
              </Modal>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader
            title="Members"
            subtitle={q ? `${members.length} of ${team.members.length} matching “${q}”` : "Skills, serving load & availability"}
            icon={<Users className="h-4 w-4" />}
          />
          {team.members.length > 0 && (
            <form role="search" className="flex gap-2 border-b border-line px-5 py-3">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
                <input
                  name="q"
                  defaultValue={q}
                  className="input pl-10"
                  placeholder="Search members by name, email or skill…"
                  aria-label={`Search ${team.name} members`}
                />
              </div>
              <button className="btn-secondary">Search</button>
              {q && <Link href={`/teams/${team.id}`} className="btn-ghost text-ink/50">Clear</Link>}
            </form>
          )}
          {team.members.length === 0 ? (
            <EmptyState title="No members yet" hint="Add your first volunteer to this team." icon={<UserPlus className="h-6 w-6" />} />
          ) : members.length === 0 ? (
            <EmptyState title="No matches" hint={`Nobody on ${team.name} matches “${q}”.`} icon={<UserPlus className="h-6 w-6" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[34rem]">
                <thead>
                  <tr className="border-b border-line">
                    <th className="th">Member</th>
                    <th className="th">Skills</th>
                    <th className="th">Served (90d)</th>
                    <th className="th">Availability</th>
                    {editable && <th className="th w-10"><span className="sr-only">Actions</span></th>}
                  </tr>
                </thead>
                <tbody>
                  {members.map((m) => {
                    const upcomingBlockouts = m.person.blockouts.filter(
                      (b) => b.weekday !== null || (b.endDate >= today)
                    );
                    return (
                      <tr key={m.id} className="border-b border-line/60 last:border-0">
                        <td className="td">
                          <Link href={`/people/${m.personId}`} className="flex items-center gap-2.5 hover:text-brand-700">
                            <Avatar name={m.person.name} size={32} />
                            <span>
                              <span className="flex items-center gap-1 font-semibold text-ink">
                                {m.person.name}
                                {m.isLeader && <BadgeCheck className="h-4 w-4 text-gold-500" aria-label="Team leader" />}
                              </span>
                              <span className="text-xs text-ink/45">{m.person.email || m.person.phone || ""}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="td text-ink/60">{m.skills || m.person.skills || "—"}</td>
                        <td className="td">
                          <span className="chip border-line bg-paper text-ink/65">
                            <Zap className="h-3 w-3 text-gold-500" /> {serveCount.get(m.personId) || 0}×
                          </span>
                        </td>
                        <td className="td">
                          {upcomingBlockouts.length ? (
                            <span className="chip border-rose-200 bg-rose-50 text-rose-600">
                              {upcomingBlockouts.length} blockout{upcomingBlockouts.length > 1 ? "s" : ""}
                            </span>
                          ) : (
                            <span className="chip border-emerald-200 bg-emerald-50 text-emerald-600">Available</span>
                          )}
                        </td>
                        {editable && (
                          <td className="td">
                            <form action={removeTeamMember}>
                              <input type="hidden" name="teamId" value={team.id} />
                              <input type="hidden" name="membershipId" value={m.id} />
                              <button className="rounded-lg p-1.5 text-ink/30 hover:bg-rose-50 hover:text-rose-600" aria-label={`Remove ${m.person.name}`}>
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </form>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Positions" subtitle="Scheduled on every service" icon={<BadgeCheck className="h-4 w-4" />} />
            <ul className="divide-y divide-line/70">
              {team.positions.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                  <span className="text-sm font-medium text-ink">{p.name}</span>
                  {editable && (
                    <form action={deletePosition}>
                      <input type="hidden" name="teamId" value={team.id} />
                      <input type="hidden" name="positionId" value={p.id} />
                      <button className="rounded-lg p-1.5 text-ink/25 hover:bg-rose-50 hover:text-rose-600" aria-label={`Delete ${p.name}`}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
              {team.positions.length === 0 && (
                <li className="px-5 py-4 text-sm text-ink/45">No positions defined.</li>
              )}
            </ul>
          </Card>

          <Card>
            <CardHeader title="Upcoming assignments" icon={<CalendarDays className="h-4 w-4" />} />
            {upcoming.length === 0 ? (
              <EmptyState title="Nothing scheduled yet" />
            ) : (
              <ul className="divide-y divide-line/70">
                {upcoming.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar name={a.person?.name || "?"} size={30} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-ink">{a.person?.name || "Open"}</p>
                      <Link href={`/services/${a.serviceId}`} className="text-xs text-ink/50 hover:text-brand-700">
                        {a.positionName} · {relativeDay(a.service.date, user.organization.timezone)}
                      </Link>
                    </div>
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

function shift(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
