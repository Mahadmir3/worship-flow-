"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canDo, isAdminTier } from "@/lib/perms";
import { audit } from "@/lib/audit";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

export async function createSong(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_songs"))) throw new Error("Not allowed");
  const song = await prisma.song.create({
    data: {
      organizationId: user.organizationId,
      title: s(fd, "title", "Untitled"),
      artist: s(fd, "artist") || null,
      writer: s(fd, "writer") || null,
      defaultKey: s(fd, "defaultKey") || null,
      bpm: Number(s(fd, "bpm")) || null,
      genre: s(fd, "genre") || null,
      tags: s(fd, "tags") || null,
      ccliNumber: s(fd, "ccliNumber") || null,
      copyright: s(fd, "copyright") || null,
      arrangements: {
        create: {
          name: "Original",
          key: s(fd, "defaultKey") || null,
          bpm: Number(s(fd, "bpm")) || null,
          chart: s(fd, "chart", ""),
          lyrics: s(fd, "lyrics", ""),
        },
      },
    },
  });
  await audit(user.organizationId, user.id, "song.create", "Song", song.id, { title: song.title });
  revalidatePath("/songs");
  redirect(`/songs/${song.id}`);
}

export async function updateSong(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_songs"))) throw new Error("Not allowed");
  const id = s(fd, "songId");
  await prisma.song.update({
    where: { id },
    data: {
      title: s(fd, "title", "Untitled"),
      artist: s(fd, "artist") || null,
      writer: s(fd, "writer") || null,
      defaultKey: s(fd, "defaultKey") || null,
      bpm: Number(s(fd, "bpm")) || null,
      genre: s(fd, "genre") || null,
      tags: s(fd, "tags") || null,
      ccliNumber: s(fd, "ccliNumber") || null,
      copyright: s(fd, "copyright") || null,
    },
  });
  revalidatePath(`/songs/${id}`);
  revalidatePath("/songs");
}

export async function addArrangement(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_songs"))) throw new Error("Not allowed");
  const songId = s(fd, "songId");
  await prisma.arrangement.create({
    data: {
      songId,
      name: s(fd, "name", "New arrangement"),
      key: s(fd, "key") || null,
      bpm: Number(s(fd, "bpm")) || null,
      chart: s(fd, "chart", ""),
      lyrics: s(fd, "lyrics", ""),
      notes: s(fd, "notes") || null,
    },
  });
  revalidatePath(`/songs/${songId}`);
}

export async function updateArrangement(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_songs"))) throw new Error("Not allowed");
  const id = s(fd, "arrangementId");
  const songId = s(fd, "songId");
  await prisma.arrangement.update({
    where: { id },
    data: {
      name: s(fd, "name", "Arrangement"),
      key: s(fd, "key") || null,
      bpm: Number(s(fd, "bpm")) || null,
      chart: s(fd, "chart", ""),
      lyrics: s(fd, "lyrics", ""),
      notes: s(fd, "notes") || null,
    },
  });
  revalidatePath(`/songs/${songId}`);
}

export async function deleteArrangement(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_songs"))) throw new Error("Not allowed");
  const id = s(fd, "arrangementId");
  const songId = s(fd, "songId");
  const count = await prisma.arrangement.count({ where: { songId } });
  if (count <= 1) return; // keep at least one
  await prisma.arrangement.delete({ where: { id } });
  revalidatePath(`/songs/${songId}`);
}

/** Admin/Owner only: remove a song and its arrangements. */
export async function deleteSong(fd: FormData) {
  const user = await requireUser();
  if (!isAdminTier(user)) throw new Error("Only admins can delete songs");
  const id = s(fd, "id");
  const song = await prisma.song.findFirst({ where: { id, organizationId: user.organizationId } });
  if (!song) return;

  await prisma.arrangement.deleteMany({ where: { songId: id } });
  await prisma.serviceItem.updateMany({ where: { songId: id }, data: { songId: null } });
  await prisma.song.delete({ where: { id } });

  await audit(user.organizationId, user.id, "song.delete", "Song", id, { title: song.title });
  revalidatePath("/songs");
}
