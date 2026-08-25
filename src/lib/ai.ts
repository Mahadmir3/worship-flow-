import "server-only";
import { prisma } from "@/lib/db";
import { addMinutes, fmtDate, todayIn } from "@/lib/format";
import { autoScheduleService, detectOrgConflicts } from "@/lib/scheduling";

/**
 * WorshipFlow Assistant.
 *
 * Ships with a fully local, deterministic intent engine (works offline, zero
 * API keys). An OpenAI-compatible provider can be dropped in via env vars:
 *   WORSHIPFLOW_LLM_BASE_URL, WORSHIPFLOW_LLM_API_KEY, WORSHIPFLOW_LLM_MODEL
 * The provider interface below is the only integration point.
 */

export type AssistantResult = {
  reply: string;
  confirm?: { label: string; command: string } | null;
};

// ── OpenAI-compatible abstraction (unused unless configured) ──
export interface LLMProvider {
  complete(system: string, prompt: string): Promise<string>;
}

export function getLLMProvider(): LLMProvider | null {
  const base = process.env.WORSHIPFLOW_LLM_BASE_URL;
  const key = process.env.WORSHIPFLOW_LLM_API_KEY;
  if (!base || !key) return null;
  const model = process.env.WORSHIPFLOW_LLM_MODEL || "gpt-4o-mini";
  return {
    async complete(system, prompt) {
      const res = await fetch(`${base.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: prompt },
          ],
        }),
      });
      const json = await res.json();
      return json?.choices?.[0]?.message?.content ?? "";
    },
  };
}

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function nextWeekday(target: number, from: string): string {
  const d = new Date(from + "T12:00:00Z");
  const diff = (target - d.getUTCDay() + 7) % 7 || 7;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

function parseDateMention(text: string, today: string): string | null {
  const t = text.toLowerCase();
  if (t.includes("tomorrow")) {
    const d = new Date(today + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    return d.toISOString().slice(0, 10);
  }
  for (let i = 0; i < WEEKDAYS.length; i++) {
    if (t.includes(WEEKDAYS[i])) return nextWeekday(i, today);
  }
  const m = t.match(/(\d{4}-\d{2}-\d{2})/);
  if (m) return m[1];
  const dm = t.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/);
  if (dm) {
    const months = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
    const year = Number(today.slice(0, 4));
    return `${year}-${String(months.indexOf(dm[2]) + 1).padStart(2, "0")}-${String(Number(dm[1])).padStart(2, "0")}`;
  }
  return null;
}

const DEFAULT_PLAN = [
  { title: "Welcome", type: "WELCOME", durationSec: 300 },
  { title: "Opening Prayer", type: "PRAYER", durationSec: 300 },
  { title: "Worship Song 1", type: "SONG", durationSec: 300 },
  { title: "Worship Song 2", type: "SONG", durationSec: 300 },
  { title: "Worship Song 3", type: "SONG", durationSec: 300 },
  { title: "Offering", type: "OFFERING", durationSec: 600 },
  { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300 },
  { title: "Sermon", type: "SERMON", durationSec: 2400 },
  { title: "Response Song", type: "SONG", durationSec: 300 },
  { title: "Closing Prayer", type: "CLOSING", durationSec: 300 },
];

const TOPIC_TAGS: Record<string, string[]> = {
  faithfulness: ["faithfulness", "trust", "promise"],
  healing: ["healing", "healer"],
  praise: ["praise", "joy", "celebration"],
  love: ["love", "grace"],
  holiness: ["holy", "holiness", "majesty"],
  thanksgiving: ["thanksgiving", "gratitude", "bless"],
  power: ["power", "mighty", "victory"],
  hope: ["hope", "light", "way"],
};

export async function runAssistant(
  text: string,
  organizationId: string,
  opts: { confirmCommand?: string; timezone?: string; canManageServices?: boolean } = {}
): Promise<AssistantResult> {
  const tz = opts.timezone || "Africa/Kampala";
  const today = todayIn(tz);
  const t = text.trim();
  const lower = t.toLowerCase();

  // ── Explicit confirmations (buttons pressed in the UI) ──
  if (opts.confirmCommand && opts.confirmCommand.split("|")[0] !== "conflicts" && !opts.canManageServices) {
    return { reply: "🔒 You don't have rights to make that change. Ask an administrator to grant you “Create & edit events” in Settings → Roles & permissions." };
  }
  if (opts.confirmCommand) {
    const [verb, ...args] = opts.confirmCommand.split("|");
    if (verb === "create-service") {
      const [date, start] = args;
      const service = await createDraftService(organizationId, date, start);
      return {
        reply: `✅ Created **${service.title}** on ${fmtDate(service.date)} at ${start}. I added a draft 10-item order of service — open the plan to tune it, then schedule teams.`,
      };
    }
    if (verb === "auto-schedule") {
      const serviceId = args[0];
      const res = await autoScheduleService(serviceId, organizationId);
      return {
        reply: `✅ Auto-schedule complete: ${res.scheduled} position(s) filled with pending requests.${res.skipped.length ? ` Skipped (no available candidate): ${res.skipped.join(", ")}.` : ""}`,
      };
    }
    if (verb === "add-songs") {
      const serviceId = args[0];
      const songIds = args.slice(1);
      await addSongsToPlan(serviceId, songIds);
      return { reply: `✅ Added ${songIds.length} song(s) to the service plan.` };
    }
  }

  // ── Create a service ──
  if (/(create|plan|schedule|add)\b.*\bservice\b|service.*\b(create|new)/.test(lower) && !lower.includes("team")) {
    if (!opts.canManageServices) {
      return { reply: "🔒 Only people with “Create & edit events” rights can create services — ask an administrator to grant you that right." };
    }
    const date = parseDateMention(lower, today) || nextWeekday(0, today);
    const type = await prisma.serviceType.findFirst({
      where: { organizationId, name: { contains: "Sunday" } },
      orderBy: { name: "asc" },
    });
    const start = type?.defaultStart || "09:00";
    return {
      reply: `I'll draft a **${type?.name ?? "Sunday Morning"}** service on **${fmtDate(date)}** at **${start}** with a standard 10-item order (welcome → worship → offering → sermon → response). Shall I create it?`,
      confirm: { label: "Create service", command: `create-service|${date}|${start}` },
    };
  }

  // ── Setlist generation ──
  if (/(songs?|setlist|set list)/.test(lower) && /(give|suggest|recommend|need|build|about|for)/.test(lower)) {
    let topic = "praise";
    for (const key of Object.keys(TOPIC_TAGS)) {
      if (lower.includes(key)) { topic = key; break; }
    }
    const countMatch = lower.match(/\b(\d{1,2})\b/);
    const count = Math.min(countMatch ? Number(countMatch[1]) : 5, 8);

    const songs = await prisma.song.findMany({ where: { organizationId } });
    const scored = songs
      .map((s) => {
        const tags = (s.tags || "").toLowerCase();
        let score = TOPIC_TAGS[topic].reduce((acc, tag) => acc + (tags.includes(tag) ? 2 : 0), 0);
        if ((s.title + (s.tags || "")).toLowerCase().includes(topic)) score += 2;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, count);

    if (!scored.length) {
      return { reply: "Your song library is empty — add a few songs first and I can build setlists from them." };
    }
    const next = await prisma.service.findFirst({
      where: { organizationId, date: { gte: today } },
      orderBy: { date: "asc" },
    });
    const list = scored.map((x, i) => `${i + 1}. **${x.s.title}** — ${x.s.defaultKey ? `Key ${x.s.defaultKey}` : "key TBD"}${x.s.bpm ? `, ${x.s.bpm} BPM` : ""}`).join("\n");
    return {
      reply: `Here are ${scored.length} songs on the theme of **${topic}**:\n\n${list}${next ? `\n\nWant me to add these to **${next.title}** (${fmtDate(next.date)})?` : ""}`,
      confirm: next
        ? { label: `Add to ${fmtDate(next.date)} plan`, command: `add-songs|${next.id}|${scored.map((x) => x.s.id).join("|")}` }
        : null,
    };
  }

  // ── Auto-schedule volunteers ──
  if (/(schedule|auto|assign|fill)/.test(lower) && /(team|volunteer|position|schedule)/.test(lower)) {
    const monthMatch = lower.match(/\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/);
    const months = ["january","february","march","april","may","june","july","august","september","october","november","december"];
    const month = monthMatch ? String(months.indexOf(monthMatch[1]) + 1).padStart(2, "0") : today.slice(5, 7);

    const services = await prisma.service.findMany({
      where: { organizationId, date: { startsWith: `2026-${month}`, gte: today } },
      include: { assignments: true },
      orderBy: { date: "asc" },
    });
    const upcoming = services.filter((s) => s.date >= today);
    if (!upcoming.length) {
      return { reply: `I couldn't find upcoming services in that month. Create a service first, then ask me to schedule.` };
    }
    const first = upcoming[0];
    const openCount = upcoming.reduce((n, s) => n + s.assignments.filter((a) => a.status === "OPEN").length, 0);
    return {
      reply: `I found ${upcoming.length} service(s) in that window with **${openCount} open position(s)**. I'll start with **${first.title}** (${fmtDate(first.date)}): the engine ranks people by availability, skills, recent load and conflicts — each pick sends a confirmation request.`,
      confirm: { label: `Auto-schedule ${fmtDate(first.date)}`, command: `auto-schedule|${first.id}` },
    };
  }

  // ── Conflict detection ──
  if (/(conflict|double.?book|problem|issue|check)/.test(lower)) {
    const { warnings, servicesScanned } = await detectOrgConflicts(organizationId);
    if (!warnings.length) {
      return { reply: `✅ Scanned ${servicesScanned} upcoming services — no conflicts, no critical open positions. Your schedules look healthy.` };
    }
    return { reply: `I scanned ${servicesScanned} upcoming services and found ${warnings.length} thing(s) to look at:\n\n${warnings.map((w) => `• ${w}`).join("\n")}` };
  }

  // ── Rehearsal agenda ──
  if (/(rehearsal|practice)/.test(lower)) {
    const service = await prisma.service.findFirst({
      where: { organizationId, date: { gte: today } },
      orderBy: { date: "asc" },
      include: { items: { where: { type: { in: ["SONG", "WORSHIP_SET"] } }, orderBy: { sortOrder: "asc" } } },
    });
    if (!service) return { reply: "No upcoming service to plan a rehearsal around." };
    const songs = service.items.filter((i) => i.songId);
    const lines = [
      `**Rehearsal agenda — ${service.title} (${fmtDate(service.date)})**`,
      ``,
      `6:00 — Gather & prayer (10 min)`,
      `6:10 — Vocal warm-up (10 min)`,
      `6:20 — ${songs[0]?.title || "Song 1"} — run, then loop verse/chorus (15 min)`,
      `6:35 — ${songs[1]?.title || "Song 2"} — focus on transitions (15 min)`,
      `6:50 — ${songs[2]?.title || "Song 3"} — full run (15 min)`,
      `7:05 — New song teaching (10 min)`,
      `7:15 — Soundcheck notes & flow review (10 min)`,
      `7:25 — Full run-through with transitions (20 min)`,
      `7:45 — Notes & prayer`,
      ``,
      `Tip: mark each song's status (Learning → Rehearsed → Ready) on the rehearsal page as you go.`,
    ];
    return { reply: lines.join("\n") };
  }

  return {
    reply: [
      `I'm the **WorshipFlow Assistant** 🎵 — here's what I can do right now:`,
      `• "Create this Sunday's worship service"`,
      `• "Give me five worship songs about God's faithfulness"`,
      `• "Schedule the worship team for September"`,
      `• "Check for scheduling conflicts"`,
      `• "Plan a rehearsal agenda"`,
    ].join("\n"),
  };
}

async function createDraftService(organizationId: string, date: string, start: string) {
  const type =
    (await prisma.serviceType.findFirst({ where: { organizationId, name: { contains: "Sunday" } } })) ||
    (await prisma.serviceType.findFirst({ where: { organizationId } }));
  const campus = await prisma.campus.findFirst({ where: { organizationId } });
  const totalMin = DEFAULT_PLAN.reduce((n, i) => n + i.durationSec / 60, 0);
  const service = await prisma.service.create({
    data: {
      organizationId,
      campusId: campus!.id,
      typeId: type!.id,
      title: type?.name || "Worship Service",
      date,
      startTime: start,
      endTime: addMinutes(start, totalMin),
      status: "PLANNING",
    },
  });
  await prisma.serviceItem.createMany({
    data: DEFAULT_PLAN.map((item, i) => ({
      serviceId: service.id,
      sortOrder: i,
      title: item.title,
      type: item.type,
      durationSec: item.durationSec,
    })),
  });

  // Open positions from worship + production team templates
  const teams = await prisma.team.findMany({
    where: { organizationId, category: { in: ["WORSHIP", "PRODUCTION"] } },
    include: { positions: true },
  });
  for (const team of teams) {
    for (const pos of team.positions) {
      await prisma.assignment.create({
        data: { serviceId: service.id, teamId: team.id, positionName: pos.name },
      });
    }
  }
  return service;
}

async function addSongsToPlan(serviceId: string, songIds: string[]) {
  const service = await prisma.service.findUnique({ where: { id: serviceId } });
  if (!service) return;
  const count = await prisma.serviceItem.count({ where: { serviceId } });
  const songs = await prisma.song.findMany({ where: { id: { in: songIds } } });
  let order = count;
  for (const s of songs) {
    await prisma.serviceItem.create({
      data: {
        serviceId,
        sortOrder: order++,
        title: s.title,
        type: "SONG",
        durationSec: 300,
        songId: s.id,
        key: s.defaultKey,
      },
    });
  }
}
