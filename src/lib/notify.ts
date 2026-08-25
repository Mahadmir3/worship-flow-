import "server-only";
import { prisma } from "@/lib/db";

/**
 * Notification delivery.
 * In-app delivery is real (Notification table + bell inbox).
 * Email / SMS / Push are provider-agnostic stubs: implement `deliver()` for each
 * channel with your provider (SMTP, Africa's Talking, WhatsApp Business API…)
 * and register it here. Nothing is hardcoded to a single vendor.
 */
export type NotifyChannel = "in_app" | "email" | "sms" | "push";

export async function notifyUser(
  userId: string,
  organizationId: string,
  payload: { title: string; body: string; kind?: string; link?: string },
  channels: NotifyChannel[] = ["in_app"]
) {
  await prisma.notification.create({
    data: {
      userId,
      organizationId,
      title: payload.title,
      body: payload.body,
      kind: payload.kind || "INFO",
      link: payload.link,
    },
  });
  for (const ch of channels) {
    if (ch !== "in_app") {
      // Provider hook — see README "Notification channels".
      console.log(`[worshipflow:${ch}] → user ${userId}: ${payload.title}`);
    }
  }
}

/** Notify every user who leads a given team (used for declines & replacements). */
export async function notifyTeamLeaders(
  teamId: string,
  organizationId: string,
  payload: { title: string; body: string; kind?: string; link?: string }
) {
  const leaders = await prisma.teamMember.findMany({
    where: { teamId, isLeader: true },
    include: { person: { include: { user: true } } },
  });
  for (const l of leaders) {
    if (l.person.user) {
      await notifyUser(l.person.user.id, organizationId, payload);
    }
  }
}
