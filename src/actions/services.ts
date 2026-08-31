"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canDo } from "@/lib/perms";
import { audit } from "@/lib/audit";
import { addMinutes } from "@/lib/format";
import { redirect } from "next/navigation";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

async function requireServiceEditor(serviceId?: string) {
  const user = await requireUser();
  if (serviceId) {
    const svc = await prisma.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
    if (!svc) throw new Error("Service not found");
    if (!(await canDo(user, "manage_services"))) throw new Error("Not allowed");
    return { user, svc };
  }
  if (!(await canDo(user, "manage_services"))) throw new Error("Not allowed");
  return { user, svc: null };
}

export async function createService(fd: FormData) {
  const { user } = await requireServiceEditor();
  const date = s(fd, "date");
  const startTime = s(fd, "startTime", "09:00");
  const type = await prisma.serviceType.findFirst({
    where: { id: s(fd, "typeId"), organizationId: user.organizationId },
  });
  const duration = Number(s(fd, "durationMin", "120")) || type?.defaultDurationMin || 120;
  const campusId = s(fd, "campusId") || (await prisma.campus.findFirst({ where: { organizationId: user.organizationId } }))!.id;

  const service = await prisma.service.create({
    data: {
      organizationId: user.organizationId,
      campusId,
      venueId: s(fd, "venueId") || null,
      typeId: type!.id,
      title: s(fd, "title") || type?.name || "Worship Service",
      date,
      startTime,
      endTime: addMinutes(startTime, duration),
      theme: s(fd, "theme") || null,
      scripture: s(fd, "scripture") || null,
      notes: s(fd, "notes") || null,
      worshipLeaderId: s(fd, "worshipLeaderId") || null,
      preacherId: s(fd, "preacherId") || null,
      serviceLeaderId: s(fd, "serviceLeaderId") || null,
      folderId: s(fd, "folderId") || null,
    },
  });

  // Optionally seed open positions from the selected teams.
  // "on" (sent by the onboarding form) means "seed every team".
  const seedVals = fd.getAll("seedPositions").filter(Boolean) as string[];
  const seedAll = seedVals.includes("on");
  const seedTeamIds = seedVals.filter((v) => v !== "on");
  if (seedAll || seedTeamIds.length) {
    const teams = await prisma.team.findMany({
      where: seedAll ? { organizationId: user.organizationId } : { id: { in: seedTeamIds }, organizationId: user.organizationId },
      include: { positions: true },
    });
    for (const team of teams) {
      for (const pos of team.positions) {
        await prisma.assignment.create({ data: { serviceId: service.id, teamId: team.id, positionName: pos.name } });
      }
    }
  }

  // Apply a template if chosen
  const templateId = s(fd, "templateId");
  if (templateId) {
    const tpl = await prisma.serviceTemplate.findFirst({ where: { id: templateId, organizationId: user.organizationId } });
    if (tpl) {
      const items = JSON.parse(tpl.items) as { title: string; type: string; durationSec: number }[];
      await prisma.serviceItem.createMany({
        data: items.map((it, i) => ({ ...it, serviceId: service.id, sortOrder: i })),
      });
    }
  }

  await audit(user.organizationId, user.id, "service.create", "Service", service.id, { date, title: service.title });
  revalidatePath("/services");
  revalidatePath("/dashboard");
  const redirectTo = s(fd, "redirectTo");
  redirect(redirectTo.startsWith("/") ? redirectTo : `/services/${service.id}`);
}

export async function updateService(fd: FormData) {
  const id = s(fd, "serviceId");
  const { user } = await requireServiceEditor(id);
  const data: Record<string, string | null> = {};
  for (const key of ["title", "date", "startTime", "endTime", "theme", "scripture", "notes"]) {
    const v = fd.get(key);
    if (typeof v === "string" && v.length) data[key] = v;
  }
  for (const key of ["campusId", "venueId", "worshipLeaderId", "preacherId", "serviceLeaderId", "typeId"]) {
    const v = fd.get(key);
    if (v !== null) data[key] = typeof v === "string" && v.length ? v : null;
  }
  await prisma.service.update({ where: { id }, data });
  await audit(user.organizationId, user.id, "service.update", "Service", id, data);
  revalidatePath(`/services/${id}`);
  revalidatePath("/services");
}

export async function setServiceStatus(fd: FormData) {
  const id = s(fd, "serviceId");
  await requireServiceEditor(id);
  await prisma.service.update({ where: { id }, data: { status: s(fd, "status", "PLANNING") } });
  revalidatePath(`/services/${id}`);
  revalidatePath("/services");
}

export async function deleteService(fd: FormData) {
  const id = s(fd, "serviceId") || s(fd, "id");
  const { user } = await requireServiceEditor(id);
  await prisma.service.delete({ where: { id } });
  await audit(user.organizationId, user.id, "service.delete", "Service", id);
  revalidatePath("/services");
}

// ── Service items (order of service) ──

