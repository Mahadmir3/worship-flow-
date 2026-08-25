"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

export async function createChannel(fd: FormData) {
  const user = await requireUser();
  const name = s(fd, "name", "New channel");
  await prisma.channel.create({
    data: {
      organizationId: user.organizationId,
      name,
      slug: `${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${Date.now().toString(36)}`,
      purpose: s(fd, "purpose") || null,
    },
  });
  revalidatePath("/messages");
}

export async function postMessage(fd: FormData) {
  const user = await requireUser();
  const body = s(fd, "body");
  if (!body) return;
  await prisma.message.create({
    data: { channelId: s(fd, "channelId"), userId: user.id, body },
  });
  revalidatePath("/messages");
}

export async function togglePin(fd: FormData) {
  const user = await requireUser();
  const id = s(fd, "messageId");
  const msg = await prisma.message.findUnique({ where: { id }, include: { channel: true } });
  if (!msg || msg.channel.organizationId !== user.organizationId) return;
  await prisma.message.update({ where: { id }, data: { pinned: !msg.pinned } });
  revalidatePath("/messages");
}
