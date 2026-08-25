import "server-only";
import { prisma } from "@/lib/db";

export async function audit(
  organizationId: string,
  userId: string | null,
  action: string,
  entity?: string,
  entityId?: string,
  meta?: unknown
) {
  try {
    await prisma.auditLog.create({
      data: {
        organizationId,
        userId,
        action,
        entity,
        entityId,
        meta: meta === undefined ? null : JSON.stringify(meta),
      },
    });
  } catch (e) {
    console.error("audit failed", e);
  }
}