export async function addServiceItem(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  await requireServiceEditor(serviceId);
  const count = await prisma.serviceItem.count({ where: { serviceId } });
  const songId = s(fd, "songId") || null;
  let title = s(fd, "title");
  let key = s(fd, "key") || null;
  if (songId) {
    const song = await prisma.song.findFirst({ where: { id: songId } });
    if (song) {
      title = title || song.title;
      key = key || song.defaultKey;
    }
  }
  const item = await prisma.serviceItem.create({
    data: {
      serviceId,
      sortOrder: count,
      title: title || "New item",
      type: s(fd, "type", "OTHER"),
      durationSec: (Number(s(fd, "minutes", "5")) || 5) * 60,
      personId: s(fd, "personId") || null,
      notes: s(fd, "notes") || null,
      songId,
      key,
    },
  });
  revalidatePath(`/services/${serviceId}/plan`);
  revalidatePath(`/services/${serviceId}`);
}

export async function updateServiceItem(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  await requireServiceEditor(serviceId);
  const data: Record<string, unknown> = {};
  if (fd.get("title")) data.title = s(fd, "title");
  if (fd.get("type")) data.type = s(fd, "type", "OTHER");
  if (fd.get("minutes")) data.durationSec = (Number(s(fd, "minutes")) || 5) * 60;
  if (fd.get("key") !== null) data.key = s(fd, "key") || null;
  if (fd.get("notes") !== null) data.notes = s(fd, "notes");
  if (fd.get("personId") !== null) data.personId = s(fd, "personId") || null;
  await prisma.serviceItem.update({ where: { id: s(fd, "itemId") }, data });
  revalidatePath(`/services/${serviceId}/plan`);
  revalidatePath(`/services/${serviceId}`);
}

export async function deleteServiceItem(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  await requireServiceEditor(serviceId);
  await prisma.serviceItem.delete({ where: { id: s(fd, "itemId") } });
  await normalizeOrder(serviceId);
  revalidatePath(`/services/${serviceId}/plan`);
  revalidatePath(`/services/${serviceId}`);
}

export async function duplicateServiceItem(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  await requireServiceEditor(serviceId);
  const item = await prisma.serviceItem.findUnique({ where: { id: s(fd, "itemId") } });
  if (!item) return;
  const count = await prisma.serviceItem.count({ where: { serviceId } });
  await prisma.serviceItem.create({
    data: { ...item, id: undefined, sortOrder: count, title: `${item.title} (copy)` },
  });
  revalidatePath(`/services/${serviceId}/plan`);
}

export async function reorderServiceItems(serviceId: string, orderedIds: string[]) {
  await requireServiceEditor(serviceId);
  for (let i = 0; i < orderedIds.length; i++) {
    await prisma.serviceItem.update({ where: { id: orderedIds[i] }, data: { sortOrder: i } });
  }
  revalidatePath(`/services/${serviceId}/plan`);
  revalidatePath(`/services/${serviceId}`);
}

export async function moveServiceItem(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  await requireServiceEditor(serviceId);
  const itemId = s(fd, "itemId");
  const dir = s(fd, "dir") === "up" ? -1 : 1;
  const items = await prisma.serviceItem.findMany({ where: { serviceId }, orderBy: { sortOrder: "asc" } });
  const idx = items.findIndex((i) => i.id === itemId);
  const swapIdx = idx + dir;
  if (idx < 0 || swapIdx < 0 || swapIdx >= items.length) return;
  const a = items[idx];
  const b = items[swapIdx];
  await prisma.$transaction([
    prisma.serviceItem.update({ where: { id: a.id }, data: { sortOrder: b.sortOrder } }),
    prisma.serviceItem.update({ where: { id: b.id }, data: { sortOrder: a.sortOrder } }),
  ]);
  revalidatePath(`/services/${serviceId}/plan`);
  revalidatePath(`/services/${serviceId}`);
}

async function normalizeOrder(serviceId: string) {
  const items = await prisma.serviceItem.findMany({ where: { serviceId }, orderBy: { sortOrder: "asc" } });
  for (let i = 0; i < items.length; i++) {
    if (items[i].sortOrder !== i) {
      await prisma.serviceItem.update({ where: { id: items[i].id }, data: { sortOrder: i } });
    }
  }
}

export async function saveAsTemplate(fd: FormData) {
  const serviceId = s(fd, "serviceId");
  const { user } = await requireServiceEditor(serviceId);
  const service = await prisma.service.findUnique({ where: { id: serviceId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!service) return;
  await prisma.serviceTemplate.create({
    data: {
      organizationId: user.organizationId,
      name: s(fd, "name", `${service.title} template`),
      typeId: service.typeId,
      items: JSON.stringify(
        service.items.map((i) => ({ title: i.title, type: i.type, durationSec: i.durationSec }))
      ),
    },
  });
  revalidatePath("/services");
}

// ── Live mode controls ──

export async function setLiveCursor(serviceId: string, itemId: string | null) {
  const { user } = await requireServiceEditor(serviceId);
  await prisma.service.update({ where: { id: serviceId }, data: { liveItemId: itemId } });
  await audit(user.organizationId, user.id, "service.live.cursor", "Service", serviceId, { itemId });
}

export async function setLiveAnnouncement(serviceId: string, text: string) {
  await requireServiceEditor(serviceId);
  await prisma.service.update({ where: { id: serviceId }, data: { liveAnnouncement: text || null } });
}

export async function addServiceComment(fd: FormData) {
  const user = await requireUser();
  const serviceId = s(fd, "serviceId");
  const body = s(fd, "body");
  if (!body) return;
  await prisma.comment.create({ data: { serviceId, userId: user.id, body } });
  revalidatePath(`/services/${serviceId}`);
}
