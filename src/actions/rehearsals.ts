"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canManageRehearsal, hasGrantOrAdmin } from "@/lib/perms";
import { notifyUser } from "@/lib/notify";
import { addMinutes } from "@/lib/format";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

const DEFAULT_CHECKLIST = [
  { key: "vocals", label: "Vocal rehearsal", done: false },
  { key: "band", label: "Band rehearsal", done: false },
  { key: "sound", label: "Soundcheck", done: false },
  { key: "lights", label: "Lighting check", done: false },
  { key: "media", label: "Media check", done: false },
  { key: "run", label: "Full run-through", done: false },
];

export async function createRehearsal(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId") || null;
  if (!(await canManageRehearsal(user, teamId))) throw new Error("Not allowed");
  const startTime = s(fd, "startTime", "18:00");
  const rehearsal = await prisma.rehearsal.create({
    data: {
      organizationId: user.organizationId,
      teamId,
      title: s(fd, "title", "Band Rehearsal"),
      date: s(fd, "date"),
      startTime,
      endTime: addMinutes(startTime, Number(s(fd, "durationMin", "90")) || 90),
      location: s(fd, "location") || null,
      serviceId: s(fd, "serviceId") || null,
      notes: s(fd, "notes") || null,
      objectives: s(fd, "objectives") || null,
      checklist: JSON.stringify(DEFAULT_CHECKLIST),
    },
  });
  revalidatePath("/rehearsals");
}

export async function addRehearsalSong(fd: FormData) {
  const user = await requireUser();
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: s(fd, "rehearsalId"), organizationId: user.organizationId } });
  if (!rehearsal) return;
  if (!(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  const rehearsalId = s(fd, "rehearsalId");
  const songId = s(fd, "songId");
  const song = songId ? await prisma.song.findUnique({ where: { id: songId } }) : null;
  await prisma.rehearsalSong.create({
    data: {
      rehearsalId,
      songId: songId || null,
      title: song?.title || s(fd, "title", "Song"),
    },
  });
  revalidatePath(`/rehearsals/${rehearsalId}`);
}

export async function cycleRehearsalSongStatus(fd: FormData) {
  const user = await requireUser();
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: s(fd, "rehearsalId"), organizationId: user.organizationId } });
  if (!rehearsal) return;
  if (!(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  const id = s(fd, "rehearsalSongId");
  const rehearsalId = s(fd, "rehearsalId");
  const order = ["NOT_STARTED", "LEARNING", "REHEARSED", "READY"];
  const rs = await prisma.rehearsalSong.findUnique({ where: { id } });
  if (!rs) return;
  const next = order[(order.indexOf(rs.status) + 1) % order.length];
  await prisma.rehearsalSong.update({ where: { id }, data: { status: next } });
  revalidatePath(`/rehearsals/${rehearsalId}`);
}

export async function deleteRehearsalSong(fd: FormData) {
  const user = await requireUser();
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: s(fd, "rehearsalId"), organizationId: user.organizationId } });
  if (!rehearsal) return;
  if (!(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  await prisma.rehearsalSong.delete({ where: { id: s(fd, "rehearsalSongId") } });
  revalidatePath(`/rehearsals/${s(fd, "rehearsalId")}`);
}

export async function toggleChecklistItem(fd: FormData) {
  const user = await requireUser();
  const rehearsalId = s(fd, "rehearsalId");
  const key = s(fd, "key");
  const rehearsal = await prisma.rehearsal.findUnique({ where: { id: rehearsalId } });
  if (!rehearsal || rehearsal.organizationId !== user.organizationId) return;
  if (!(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  const list = JSON.parse(rehearsal.checklist || "[]") as { key: string; label: string; done: boolean }[];
  const item = list.find((i) => i.key === key);
  if (item) item.done = !item.done;
  await prisma.rehearsal.update({ where: { id: rehearsalId }, data: { checklist: JSON.stringify(list) } });
  revalidatePath(`/rehearsals/${rehearsalId}`);
}

export async function setRehearsalAttendance(fd: FormData) {
  const user = await requireUser();
  const personId = s(fd, "personId") || user.personId;
  if (!personId) return;
  const rehearsalId = s(fd, "rehearsalId");
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: rehearsalId, organizationId: user.organizationId } });
  if (!rehearsal) return;
  if (personId !== user.personId && !(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  const attending = s(fd, "attending", "UNKNOWN");
  await prisma.rehearsalMember.upsert({
    where: { id: `${rehearsalId}_${personId}` },
    create: { id: `${rehearsalId}_${personId}`, rehearsalId, personId, attending },
    update: { attending },
  });
  revalidatePath(`/rehearsals/${rehearsalId}`);
}

export async function inviteToRehearsal(fd: FormData) {
  const user = await requireUser();
  const rehearsal = await prisma.rehearsal.findFirst({ where: { id: s(fd, "rehearsalId"), organizationId: user.organizationId } });
  if (!rehearsal) return;
  if (!(await canManageRehearsal(user, rehearsal.teamId))) throw new Error("Not allowed");
  const rehearsalId = rehearsal.id;
  const person = await prisma.person.findFirst({
    where: { id: s(fd, "personId"), organizationId: user.organizationId },
    include: { user: true },
  });
  if (!person) return;
  await prisma.rehearsalMember.upsert({
    where: { id: `${rehearsalId}_${person.id}` },
    create: { id: `${rehearsalId}_${person.id}`, rehearsalId, personId: person.id },
    update: {},
  });
  if (person.user) {
    await notifyUser(person.user.id, user.organizationId, {
      title: "Rehearsal invitation",
      body: `${rehearsal.title} · ${rehearsal.date} at ${rehearsal.startTime}${rehearsal.location ? ` — ${rehearsal.location}` : ""}`,
      link: `/rehearsals/${rehearsalId}`,
    });
  }
  revalidatePath(`/rehearsals/${rehearsalId}`);
}
