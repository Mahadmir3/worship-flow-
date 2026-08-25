import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ messages: [] }, { status: 401 });
  const channelId = req.nextUrl.searchParams.get("channelId");
  if (!channelId) return NextResponse.json({ messages: [] });

  const channel = await prisma.channel.findFirst({
    where: { id: channelId, organizationId: user.organizationId },
  });
  if (!channel) return NextResponse.json({ messages: [] });

  const messages = await prisma.message.findMany({
    where: { channelId },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      pinned: m.pinned,
      author: m.user.name,
      createdAt: m.createdAt.toISOString(),
    })),
  });
}
