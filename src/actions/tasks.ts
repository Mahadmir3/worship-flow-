"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

export async function createTask(fd: FormData) {
  const user = await requireUser();
  await prisma.task.create({
    data: {
      organizationId: user.organizationId,
      title: s(fd, "title", "New task"),
      serviceId: s(fd, "serviceId") || null,
      assigneeId: s(fd, "assigneeId") || null,
      dueDate: s(fd, "dueDate") || null,
      priority: s(fd, "priority", "MEDIUM"),
      createdById: user.id,
    },
  });
  revalidatePath("/tasks");
  const serviceId = s(fd, "serviceId");
  if (serviceId) revalidatePath(`/services/${serviceId}`);
}

export async function moveTask(fd: FormData) {
  await requireUser();
  const id = s(fd, "taskId");
  const status = s(fd, "status", "TODO");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await prisma.task.update({ where: { id }, data: { status } });
  revalidatePath("/tasks");
  if (task.serviceId) revalidatePath(`/services/${task.serviceId}`);
}

export async function deleteTask(fd: FormData) {
  await requireUser();
  const id = s(fd, "taskId");
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
  if (task.serviceId) revalidatePath(`/services/${task.serviceId}`);
}
