"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { requireUser, hashPassword, verifyPassword } from "@/lib/auth";
import { canDo, canManageRoles } from "@/lib/perms";
import { notifyUser } from "@/lib/notify";
import { ROLE_LABEL } from "@/lib/constants";
import { audit } from "@/lib/audit";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

export async function setCampusFilter(campusId: string) {
  const jar = await cookies();
  if (campusId) jar.set("wf_campus", campusId, { path: "/", maxAge: 86400 * 365 });
  else jar.delete("wf_campus");
  revalidatePath("/", "layout");
}

export async function getCampusFilter(): Promise<string | null> {
  return (await cookies()).get("wf_campus")?.value || null;
}

export async function updateOrganization(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Not allowed");
  await prisma.organization.update({
    where: { id: user.organizationId },
    data: {
      name: s(fd, "name", "My Church"),
      timezone: s(fd, "timezone", "Africa/Kampala"),
      currency: s(fd, "currency", "UGX"),
      branding: JSON.stringify({ primary: s(fd, "primary"), gold: s(fd, "gold") }),
    },
  });
  revalidatePath("/settings");
  revalidatePath("/", "layout");
}

export async function createCampus(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Not allowed");
  const campus = await prisma.campus.create({
    data: { organizationId: user.organizationId, name: s(fd, "name", "New Campus"), address: s(fd, "address") || null },
  });
  if (s(fd, "venueName")) {
    await prisma.venue.create({ data: { campusId: campus.id, name: s(fd, "venueName") } });
  }
  revalidatePath("/settings/organization");
}

export async function createVenue(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Not allowed");
  await prisma.venue.create({
    data: { campusId: s(fd, "campusId"), name: s(fd, "name", "New Venue"), capacity: Number(s(fd, "capacity")) || null },
  });
  revalidatePath("/settings/organization");
}

export async function setUserRole(fd: FormData) {
  const user = await requireUser();
  if (!(await canManageRoles(user))) throw new Error("Not allowed");
  const targetId = s(fd, "userId");
  const target = await prisma.user.findFirst({ where: { id: targetId, organizationId: user.organizationId } });
  if (!target) return;
  if (target.role === "OWNER" && user.role !== "OWNER") return; // only an owner can change an owner
  const role = s(fd, "role", "VOLUNTEER");
  if (role === "OWNER") return; // ownership transfer is owner-only, not offered here
  await prisma.user.update({ where: { id: targetId }, data: { role } });
  if (role !== target.role) {
    await notifyUser(targetId, user.organizationId, {
      title: "Your access level changed",
      body: `${user.name} made you ${ROLE_LABEL[role] || role}.`,
      kind: "ROLE",
      link: "/settings/permissions",
    }).catch(() => {});
    await audit(user.organizationId, user.id, "user.role", "User", targetId, { from: target.role, to: role }).catch(() => {});
  }
  revalidatePath("/settings/permissions");
}

export async function setNotifPrefs(fd: FormData) {
  const user = await requireUser();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      notifPrefs: JSON.stringify({
        email: fd.get("email") === "on",
        sms: fd.get("sms") === "on",
        push: fd.get("push") === "on",
      }),
    },
  });
  revalidatePath("/settings/notifications");
}

export async function togglePaymentProvider(fd: FormData) {
  const user = await requireUser();
  if (user.role !== "OWNER") throw new Error("Only the owner can manage billing");
  const id = s(fd, "providerId");
  const provider = await prisma.paymentProvider.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!provider) return;
  await prisma.paymentProvider.update({ where: { id }, data: { enabled: !provider.enabled } });
  revalidatePath("/settings/billing");
}

export async function completeOnboardingStep(fd: FormData) {
  const user = await requireUser();
  // Steps write real data — see /onboarding page
  const step = s(fd, "step");
  if (step === "church") {
    await prisma.organization.update({
      where: { id: user.organizationId },
      data: { name: s(fd, "name", "My Church"), timezone: s(fd, "timezone", "Africa/Kampala"), currency: s(fd, "currency", "UGX") },
    });
  }
  if (step === "campus") {
    await prisma.campus.create({ data: { organizationId: user.organizationId, name: s(fd, "name", "Main Campus") } });
  }
  if (step === "finish") {
    await prisma.organization.update({ where: { id: user.organizationId }, data: { setupCompleted: true } });
  }
  revalidatePath("/onboarding");
  revalidatePath("/dashboard");
  if (step === "finish") redirect("/dashboard");
}


