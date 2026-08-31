"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { canAny, canDo, canManageTeam, isAdminTier } from "@/lib/perms";
import { audit } from "@/lib/audit";
import { notifyUser, notifyTeamLeaders } from "@/lib/notify";
import { autoScheduleService } from "@/lib/scheduling";

function s(fd: FormData, key: string, fallback = ""): string {
  const v = fd.get(key);
  return typeof v === "string" && v.length ? v : fallback;
}

async function assignmentCtx(assignmentId: string) {
  const user = await requireUser();
  const a = await prisma.assignment.findFirst({
    where: { id: assignmentId, service: { organizationId: user.organizationId } },
    include: { service: true, team: true, person: { include: { user: true } } },
  });
  if (!a) throw new Error("Assignment not found");
  return { user, a };
}

/** Leader schedules a person into a position → status PENDING + notification. */
export async function schedulePerson(fd: FormData) {
  const { user, a } = await assignmentCtx(s(fd, "assignmentId"));
  if (
    !(await canAny(user, ["schedule", "manage_services"])) &&
    !(await canManageTeam(user, a.teamId))
  )
    throw new Error("Not allowed");
  const personId = s(fd, "personId");
  const person = await prisma.person.findFirst({ where: { id: personId, organizationId: user.organizationId }, include: { user: true } });
  if (!person) return;

  await prisma.assignment.update({
    where: { id: a.id },
    data: { personId, status: "PENDING", notifiedAt: new Date(), note: null },
  });
  if (person.user) {
    await notifyUser(person.user.id, user.organizationId, {
      title: `New request: ${a.positionName}`,
      body: `${a.service.title} · ${a.service.date} at ${a.service.startTime} — ${a.team.name}. Tap to see the plan and everyone serving with you.`,
      kind: "ASSIGNMENT",
      link: `/services/${a.serviceId}?tab=team`,
    });
  }
  await audit(user.organizationId, user.id, "assignment.schedule", "Assignment", a.id, { personId, position: a.positionName });
  revalidatePath(`/services/${a.serviceId}`);
  revalidatePath(`/services/${a.serviceId}/plan`);
  revalidatePath("/schedule");
}

/** Volunteer sends a "I'd like to serve" proposal to a department's leaders. */
export async function submitServingProposal(fd: FormData) {
  const user = await requireUser();
  const teamId = s(fd, "teamId");
  const message = s(fd, "message").trim();
  if (!message) return;
  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: user.organizationId } });
  if (!team) return;
  await notifyTeamLeaders(teamId, user.organizationId, {
    title: `Serving proposal — ${user.name}`,
    body: message,
    kind: "INFO",
    link: user.personId ? `/people/${user.personId}` : "/messages",
  });
  await notifyUser(user.id, user.organizationId, {
    title: "Proposal sent ✓",
    body: `Your message was delivered to the ${team.name} leaders.`,
    kind: "SUCCESS",
    link: "/dashboard",
  });
  await audit(user.organizationId, user.id, "proposal.serving", "Team", teamId, { message: message.slice(0, 140) });
  revalidatePath("/dashboard");
}

/** Add a custom position/instrument row to a service for one department (team). */
export async function addServicePosition(fd: FormData) {
  const user = await requireUser();
  const serviceId = s(fd, "serviceId");
  const teamId = s(fd, "teamId");
  const service = await prisma.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  const team = await prisma.team.findFirst({ where: { id: teamId, organizationId: user.organizationId } });
  if (!service || !team) return;
  if (!(await canAny(user, ["schedule", "manage_services"])) && !(await canManageTeam(user, teamId)))
    throw new Error("Not allowed");
  const positionName = s(fd, "positionName", "Position").trim() || "Position";
  await prisma.assignment.create({
    data: { serviceId, teamId, positionName, status: "OPEN" },
  });
  await audit(user.organizationId, user.id, "assignment.addPosition", "Service", serviceId, { team: team.name, positionName });
  revalidatePath(`/services/${serviceId}`);
}

/** Remove an unfilled custom position row from a service. */
export async function deleteAssignment(fd: FormData) {
  const user = await requireUser();
  const a = await prisma.assignment.findFirst({
    where: { id: s(fd, "assignmentId") },
    include: { service: true, team: true },
  });
  if (!a || a.service.organizationId !== user.organizationId) return;
  if (!(await canAny(user, ["schedule", "manage_services"])) && !(await canManageTeam(user, a.teamId)))
    throw new Error("Not allowed");
  if (a.personId) return; // only unfilled rows can be deleted; use Clear to empty one first
  await prisma.assignment.delete({ where: { id: a.id } });
  revalidatePath(`/services/${a.serviceId}`);
}

export async function unassign(fd: FormData) {
  const { user, a } = await assignmentCtx(s(fd, "assignmentId"));
  if (!(await canAny(user, ["schedule", "manage_services"]))) throw new Error("Not allowed");
  await prisma.assignment.update({
    where: { id: a.id },
    data: { personId: null, status: "OPEN", respondedAt: null },
  });
  await audit(user.organizationId, user.id, "assignment.unassign", "Assignment", a.id);
  revalidatePath(`/services/${a.serviceId}`);
}

