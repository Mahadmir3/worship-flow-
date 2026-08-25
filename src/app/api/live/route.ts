import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";

/** Live mode state sync (polled every few seconds by viewers/controllers). */
export async function GET(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const serviceId = req.nextUrl.searchParams.get("serviceId");
  if (!serviceId) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const service = await prisma.service.findFirst({
    where: { id: serviceId, organizationId: user.organizationId },
  });
  if (!service) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    currentItemId: service.liveItemId,
    announcement: service.liveAnnouncement,
    serverTime: new Date().toISOString(),
  });
}
