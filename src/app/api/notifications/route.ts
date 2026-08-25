import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ unread: 0 }, { status: 401 });
  const full = req.nextUrl.searchParams.get("full");
  const unread = await prisma.notification.count({
    where: { userId: user.id, readAt: null },
  });
  if (!full) return NextResponse.json({ unread });

  const items = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 25,
  });
  return NextResponse.json({
    unread,
    items: items.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      kind: n.kind,
      link: n.link,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  });
}

export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
