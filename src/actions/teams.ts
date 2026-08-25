"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canDo, canManageTeam } from "@/lib/perms";
import { audit } from "@/lib/audit";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

async function teamOfOrg(teamId: string, organizationId: string) {
  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId } });
  if (!team) throw new Error("Team not found");
  return team;
}

export async function createTeam(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_teams"))) throw new Error("Not allowed");
  const positions = s(fd, "positions")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  const team = await prisma.team.create({
    data: {
      organizationId: user.organizationId,
      name: s(fd, "name", "New Team"),
      category: s(fd, "category", "CUSTOM"),
      description: s(fd, "description") || null,
      leaderPersonId: s(fd, "leaderPersonId") || null,
      positions: { create: positions.map((name, i) => ({ name, sortOrder: i })) },
    },
  });
  if (team.leaderPersonId) {
    await prisma.teamMember.upsert({
      where: { teamId_personId: { teamId: team.id, personId: team.leaderPersonId } },
      create: { teamId: team.id, personId: team.leaderPersonId, isLeader: true },
      update: { isLeader: true },
    });
  }
  await audit(user.organizationId, user.id, "team.create", "Team", team.id, { name: team.name });
  revalidatePath("/teams");
}

export async function addTeamMember(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId");
  await teamOfOrg(teamId, user.organizationId);
  if (!(await canManageTeam(user, teamId))) throw new Error("Not allowed");
  const personId = s(fd, "personId");
  await prisma.teamMember.upsert({
    where: { teamId_personId: { teamId, personId } },
    create: { teamId, personId, skills: s(fd, "skills") || null },
    update: { status: "ACTIVE", skills: s(fd, "skills") || null },
  });
  revalidatePath(`/teams/${teamId}`);
}

export async function removeTeamMember(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId");
  await teamOfOrg(teamId, user.organizationId);
  if (!(await canManageTeam(user, teamId))) throw new Error("Not allowed");
  await prisma.teamMember.delete({ where: { id: s(fd, "membershipId") } });
  revalidatePath(`/teams/${teamId}`);
}

export async function addPosition(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId");
  await teamOfOrg(teamId, user.organizationId);
  if (!(await canManageTeam(user, teamId))) throw new Error("Not allowed");
  const count = await prisma.position.count({ where: { teamId } });
  await prisma.position.create({
    data: { teamId, name: s(fd, "name", "Position"), sortOrder: count },
  });
  revalidatePath(`/teams/${teamId}`);
}

export async function deletePosition(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId");
  await teamOfOrg(teamId, user.organizationId);
  if (!(await canManageTeam(user, teamId))) throw new Error("Not allowed");
  await prisma.position.delete({ where: { id: s(fd, "positionId") } });
  revalidatePath(`/teams/${teamId}`);
}

// ── People ──

export async function createPerson(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_people"))) throw new Error("Not allowed");
  const person = await prisma.person.create({
    data: {
      organizationId: user.organizationId,
      name: s(fd, "name", "New Person"),
      email: s(fd, "email") || null,
      phone: s(fd, "phone") || null,
      whatsapp: s(fd, "whatsapp") || null,
      campusId: s(fd, "campusId") || null,
      skills: s(fd, "skills") || null,
      preferredFrequency: Number(s(fd, "preferredFrequency", "2")) || 2,
      notes: s(fd, "notes") || null,
    },
  });
  const teamId = s(fd, "teamId");
  if (teamId) {
    await prisma.teamMember.create({ data: { teamId, personId: person.id } }).catch(() => {});
  }
  await audit(user.organizationId, user.id, "person.create", "Person", person.id, { name: person.name });
  revalidatePath("/people");
}

export async function updatePerson(fd: FormData) {
  const user = await requireUser();
  if (!(await canDo(user, "manage_people"))) throw new Error("Not allowed");
  const id = s(fd, "personId");
  await prisma.person.update({
    where: { id },
    data: {
      name: s(fd, "name", "Person"),
      email: s(fd, "email") || null,
      phone: s(fd, "phone") || null,
      whatsapp: s(fd, "whatsapp") || null,
      campusId: s(fd, "campusId") || null,
      skills: s(fd, "skills") || null,
      preferredFrequency: Number(s(fd, "preferredFrequency", "2")) || 2,
      notes: s(fd, "notes") || null,
    },
  });
  revalidatePath(`/people/${id}`);
  revalidatePath("/people");
}

// ── Availability (self-service — a volunteer manages their own) ──

export async function addBlockout(fd: FormData) {
  const user = await requireUser();
  const personId = s(fd, "personId") || user.personId;
  // Only self or managers
if (personId !== user.personId && !(await canDo(user, "manage_people"))) throw new Error("Not allowed");
  const recurring = s(fd, "recurring");
  await prisma.blockout.create({
    data: {
      personId,
      startDate: s(fd, "startDate"),
      endDate: s(fd, "endDate", s(fd, "startDate")),
      reason: s(fd, "reason") || null,
      weekday: recurring ? Number(recurring) : null,
    },
  });
  revalidatePath("/schedule");
  revalidatePath(`/people/${personId}`);
}

export async function removeBlockout(fd: FormData) {
  const user = await requireUser();
  const bo = await prisma.blockout.findUnique({ where: { id: s(fd, "blockoutId") }, include: { person: true } });
  if (!bo) return;
  if (bo.person.organizationId !== user.organizationId) throw new Error("Not allowed");
if (bo.personId !== user.personId && !(await canDo(user, "manage_people"))) throw new Error("Not allowed");
  await prisma.blockout.delete({ where: { id: bo.id } });
  revalidatePath("/schedule");
  revalidatePath(`/people/${bo.personId}`);
}

export async function setPreferredFrequency(fd: FormData) {
  const user = await requireUser();
  const personId = s(fd, "personId") || user.personId;
  if (personId !== user.personId && !(await canDo(user, "manage_people"))) throw new Error("Not allowed");
  await prisma.person.update({
    where: { id: personId },
    data: { preferredFrequency: Number(s(fd, "preferredFrequency", "2")) || 2 },
  });
  revalidatePath("/schedule");
}
