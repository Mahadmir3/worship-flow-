import Link from "next/link";
import { Plus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { TEAM_CATEGORY } from "@/lib/constants";
import { canDo } from "@/lib/perms";
import { todayIn } from "@/lib/format";
import { getCampusFilter } from "@/actions/settings";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createTeam, deleteTeam } from "@/actions/teams";
import { isAdminTier } from "@/lib/perms";
import { ModalForm } from "@/components/ModalForm";
import { SwipeToDelete } from "@/components/SwipeToDelete";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const user = await requireUser();
  const today = todayIn(user.organization.timezone);
  const campusFilter = await getCampusFilter();
  const isAdmin = isAdminTier(user);

  const [teams, people, upcomingAssignments] = await Promise.all([
    prisma.team.findMany({
      where: { organizationId: user.organizationId, ...(campusFilter ? { campusId: campusFilter } : {}) },
      include: {
        members: { where: { status: "ACTIVE" }, include: { person: true } },
        leader: true,
        positions: { orderBy: { sortOrder: "asc" } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.assignment.findMany({
      where: {
        status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
        service: { date: { gte: today }, organizationId: user.organizationId },
      },
      include: { service: true, person: true },
    }),
  ]);

  const nextByTeam = new Map<string, { date: string; people: string[] }>();
  for (const a of upcomingAssignments) {
    const rec = nextByTeam.get(a.teamId) || { date: a.service.date, people: [] };
    if (a.service.date < rec.date || !rec.date) rec.date = a.service.date;
    if (a.person && a.service.date === rec.date) rec.people.push(`${a.person.name.split(" ")[0]} — ${a.positionName}`);
    nextByTeam.set(a.teamId, rec);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Teams</h1>
          <p className="mt-1 text-sm text-ink/50">{teams.length} teams · unlimited custom teams supported</p>
        </div>
        {(await canDo(user, "manage_teams")) && (
          <Modal
            title="Create a team"
            subtitle="Positions become the roles you schedule people into."
            trigger={<button className="btn-primary"><Plus className="h-4 w-4" /> New team</button>}
          >
            <ModalForm action={createTeam} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="tm-name">Team name</label>
                  <input id="tm-name" name="name" required className="input" placeholder="e.g. Media Team" />
                </div>
                <div>
                  <label className="label" htmlFor="tm-cat">Category</label>
                  <select id="tm-cat" name="category" className="input">
                    {Object.entries(TEAM_CATEGORY).map(([id, c]) => (
                      <option key={id} value={id}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="tm-leader">Team leader</label>
                <select id="tm-leader" name="leaderPersonId" className="input">
                  <option value="">—</option>
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="tm-positions">Positions (comma separated)</label>
                <input id="tm-positions" name="positions" className="input" placeholder="e.g. Camera, Editor, Presenter" />
              </div>
              <div>
                <label className="label" htmlFor="tm-desc">Description</label>
                <textarea id="tm-desc" name="description" rows={2} className="input" />
              </div>
              <button className="btn-primary w-full">Create team</button>
            </ModalForm>
          </Modal>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Users className="h-6 w-6" />} title="No teams yet" hint="Create teams to start scheduling volunteers into positions." />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => {
            const cat = TEAM_CATEGORY[team.category] || TEAM_CATEGORY.CUSTOM;
            const next = nextByTeam.get(team.id);
            return (
              <SwipeToDelete
              key={team.id} action={deleteTeam} id={team.id} confirmLabel={team.name} enabled={isAdmin}>
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="card flex flex-col gap-4 p-5 transition hover:border-brand-300 hover:shadow-pop"
               prefetch={false}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl text-white" style={{ background: cat.color }}>
                    <Users className="h-5 w-5" />
                  </span>
                  <Badge className="border-line bg-paper text-ink/55">{cat.label}</Badge>
                </div>
                <div>
                  <p className="text-base font-extrabold text-ink">{team.name}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {team.members.length} member{team.members.length === 1 ? "" : "s"} · {team.positions.length} position{team.positions.length === 1 ? "" : "s"}
                    {team.leader ? ` · led by ${team.leader.name}` : ""}
                  </p>
                </div>
                <div className="mt-auto rounded-xl bg-paper px-3.5 py-3">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-ink/40">
                    {next ? `Next service · ${next.date}` : "No upcoming assignments"}
                  </p>
                  {next && (
                    <p className="mt-1 line-clamp-2 text-xs font-medium leading-relaxed text-ink/70">
                      {next.people.slice(0, 4).join(" · ")}
                      {next.people.length > 4 ? ` +${next.people.length - 4}` : ""}
                    </p>
                  )}
                </div>
              </Link>
              </SwipeToDelete>
            );
          })}
        </div>
      )}
    </div>
  );
}
