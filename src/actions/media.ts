"use server";

import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

/**
 * Storage abstraction — local disk provider for dev/demo.
 * Swap `saveFile` with an S3-compatible client (R2, Backblaze, Wasabi…) in prod.
 */
async function saveFile(file: File): Promise<{ url: string; sizeKb: number }> {
  const bytes = Buffer.from(await file.arrayBuffer());
  const ext = (file.name.split(".").pop() || "bin").toLowerCase().replace(/[^a-z0-9]/g, "");
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), bytes);
  return { url: `/uploads/${name}`, sizeKb: Math.round(bytes.length / 1024) };
}

export async function uploadMedia(fd: FormData) {
  const user = await requireUser();
  const file = fd.get("file");
  if (!(file instanceof File) || !file.size) return;
  const { url, sizeKb } = await saveFile(file);
  const type = file.type.startsWith("audio")
    ? "AUDIO"
    : file.type.startsWith("video")
      ? "VIDEO"
      : file.type.startsWith("image")
        ? "IMAGE"
        : file.type === "application/pdf"
          ? "PDF"
          : "FILE";
  await prisma.mediaFile.create({
    data: {
      organizationId: user.organizationId,
      folder: s(fd, "folder", "media"),
      name: file.name,
      type,
      url,
      sizeKb,
      uploadedBy: user.id,
      songId: s(fd, "songId") || null,
      serviceId: s(fd, "serviceId") || null,
    },
  });
  revalidatePath("/media");
}

export async function addMediaLink(fd: FormData) {
  const user = await requireUser();
  await prisma.mediaFile.create({
    data: {
      organizationId: user.organizationId,
      folder: s(fd, "folder", "media"),
      name: s(fd, "name", "Link"),
      type: s(fd, "type", "LINK"),
      url: s(fd, "url"),
      songId: s(fd, "songId") || null,
      serviceId: s(fd, "serviceId") || null,
      uploadedBy: user.id,
    },
  });
  revalidatePath("/media");
  const songId = s(fd, "songId");
  if (songId) revalidatePath(`/songs/${songId}`);
}

export async function renameMedia(fd: FormData) {
  const user = await requireUser();
  const id = s(fd, "mediaId");
  const m = await prisma.mediaFile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!m) return;
  await prisma.mediaFile.update({ where: { id }, data: { name: s(fd, "name", m.name) } });
  revalidatePath("/media");
}

export async function moveMedia(fd: FormData) {
  const user = await requireUser();
  const id = s(fd, "mediaId");
  const m = await prisma.mediaFile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!m) return;
  await prisma.mediaFile.update({ where: { id }, data: { folder: s(fd, "folder", m.folder) } });
  revalidatePath("/media");
}

export async function deleteMedia(fd: FormData) {
  const user = await requireUser();
  const id = s(fd, "mediaId");
  const m = await prisma.mediaFile.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!m) return;
  await prisma.mediaFile.delete({ where: { id } });
  revalidatePath("/media");
}