/** Volunteer responds: accept / decline / request replacement. */
export async function respondToAssignment(fd: FormData) {
  const user = await requireUser();
  const action = s(fd, "action");
  const statusMap: Record<string, string> = {
    accept: "ACCEPTED",
    decline: "DECLINED",
    replacement: "REPLACEMENT_REQUESTED",
  };
  const status = statusMap[action];
  if (!status) return;

  // Single query — only what the update + messages need.
  const a = await prisma.assignment.findFirst({
    where: { id: s(fd, "assignmentId"), service: { organizationId: user.organizationId } },
    select: {
      id: true, personId: true, positionName: true, serviceId: true, teamId: true,
      service: { select: { title: true, date: true, startTime: true } },
      person: { select: { name: true } },
    },
  });
  if (!a) throw new Error("Assignment not found");
  if (!a.personId) throw new Error("Nobody is assigned to this position yet");

  // Permission check only when responding on someone else's behalf —
  // the common case (your own request) needs no extra queries.
  const onBehalf = a.personId !== user.personId;
  if (onBehalf && !(await isAdminTier(user)) && !(await canManageTeam(user, a.teamId))) {
    throw new Error("Not allowed");
  }

  const note = s(fd, "note") || null;
  await prisma.assignment.update({ where: { id: a.id }, data: { status, respondedAt: new Date(), note } });

  // Notifications + audit are not needed for the response — run them after
  // the user already sees the result.
  after(async () => {
    try {
      const titleMap: Record<string, string> = {
        ACCEPTED: `${a.person.name} accepted — ${a.positionName}`,
        DECLINED: `${a.person.name} declined — ${a.positionName}`,
        REPLACEMENT_REQUESTED: `${a.person.name} requested a replacement — ${a.positionName}`,
      };
      const title = onBehalf ? `${user.name} → ${titleMap[status]}` : titleMap[status];
      const body = `${a.service.title} · ${a.service.date}${note ? ` — “${note}”` : ""}`;
      const link = `/services/${a.serviceId}?tab=team`;

      // team leaders (batched into ONE insert)
      const leaders = await prisma.teamMember.findMany({
        where: { teamId: a.teamId, isLeader: true },
        select: { person: { select: { user: { select: { id: true } } } } },
      });
      const rows = leaders
        .map((l) => l.person.user?.id)
        .filter((id): id is string => !!id)
        .map((userId) => ({
          userId, organizationId: user.organizationId, title, body,
          kind: status === "ACCEPTED" ? "SUCCESS" : "WARNING", link,
        }));
      // the affected volunteer, when a leader responded for them
      if (onBehalf) {
        const pu = await prisma.user.findFirst({ where: { personId: a.personId }, select: { id: true } });
        if (pu) {
          const verb = status === "ACCEPTED" ? "accepted" : status === "DECLINED" ? "declined" : "requested a replacement";
          rows.push({
            userId: pu.id, organizationId: user.organizationId,
            title: `${user.name} ${verb} for you — ${a.positionName}`,
            body: `${a.service.title} · ${a.service.date}`,
            kind: status === "ACCEPTED" ? "SUCCESS" : "WARNING", link,
          });
        }
      }
      if (rows.length) await prisma.notification.createMany({ data: rows });
      await audit(user.organizationId, user.id, `assignment.${action}`, "Assignment", a.id);
    } catch (e) {
      console.error("[respondToAssignment] after():", e);
    }
  });

  // The page the form lives on re-renders as part of the action response —
  // no need to eagerly revalidate every other route too.
  revalidatePath(`/services/${a.serviceId}`);
}

/** Leader confirms all accepted positions on a service. */
export async function confirmAll(fd: FormData) {
  const user = await requireUser();
  const serviceId = s(fd, "serviceId");
  const svc = await prisma.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!svc) return;
  if (!(await canAny(user, ["schedule", "manage_services"]))) throw new Error("Not allowed");
  await prisma.assignment.updateMany({
    where: { serviceId, status: "ACCEPTED" },
    data: { status: "CONFIRMED" },
  });
  revalidatePath(`/services/${serviceId}`);
}

/** One-click auto schedule for the whole service. */
export async function autoSchedule(fd: FormData) {
  const user = await requireUser();
  const serviceId = s(fd, "serviceId");
  const svc = await prisma.service.findFirst({ where: { id: serviceId, organizationId: user.organizationId } });
  if (!svc) return;
  if (!(await canAny(user, ["schedule", "manage_services"]))) throw new Error("Not allowed");
  const res = await autoScheduleService(serviceId, user.organizationId);

  // notify everyone newly scheduled
  const pending = await prisma.assignment.findMany({
    where: { serviceId, status: "PENDING" },
    include: { person: { include: { user: true } }, service: true, team: true },
  });
  for (const p of pending) {
    if (p.person?.user) {
      await notifyUser(p.person.user.id, user.organizationId, {
        title: `New request: ${p.positionName}`,
        body: `${p.service.title} · ${p.service.date} at ${p.service.startTime}${p.team ? ` — ${p.team.name}` : ""}. Tap to see the plan and everyone serving with you.`,
        kind: "ASSIGNMENT",
        link: `/services/${serviceId}?tab=team`,
      });
    }
  }
  await audit(user.organizationId, user.id, "service.autoschedule", "Service", serviceId, res);
  revalidatePath(`/services/${serviceId}`);
}
