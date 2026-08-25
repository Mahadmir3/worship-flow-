import { AlertTriangle, BarChart3, CheckCircle2, Flame, TrendingUp, Users } from "lucide-react";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAny } from "@/lib/perms";
import { todayIn } from "@/lib/format";
import { Card, CardHeader, EmptyState, StatCard } from "@/components/ui/primitives";
import { BarChart, Donut, HBar, Sparkline } from "@/components/charts";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const user = await requireUser();
  if (!(await canAny(user, ["view_analytics", "manage_org"]))) {
    return (
      <div className="card">
        <EmptyState icon={<BarChart3 className="h-6 w-6" />} title="Analytics is available to leaders" hint="Ask an administrator for access." />
      </div>
    );
  }
  const orgId = user.organizationId;
  const today = todayIn(user.organization.timezone);

  const [assignments, services, songItems, people, teams, attendance] = await Promise.all([
    prisma.assignment.findMany({
      where: { service: { organizationId: orgId } },
      include: { person: true, service: true, team: true },
    }),
    prisma.service.findMany({ where: { organizationId: orgId }, orderBy: { date: "asc" } }),
    prisma.serviceItem.findMany({ where: { service: { organizationId: orgId }, songId: { not: null } }, include: { song: true } }),
    prisma.person.findMany({ where: { organizationId: orgId }, include: { assignments: true } }),
    prisma.team.findMany({ where: { organizationId: orgId }, include: { assignments: true } }),
    prisma.attendance.findMany({ where: { service: { organizationId: orgId } } }),
  ]);

  const responded = assignments.filter((a) => ["ACCEPTED", "CONFIRMED", "DECLINED"].includes(a.status));
  const accepted = assignments.filter((a) => ["ACCEPTED", "CONFIRMED"].includes(a.status));
  const declined = assignments.filter((a) => a.status === "DECLINED");
  const confirmRate = responded.length ? Math.round((accepted.length / responded.length) * 100) : 0;
  const declineRate = responded.length ? Math.round((declined.length / responded.length) * 100) : 0;
  const openPositions = assignments.filter((a) => a.status === "OPEN").length;

  // Most scheduled volunteers (last 90 days)
  const since90 = shift(today, -90);
  const countByPerson = new Map<string, number>();
  for (const a of assignments) {
    if (a.personId && ["ACCEPTED", "CONFIRMED", "PENDING"].includes(a.status) && a.service.date >= since90) {
      countByPerson.set(a.person.name, (countByPerson.get(a.person.name) || 0) + 1);
    }
  }
  const topVolunteers = [...countByPerson.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // Most used songs
  const countBySong = new Map<string, number>();
  for (const i of songItems) {
    if (i.song) countBySong.set(i.song.title, (countBySong.get(i.song.title) || 0) + 1);
  }
  const topSongs = [...countBySong.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Services per month (last 8 months)
  const months: string[] = [];
  for (let i = 7; i >= 0; i--) {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCMonth(d.getUTCMonth() - i);
    months.push(d.toISOString().slice(0, 7));
  }
  const servicesPerMonth = months.map((m) => services.filter((s) => s.date.startsWith(m)).length);
  const monthLabels = months.map((m) => new Date(m + "-01T12:00:00Z").toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }));

  // Team participation
  const teamParticipation = teams
    .map((t) => ({
      label: t.name.replace(" Team", ""),
      value: t.assignments.filter((a) => a.personId).length,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Burnout: people whose 90-day load exceeds 2× preferred monthly frequency
  const burnout = people
    .map((p) => {
      const load = p.assignments.filter(
        (a) => ["ACCEPTED", "CONFIRMED", "PENDING"].includes(a.status) && (a as any).service?.date >= since90
      ).length;
      return { p, load };
    })
    .filter(({ p, load }) => load > p.preferredFrequency * 2)
    .sort((a, b) => b.load - a.load)
    .slice(0, 5);

  const attendanceRate = attendance.length
    ? Math.round((attendance.filter((a) => a.status !== "ABSENT").length / attendance.length) * 100)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Analytics</h1>
        <p className="mt-1 text-sm text-ink/50">Volunteer health, participation and music insights</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Confirmation rate" value={`${confirmRate}%`} sub={`${accepted.length} accepted`} tone="green" icon={<CheckCircle2 className="h-5 w-5" />} />
        <StatCard label="Decline rate" value={`${declineRate}%`} sub={`${declined.length} declined`} tone={declineRate > 20 ? "red" : "brand"} icon={<TrendingUp className="h-5 w-5" />} />
        <StatCard label="Open positions" value={openPositions} sub="all upcoming services" tone={openPositions ? "gold" : "green"} icon={<AlertTriangle className="h-5 w-5" />} />
        <StatCard label="Attendance" value={attendanceRate !== null ? `${attendanceRate}%` : "—"} sub={`${services.filter((s) => s.date < today).length} past services`} tone="cyan" icon={<Users className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Services per month" subtitle="Last 8 months" icon={<BarChart3 className="h-4 w-4" />} />
          <div className="p-5">
            <Sparkline points={servicesPerMonth} />
            <div className="mt-1 flex justify-between text-[10px] font-semibold text-ink/40">
              {monthLabels.map((m, i) => (
                <span key={i}>{m}</span>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Confirmation rate" subtitle="Across all scheduling requests" icon={<CheckCircle2 className="h-4 w-4" />} />
          <div className="flex items-center justify-center p-6">
            <Donut value={confirmRate} label="confirmed" sublabel={`${responded.length} responses`} />
          </div>
        </Card>

        <Card>
          <CardHeader title="Most scheduled volunteers" subtitle="Last 90 days" icon={<Flame className="h-4 w-4" />} />
          <div className="p-5">
            {topVolunteers.length ? <HBar data={topVolunteers} color="#C9952E" /> : <EmptyState title="No data yet" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Most used songs" subtitle="All services" icon={<BarChart3 className="h-4 w-4" />} />
          <div className="p-5">
            {topSongs.length ? <HBar data={topSongs} /> : <EmptyState title="No data yet" />}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <Card>
          <CardHeader title="Team participation" subtitle="Filled assignments per team" icon={<Users className="h-4 w-4" />} />
          <div className="p-5">
            {teamParticipation.length ? <BarChart data={teamParticipation} /> : <EmptyState title="No data yet" />}
          </div>
        </Card>

        <Card>
          <CardHeader title="Burnout watchlist" subtitle="Serving more than twice their preferred frequency" icon={<AlertTriangle className="h-4 w-4" />} />
          {burnout.length === 0 ? (
            <EmptyState title="No burnout risks 🎉" hint="Everyone is serving within their preferred frequency." />
          ) : (
            <ul className="divide-y divide-line/70">
              {burnout.map(({ p, load }) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <Link href={`/people/${p.id}`} className="text-sm font-semibold text-ink hover:text-brand-700">
                    {p.name}
                  </Link>
                  <span className="chip border-amber-200 bg-amber-50 text-amber-700">
                    {load}× in 90 days (prefers {p.preferredFrequency}/month)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function shift(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
