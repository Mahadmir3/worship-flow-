import "server-only";
import { prisma } from "@/lib/db";
import { fmtDate, daysUntil, todayIn } from "@/lib/format";

/**
 * Smart scheduling engine.
 * Ranks candidates for every open/pending position on a service using:
 *  – hard availability (blockout dates & recurring weekly blockouts)
 *  – position skill match
 *  – recent serving load (last 60 days) & preferred frequency (burnout guard)
 *  – same-day conflicts (other services) & minimum rest (consecutive services)
 *  – double-booking within the same service
 */

export type Candidate = {
  personId: string;
  name: string;
  score: number;
  fit: string[];
  warnings: string[];
  blocked: boolean;
};

export type PositionSuggestion = {
  assignmentId: string;
  positionName: string;
  teamName: string;
  teamColor: string;
  current?: { personId: string; name: string; status: string } | null;
  candidates: Candidate[];
  warning?: string;
};

export type ServiceWarnings = string[];

export async function buildSuggestions(
  serviceId: string,
  organizationId: string,
  onlyOpen = true
): Promise<{ suggestions: PositionSuggestion[]; warnings: ServiceWarnings }> {
  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId },
    include: { campus: true, type: true },
  });
  if (!service) return { suggestions: [], warnings: [] };

  const assignments = await prisma.assignment.findMany({
    where: onlyOpen
      ? { serviceId, status: { in: ["OPEN", "DECLINED", "REPLACEMENT_REQUESTED"] } }
      : { serviceId },
    include: { team: true, person: true },
    orderBy: [{ team: { name: "asc" } }, { positionName: "asc" }],
  });

  if (!assignments.length) return { suggestions: [], warnings: [] };

  const serviceDate = service.date;

  // Everything already scheduled on this date across the org (for conflicts).
  const sameDay = await prisma.assignment.findMany({
    where: {
      status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
      personId: { not: null },
      service: { date: serviceDate, organizationId },
    },
    include: { service: { include: { type: true, campus: true } }, person: true },
  });

  const since = new Date(Date.now() - 60 * 864e5);
  const recent = await prisma.assignment.findMany({
    where: {
      status: { in: ["ACCEPTED", "CONFIRMED", "PENDING"] },
      personId: { not: null },
      createdAt: { gte: since },
      service: { organizationId },
    },
    select: { personId: true, serviceId: true },
  });
  const recentCount = new Map<string, number>();
  for (const r of recent) {
    if (r.personId) recentCount.set(r.personId, (recentCount.get(r.personId) || 0) + 1);
  }

  const people = await prisma.person.findMany({
    where: { organizationId },
    include: {
      teamMemberships: true,
      blockouts: true,
    },
  });
  const personById = new Map(people.map((p) => [p.id, p]));

  const suggestions: PositionSuggestion[] = [];
  const warnings: ServiceWarnings = [];

  for (const a of assignments) {
    const members = await prisma.teamMember.findMany({
      where: { teamId: a.teamId, status: "ACTIVE" },
      include: { person: { include: { blockouts: true } } },
    });

    const candidates: Candidate[] = [];

    for (const m of members) {
      const p = m.person;
      const fit: string[] = [];
      const warns: string[] = [];
      let score = 50;
      let blocked = false;

      // 1. Hard availability
      for (const b of p.blockouts) {
        if (b.weekday !== null) {
          const wd = new Date(serviceDate + "T12:00:00Z").getUTCDay();
          if (wd === b.weekday) {
            blocked = true;
            fit.push(`Unavailable ${b.reason || "recurring"}`);
          }
        } else if (serviceDate >= b.startDate && serviceDate <= b.endDate) {
          blocked = true;
          fit.push(
            `Marked unavailable ${b.startDate === b.endDate ? fmtDate(b.startDate) : `${fmtDate(b.startDate)}–${fmtDate(b.endDate)}`}${b.reason ? ` (${b.reason})` : ""}`
          );
        }
      }

      // 2. Already in this service (another position)
      const inSameService = await prisma.assignment.findFirst({
        where: {
          serviceId,
          personId: p.id,
          id: { not: a.id },
          status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
        },
      });
      if (inSameService) {
        blocked = true;
        fit.push(`Already serving as ${inSameService.positionName} in this service`);
      }

      // 3. Skill match
      const skills = `${m.skills || ""} ${p.skills || ""}`.toLowerCase();
      if (skills.includes(a.positionName.toLowerCase())) {
        score += 25;
        fit.push(`Listed skill: ${a.positionName}`);
      } else {
        score -= 8;
      }

      // 4. Same-day conflicts
      const thatDay = sameDay.filter((s) => s.personId === p.id && s.serviceId !== serviceId);
      if (thatDay.length) {
        score -= 25;
        warns.push(
          `Already scheduled for ${thatDay.map((s) => s.service.title).join(", ")} on ${fmtDate(serviceDate)}`
        );
        if (thatDay.length >= 2) {
          warnings.push(`${p.name} is already scheduled for ${thatDay.length} services on ${fmtDate(serviceDate)}.`);
        }
      }

      // 5. Load & burnout guard
      const load = recentCount.get(p.id) || 0;
      score -= load * 3;
      if (p.preferredFrequency && load >= p.preferredFrequency * 2) {
        warns.push(`Serving a lot lately — ${load} assignments in 60 days (prefers ~${p.preferredFrequency}/month)`);
        warnings.push(`${p.name} may be over-scheduled (${load} assignments in 60 days).`);
      }

      if (m.isLeader) score += 5;

      candidates.push({ personId: p.id, name: p.name, score, fit, warnings: warns, blocked });
    }

    candidates.sort((x, y) => Number(x.blocked) - Number(y.blocked) || y.score - x.score);

    if (!candidates.length || candidates.every((c) => c.blocked)) {
      const open = a.personId
        ? `${a.person?.name ?? "Assignee"} currently holds this`
        : `No ${a.positionName.toLowerCase()} is currently assigned.`;
      warnings.push(
        a.personId
          ? `No available replacement found for ${a.positionName} — ${open}`
          : `No ${a.positionName.toLowerCase()} is currently assigned.`
      );
    }

    suggestions.push({
      assignmentId: a.id,
      positionName: a.positionName,
      teamName: a.team.name,
      teamColor: a.team.color,
      current: a.person
        ? { personId: a.person.id, name: a.person.name, status: a.status }
        : null,
      candidates: candidates.slice(0, 6),
    });
  }

  return { suggestions, warnings };
}