// ── Event folders ──

export async function createFolder(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Only administrators can create folders");
  const count = await prisma.eventFolder.count({ where: { organizationId: user.organizationId } });
  await prisma.eventFolder.create({
    data: {
      organizationId: user.organizationId,
      name: s(fd, "name", "New folder"),
      color: s(fd, "color", "#4F46E5"),
      sortOrder: count,
    },
  });
  revalidatePath("/services");
  revalidatePath("/services/new");
}

export async function renameFolder(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Only administrators can rename folders");
  const folder = await prisma.eventFolder.findFirst({ where: { id: s(fd, "folderId"), organizationId: user.organizationId } });
  if (!folder) return;
  await prisma.eventFolder.update({ where: { id: folder.id }, data: { name: s(fd, "name", folder.name), color: s(fd, "color", folder.color) } });
  revalidatePath("/services");
}

export async function deleteFolder(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Only administrators can delete folders");
  const folder = await prisma.eventFolder.findFirst({ where: { id: s(fd, "folderId"), organizationId: user.organizationId } });
  if (!folder) return;
  await prisma.service.updateMany({ where: { folderId: folder.id }, data: { folderId: null } });
  await prisma.eventFolder.delete({ where: { id: folder.id } });
  revalidatePath("/services");
}

export async function moveServiceToFolder(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_services"))) throw new Error("Not allowed");
  const serviceId = s(fd, "serviceId");
  const svc = await prisma.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!svc) return;
  const folderId = s(fd, "folderId");
  const folder = folderId
    ? await prisma.eventFolder.findFirst({ where: { id: folderId, organizationId: user.organizationId } })
    : null;
  await prisma.service.update({ where: { id: serviceId }, data: { folderId: folder?.id ?? null } });
  revalidatePath("/services");
  revalidatePath(`/services/${serviceId}`);
}

// ── Admin-granted rights ──

export async function grantCapability(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Only administrators can grant rights");
  const userId = s(fd, "userId");
  const capability = s(fd, "capability");
  const target = await prisma.user.findFirst({ where: { id: userId, organizationId: user.organizationId } });
  if (!target || target.role === "OWNER" || target.role === "ADMIN") return;
  await prisma.permissionGrant.upsert({
    where: { userId_capability: { userId, capability } },
    create: { organizationId: user.organizationId, userId, capability, grantedById: user.id },
    update: {},
  });
  await audit(user.organizationId, user.id, "grant.create", "PermissionGrant", userId, { capability, to: target.email });
  revalidatePath("/settings/permissions");
}

export async function revokeCapability(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_org"))) throw new Error("Only administrators can revoke rights");
  const userId = s(fd, "userId");
  const capability = s(fd, "capability");
  await prisma.permissionGrant.deleteMany({ where: { userId, capability, organizationId: user.organizationId } });
  await audit(user.organizationId, user.id, "grant.delete", "PermissionGrant", userId, { capability });
  revalidatePath("/settings/permissions");
}

/** Any logged-in user: change your own password (used after first temp login). */
export async function changeOwnPassword(fd: FormData) {
  const user = await requireUser();
  const current = s(fd, "currentPassword");
  const next = s(fd, "newPassword");
  const confirm = s(fd, "confirmPassword");
  if (next.length < 8) throw new Error("New password must be at least 8 characters");
  if (next !== confirm) throw new Error("The two new passwords don't match");

  const fresh = await prisma.user.findUnique({ where: { id: user.id } });
  if (!fresh || !verifyPassword(current, fresh.passwordHash)) throw new Error("Current password is incorrect");

  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(next) } });
  await audit(user.organizationId, user.id, "auth.password_change", "User", user.id);
  redirect("/settings/security?changed=1");
}
