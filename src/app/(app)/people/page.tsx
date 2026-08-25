import Link from "next/link";
import { Mic2, Plus, Search, UserPlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo } from "@/lib/perms";
import { todayIn } from "@/lib/format";
import { getCampusFilter } from "@/actions/settings";
import { Avatar, Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createPerson } from "@/actions/teams";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata = { title: "People" };

export default async function PeoplePage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const q = (searchParams.q || "").trim();
  const campusFilter = await getCampusFilter();
  const today = todayIn(user.organization.timezone);

  const [people, teams, users] = await Promise.all([
    prisma.person.findMany({
      where: {
        organizationId: user.organizationId,
        ...(q ? { OR: [{ name: { contains: q } }, { email: { contains: q } }, { skills: { contains: q } }] } : {}),
        ...(campusFilter ? { campusId: campusFilter } : {}),
      },
      include: {
        teamMemberships: { include: { team: true } },
        user: true,
        assignments: { where: { status: { in: ["ACCEPTED", "CONFIRMED"] }, service: { date: { gte: shift(today, -90) } } }, select: { id: true } },
        blockouts: { where: { OR: [{ endDate: { gte: today } }, { weekday: { not: null } }] } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.user.findMany({ where: { organizationId: user.organizationId }, select: { personId: true, role: true } }),
  ]);

  const roleByPerson = new Map(users.map((u) => [u.personId, ROLE_LABEL[u.role] || u.role]));
  const managePeople = await canDo(user, "manage_people");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">People</h1>
          <p className="mt-1 text-sm text-ink/50">{people.length} profiles{q && ` matching “${q}”`}</p>
        </div>
        {managePeople && (
          <Modal
            title="Add a person"
            subtitle="They can be invited to create an account later."
            wide
            trigger={<button className="btn-primary"><UserPlus className="h-4 w-4" /> Add person</button>}
          >
            <form action={createPerson} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="pe-name">Full name</label>
                  <input id="pe-name" name="name" required className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="pe-phone">Phone / WhatsApp</label>
                  <input id="pe-phone" name="phone" className="input" placeholder="+256 …" />
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="pe-email">Email</label>
                  <input id="pe-email" name="email" type="email" className="input" />
                </div>
                <div>
                  <label className="label" htmlFor="pe-team">Add to team</label>
                  <select id="pe-team" name="teamId" className="input">
                    <option value="">—</option>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="pe-skills">Skills</label>
                  <input id="pe-skills" name="skills" className="input" placeholder="e.g. Bass, Vocals" />
                </div>
                <div>
                  <label className="label" htmlFor="pe-freq">Preferred frequency</label>
                  <select id="pe-freq" name="preferredFrequency" className="input" defaultValue="2">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}× per month</option>
                    ))}
                  </select>
                </div>
              </div>
              <button className="btn-primary w-full">Add person</button>
            </form>
          </Modal>
        )}
      </div>

      <form className="flex gap-2" role="search">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/30" />
          <input
            name="q"
            defaultValue={q}
            className="input pl-10"
            placeholder="Search by name, email or skill…"
            aria-label="Search people"
          />
        </div>
        <button className="btn-secondary">Search</button>
      </form>

      {people.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Mic2 className="h-6 w-6" />} title="No people found" hint={q ? "Try a different search." : "Add your volunteers and musicians to get started."} />
        </div>
      ) : (
        <div className="card divide-y divide-line/70 overflow-hidden">
          {people.map((p) => (
            <Link key={p.id} href={`/people/${p.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-brand-50/50">
              <Avatar name={p.name} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{p.name}</p>
                <p className="truncate text-xs text-ink/50">
                  {p.email || p.phone || "No contact info"}
                  {p.skills ? ` · ${p.skills}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {p.teamMemberships.slice(0, 3).map((tm) => (
                  <Badge key={tm.id} className="border-brand-100 bg-brand-50 text-brand-700">{tm.team.name}</Badge>
                ))}
                {p.teamMemberships.length > 3 && <Badge className="border-line bg-paper text-ink/50">+{p.teamMemberships.length - 3}</Badge>}
                {p.blockouts.length > 0 && (
                  <Badge className="border-rose-200 bg-rose-50 text-rose-600">unavailable soon</Badge>
                )}
              </div>
              <div className="hidden w-24 text-right sm:block">
                <p className="text-xs font-bold text-ink/60">{p.assignments.length}×</p>
                <p className="text-[10px] uppercase tracking-wide text-ink/35">90 days</p>
              </div>
              {roleByPerson.get(p.id) && (
                <Badge className="hidden border-gold-200 bg-gold-50 text-gold-700 md:inline-flex">{roleByPerson.get(p.id)}</Badge>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function shift(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