/** One-click auto-fill: schedule the best non-blocked candidate for each open position. */
export async function autoScheduleService(serviceId: string, organizationId: string) {
  const { suggestions } = await buildSuggestions(serviceId, organizationId, true);
  let scheduled = 0;
  const skipped: string[] = [];

  for (const s of suggestions) {
    const best = s.candidates.find((c) => !c.blocked);
    if (!best) {
      skipped.push(s.positionName);
      continue;
    }
    await prisma.assignment.update({
      where: { id: s.assignmentId },
      data: {
        personId: best.personId,
        status: "PENDING",
        notifiedAt: new Date(),
      },
    });
    scheduled++;
  }
  return { scheduled, skipped };
}

/** Org-wide conflict scan across upcoming services. */
export async function detectOrgConflicts(organizationId: string, horizonDays = 21) {
  const today = todayIn();
  const services = await prisma.service.findMany({
    where: {
      organizationId,
      date: { gte: today, lte: addDays(today, horizonDays) },
    },
    include: { assignments: { include: { person: true } }, campus: true, type: true },
    orderBy: { date: "asc" },
  });

  const warnings: string[] = [];
  const perPerson = new Map<string, { name: string; count: number; dates: string[] }>();

  for (const s of services) {
    const open = s.assignments.filter((a) => !a.personId || a.status === "OPEN");
    const critical = open.filter((a) =>
      /drum|sound|lead|keyboard|bass|guitar/i.test(a.positionName)
    );
    for (const a of critical) {
      warnings.push(`${fmtDate(s.date)} — no ${a.positionName.toLowerCase()} is assigned for "${s.title}".`);
    }
    for (const a of s.assignments) {
      if (!a.personId || !["ACCEPTED", "CONFIRMED", "PENDING"].includes(a.status)) continue;
      const rec = perPerson.get(a.personId) || { name: a.person.name, count: 0, dates: [] };
      rec.count++;
      rec.dates.push(s.date);
      perPerson.set(a.personId, rec);
    }
  }

  // Weekend double-bookings (same date, 2+ services)
  const byDate = new Map<string, Map<string, string[]>>();
  for (const [personId, rec] of perPerson) {
    for (const d of rec.dates) {
      // count services that date for this person
      const key = `${personId}:${d}`;
      byDate.set(key, (byDate.get(key) || new Map()) as Map<string, string[]>);
    }
  }
  // simpler pass: use assignments grouped
  const all = await prisma.assignment.findMany({
    where: {
      status: { in: ["PENDING", "ACCEPTED", "CONFIRMED"] },
      personId: { not: null },
      service: { organizationId, date: { gte: today, lte: addDays(today, horizonDays) } },
    },
    include: { person: true, service: true },
  });
  const seen = new Map<string, { name: string; dates: Set<string>; services: Set<string> }>();
  for (const a of all) {
    const rec = seen.get(a.personId!) || { name: a.person.name, dates: new Set(), services: new Set() };
    rec.dates.add(a.service.date);
    rec.services.add(`${a.service.date}:${a.serviceId}`);
    seen.set(a.personId!, rec);
  }
  for (const [pid, rec] of seen) {
    const weekendLoad = [...rec.dates].filter((d) => daysUntil(d, today) <= 7).length;
    if (weekendLoad >= 2) {
      warnings.push(`${rec.name} is scheduled on ${weekendLoad} days in the next week — consider rotating.`);
    }
  }

  return { warnings: [...new Set(warnings)].slice(0, 12), servicesScanned: services.length };
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
