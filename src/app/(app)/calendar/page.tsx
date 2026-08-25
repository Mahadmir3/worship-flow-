import Link from "next/link";
import { Church, Music4 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { fmtTime, todayIn } from "@/lib/format";

export const metadata = { title: "Calendar" };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default async function CalendarPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ y?: string; m?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const today = todayIn(user.organization.timezone);

  const now = new Date(today + "T12:00:00Z");
  const year = Number(searchParams.y) || now.getUTCFullYear();
  const monthIdx = Number(searchParams.m) || now.getUTCMonth() + 1; // 1-12
  const monthStart = `${year}-${String(monthIdx).padStart(2, "0")}-01`;
  const daysInMonth = new Date(Date.UTC(year, monthIdx, 0)).getUTCDate();
  const monthEnd = `${year}-${String(monthIdx).padStart(2, "0")}-${String(daysInMonth).padStart(2, "0")}`;

  const [services, rehearsals] = await Promise.all([
    prisma.service.findMany({
      where: { organizationId: user.organizationId, date: { gte: monthStart, lte: monthEnd } },
      include: { type: true, campus: true },
      orderBy: { date: "asc" },
    }),
    prisma.rehearsal.findMany({
      where: { organizationId: user.organizationId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const byDate = new Map<string, { services: typeof services; rehearsals: typeof rehearsals }>();
  for (const s of services) {
    const rec = byDate.get(s.date) || { services: [], rehearsals: [] };
    rec.services.push(s);
    byDate.set(s.date, rec);
  }
  for (const r of rehearsals) {
    const rec = byDate.get(r.date) || { services: [], rehearsals: [] };
    rec.rehearsals.push(r);
    byDate.set(r.date, rec);
  }

  const firstWeekday = new Date(monthStart + "T12:00:00Z").getUTCDay();
  const cells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => `${monthStart.slice(0, 8)}${String(i + 1).padStart(2, "0")}`),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const prev = monthIdx === 1 ? { y: year - 1, m: 12 } : { y: year, m: monthIdx - 1 };
  const nextM = monthIdx === 12 ? { y: year + 1, m: 1 } : { y: year, m: monthIdx + 1 };
  const monthName = new Date(monthStart + "T12:00:00Z").toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Calendar</h1>
          <p className="mt-1 text-sm text-ink/50">Services and rehearsals across your church</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/calendar?y=${prev.y}&m=${prev.m}`} className="btn-secondary btn-sm" aria-label="Previous month">←</Link>
          <span className="min-w-[10rem] text-center text-sm font-bold text-ink">{monthName}</span>
          <Link href={`/calendar?y=${nextM.y}&m=${nextM.m}`} className="btn-secondary btn-sm" aria-label="Next month">→</Link>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="grid grid-cols-7 border-b border-line bg-paper/60">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-ink/45">
              <span className="hidden sm:inline">{d}</span>
              <span className="sm:hidden">{d[0]}</span>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((date, i) => {
            if (!date) return <div key={i} className="min-h-[5.5rem] border-b border-r border-line/50 bg-paper/30 p-1.5" />;
            const rec = byDate.get(date);
            const isToday = date === today;
            return (
              <div
                key={date}
                className={`min-h-[5.5rem] border-b border-r border-line/50 p-1.5 ${isToday ? "bg-gold-50" : ""}`}
              >
                <p className={`mb-1 inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] font-bold ${isToday ? "bg-gold-500 text-white" : "text-ink/45"}`}>
                  {Number(date.slice(8))}
                </p>
                <div className="space-y-1">
                  {rec?.services.slice(0, 2).map((s) => (
                    <Link
                      key={s.id}
                      href={`/services/${s.id}`}
                      className="block truncate rounded-md px-1.5 py-1 text-[11px] font-semibold text-white hover:opacity-90"
                      style={{ background: s.type?.color || "#323A8C" }}
                      title={`${s.title} ${s.startTime}`}
                    >
                      <Church className="mr-1 inline h-3 w-3" />
                      {fmtTime(s.startTime).replace(" ", "")} {s.title}
                    </Link>
                  ))}
                  {rec?.rehearsals.slice(0, 1).map((r) => (
                    <Link
                      key={r.id}
                      href={`/rehearsals/${r.id}`}
                      className="block truncate rounded-md border border-gold-300 bg-gold-100 px-1.5 py-1 text-[11px] font-semibold text-gold-800 hover:bg-gold-200"
                      title={`${r.title} ${r.startTime}`}
                    >
                      <Music4 className="mr-1 inline h-3 w-3" />
                      {r.title}
                    </Link>
                  ))}
                  {(rec?.services.length || 0) > 2 && (
                    <p className="px-1 text-[10px] font-semibold text-ink/45">+{rec!.services.length - 2} more</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
