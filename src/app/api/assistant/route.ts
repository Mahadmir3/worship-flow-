import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runAssistant } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const text = String(body.text || "").slice(0, 500);
  const confirmCommand = body.confirmCommand ? String(body.confirmCommand).slice(0, 300) : undefined;

  try {
    const { canDo } = await import("@/lib/perms");
    const canManageServices = await canDo(user, "manage_services");
    const result = await runAssistant(text, user.organizationId, {
      confirmCommand,
      timezone: user.organization.timezone,
      canManageServices,
    });
    return NextResponse.json(result);
  } catch (e) {
    console.error("assistant", e);
    return NextResponse.json({ reply: "Sorry, something went wrong running that command." });
  }
}
