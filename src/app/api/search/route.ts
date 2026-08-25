import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ results: [] }, { status: 401 });

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const orgId = user.organizationId;

  const [people, teams, services, songs, tasks, rehearsals] = await Promise.all([
    prisma.person.findMany({
      where: { organizationId: orgId, name: { contains: q } },
      take: 4,
    }),
    prisma.team.findMany({
      where: { organizationId: orgId, name: { contains: q } },
      take: 3,
    }),
    prisma.service.findMany({
      where: {
        organizationId: orgId,
        OR: [{ title: { contains: q } }, { theme: { contains: q } }, { date: { contains: q } }],
      },
      orderBy: { date: "desc" },
      take: 4,
    }),
    prisma.song.findMany({
      where: {
        organizationId: orgId,
        OR: [{ title: { contains: q } }, { artist: { contains: q } }, { tags: { contains: q } }],
      },
      take: 4,
    }),
    prisma.task.findMany({
      where: { organizationId: orgId, title: { contains: q } },
      take: 3,
    }),
    prisma.rehearsal.findMany({
      where: { organizationId: orgId, title: { contains: q } },
      take: 3,
    }),
  ]);

  const results = [];
  if (people.length)
    results.push({
      group: "People",
      items: people.map((p) => ({ id: p.id, label: p.name, sub: p.skills || "", href: `/people/${p.id}` })),
    });
  if (teams.length)
    results.push({
      group: "Teams",
      items: teams.map((t) => ({ id: t.id, label: t.name, sub: t.category, href: `/teams/${t.id}` })),
    });
  if (services.length)
    results.push({
      group: "Services",
      items: services.map((sv) => ({ id: sv.id, label: sv.title, sub: sv.date, href: `/services/${sv.id}` })),
    });
  if (songs.length)
    results.push({
      group: "Songs",
      items: songs.map((sg) => ({
        id: sg.id,
        label: sg.title,
        sub: sg.defaultKey ? `Key ${sg.defaultKey}` : "",
        href: `/songs/${sg.id}`,
      })),
    });
  if (rehearsals.length)
    results.push({
      group: "Rehearsals",
      items: rehearsals.map((r) => ({ id: r.id, label: r.title, sub: r.date, href: `/rehearsals/${r.id}` })),
    });
  if (tasks.length)
    results.push({
      group: "Tasks",
      items: tasks.map((t) => ({ id: t.id, label: t.title, sub: t.status, href: "/tasks" })),
    });

  return NextResponse.json({ results });
}
