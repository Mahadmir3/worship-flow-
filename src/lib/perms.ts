import "server-only";
import { prisma } from "@/lib/db";
import type { SessionUser } from "@/lib/auth";

/**
 * Tier + grant authorization.
 *
 * Tiers (User.role):
 *  - OWNER      the pastor who paid — owns the church account. Everything.
 *  - ADMIN      runs the whole account. Creates events, teams, people, songs.
 *               Grants extra rights to anyone.
 *  - LEADER     department leader. Manages THEIR OWN teams: members,
 *               positions and that team's rehearsals. Leaders of a worship
 *               or choir team also manage the song library. Can promote
 *               accounts. Cannot create events or other teams.
 *  - VOLUNTEER  own schedule only, until promoted or granted a right.
 *
 * Extra rights (PermissionGrant) are given per person by admins in
 * Settings → Roles & permissions, on top of the tiers above.
 */

export const GRANTABLE_CAPABILITIES = [
  { id: "manage_services", label: "Create & edit events", description: "Create events, build orders of service, run live mode" },
  { id: "schedule", label: "Schedule volunteers", description: "Assign people to positions, auto-schedule, confirm teams" },
  { id: "manage_people", label: "Add & edit people", description: "Add volunteers, edit profiles and availability" },
  { id: "manage_teams", label: "Create & edit any team", description: "Create teams, and edit teams other than your own" },
  { id: "manage_songs", label: "Manage the song library", description: "Add songs, arrangements, charts and lyrics" },
  { id: "manage_rehearsals", label: "Manage any rehearsal", description: "Create and edit rehearsals for any team" },
  { id: "view_analytics", label: "View analytics", description: "See participation, burnout and reporting" },
] as const;

export type GrantableCapability = (typeof GRANTABLE_CAPABILITIES)[number]["id"];

export function isOwner(user: SessionUser) {
  return user.role === "OWNER";
}

export function isAdminTier(user: SessionUser) {
  return user.role === "OWNER" || user.role === "ADMIN";
}

async function hasGrant(user: SessionUser, capability: string): Promise<boolean> {
  const grant = await prisma.permissionGrant.findFirst({
    where: { userId: user.id, capability },
    select: { id: true },
  });
  return !!grant;
}

/** Admin/owner, or an explicitly granted right (no tier bonuses). */
export async function hasGrantOrAdmin(user: SessionUser, capability: string): Promise<boolean> {
  return isAdminTier(user) || hasGrant(user, capability);
}

/** Teams this user leads (via the person record linked to their account). */
export async function ledTeams(user: SessionUser): Promise<{ id: string; name: string; category: string }[]> {
  if (!user.personId) return [];
  return prisma.team.findMany({
    where: { leaderPersonId: user.personId, organizationId: user.organizationId },
    select: { id: true, name: true, category: true },
    orderBy: { name: "asc" },
  });
}

/** Does the user lead a team in one of the given categories (e.g. WORSHIP)? */
export async function leadsTeamIn(user: SessionUser, categories: string[]): Promise<boolean> {
  if (!user.personId) return false;
  const t = await prisma.team.findFirst({
    where: { leaderPersonId: user.personId, organizationId: user.organizationId, category: { in: categories } },
    select: { id: true },
  });
  return !!t;
}

/** Leads this specific team? */
async function leadsTeam(user: SessionUser, teamId: string): Promise<boolean> {
  if (!user.personId) return false;
  const t = await prisma.team.findFirst({
    where: { id: teamId, leaderPersonId: user.personId, organizationId: user.organizationId },
    select: { id: true },
  });
  return !!t;
}

/**
 * Page-level capability check ("should we show this button?").
 * Department leaders pass automatically for their department's capabilities.
 */
export async function canDo(user: SessionUser, capability: string): Promise<boolean> {
  if (isAdminTier(user)) return true;
  if (capability === "manage_songs" && (await leadsTeamIn(user, ["WORSHIP", "CHOIR"]))) return true;
  if (capability === "manage_rehearsals" && (await ledTeams(user)).length > 0) return true;
  return hasGrant(user, capability);
}

export async function canAny(user: SessionUser, capabilities: string[]): Promise<boolean> {
  for (const c of capabilities) {
    if (await canDo(user, c)) return true;
  }
  return false;
}

/**
 * Who can change roles (including making an account an Administrator):
 * the Owner, Administrators, and Department Leaders.
 */
export async function canManageRoles(user: SessionUser): Promise<boolean> {
  return isAdminTier(user) || user.role === "LEADER";
}

/** Edit a specific team (name, positions, membership): admins, grant holders, or its leader. */
export async function canManageTeam(user: SessionUser, teamId: string): Promise<boolean> {
  if (await hasGrantOrAdmin(user, "manage_teams")) return true;
  return leadsTeam(user, teamId);
}

/** Manage a rehearsal: admins / grant holders for any; a leader only for their own team's. */
export async function canManageRehearsal(user: SessionUser, teamId: string | null): Promise<boolean> {
  if (await hasGrantOrAdmin(user, "manage_rehearsals")) return true;
  if (!teamId) return false; // rehearsals without a team are admin/grant only
  return leadsTeam(user, teamId);
}

export async function listGrants(userId: string): Promise<string[]> {
  const rows = await prisma.permissionGrant.findMany({
    where: { userId },
    select: { capability: true },
  });
  return rows.map((r) => r.capability);
}
