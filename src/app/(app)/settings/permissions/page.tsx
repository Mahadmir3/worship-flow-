import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { Avatar, Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { setUserRole, grantCapability, revokeCapability } from "@/actions/settings";
import { canDo, canManageRoles, GRANTABLE_CAPABILITIES } from "@/lib/perms";
import { ShieldCheck } from "lucide-react";

export const metadata = { title: "Roles & permissions" };

export default async function PermissionsPage() {
  const user = await requireUser();
  const canRoles = await canManageRoles(user); // owner, admins & department leaders
  const canGrant = await canDo(user, "manage_org"); // owner & admins only

  const [users, teams] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: user.organizationId },
      include: { person: true, grants: true },
      orderBy: [{ role: "asc" }, { name: "asc" }],
    }),
    prisma.team.findMany({
      where: { organizationId: user.organizationId },
      select: { name: true, leaderPersonId: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const ledBy = (personId: string | null) =>
    personId ? teams.filter((t) => t.leaderPersonId === personId).map((t) => t.name) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Roles &amp; permissions</h1>
        <p className="mt-1 text-sm text-ink/50">
          Only the Owner, Administrators and Department Leaders can create or add anything — and give
          accounts rights, including making an account an Administrator.
        </p>
      </div>

      <Card>
        <CardHeader title="The three levels" subtitle="Who can do what" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-4">
          {ROLES.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-paper/60 p-4">
              <p className="text-sm font-bold text-ink">{r.label}</p>
              <p className="mt-1 text-xs leading-relaxed text-ink/55">{r.description}</p>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Accounts"
          subtitle={
            canRoles
              ? "Set each person's level — leaders and above can also make Administrators"
              : "Read-only — the Owner, Administrators and Department Leaders manage levels"
          }
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        {!canRoles ? (
          <div className="p-5">
            <EmptyState
              title="Ask a leader for access"
              hint="Your level can be raised by the Owner, an Administrator or a Department Leader."
            />
          </div>
        ) : (
          <ul className="divide-y divide-line/70">
            {users.map((u) => {
              const isOwnerRow = u.role === "OWNER";
              const isAdminRow = u.role === "ADMIN";
              const led = ledBy(u.personId);
              return (
                <li key={u.id} className="px-5 py-4">
                  <div className="flex flex-wrap items-center gap-3">
                    <Avatar name={u.name} size={38} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{u.name}</p>
                      <p className="truncate text-xs text-ink/50">
                        {u.email}
                        {led.length > 0 && <> · leads {led.join(", ")}</>}
                      </p>
                    </div>
                    {isOwnerRow ? (
                      <Badge className="border-gold-200 bg-gold-50 text-gold-700">Owner — full access</Badge>
                    ) : (
                      <form action={setUserRole} className="flex items-center gap-2">
                        <input type="hidden" name="userId" value={u.id} />
                        <select
                          name="role"
                          defaultValue={u.role}
                          aria-label={`Level for ${u.name}`}
                          className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink/70"
                        >
                          {ROLES.filter((r) => r.id !== "OWNER").map((r) => (
                            <option key={r.id} value={r.id}>{r.label}</option>
                          ))}
                        </select>
                        <button className="btn-secondary btn-sm">Save</button>
                      </form>
                    )}
                    {isAdminRow && !isOwnerRow && (
                      <Badge className="border-brand-200 bg-brand-50 text-brand-700">Administrator — full access</Badge>
                    )}
                  </div>

                  {!isOwnerRow && !isAdminRow && canGrant && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {GRANTABLE_CAPABILITIES.map((cap) => {
                        const has = u.grants.some((g) => g.capability === cap.id);
                        return (
                          <form key={cap.id} action={has ? revokeCapability : grantCapability}>
                            <input type="hidden" name="userId" value={u.id} />
                            <input type="hidden" name="capability" value={cap.id} />
                            <button
                              title={cap.description}
                              aria-pressed={has}
                              className={`chip transition ${has
                                ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-600"
                                : "border-line bg-paper text-ink/45 hover:border-brand-400 hover:text-brand-700"
                                }`}
                            >
                              {has ? "✓" : "+"} {cap.label}
                            </button>
                          </form>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {canGrant && (
        <p className="px-1 text-xs leading-relaxed text-ink/45">
          Extra rights (the chips above) are given per person on top of their level. Department
          leaders already manage their own team&apos;s members and rehearsals automatically — worship
          and choir leaders also manage the song library.
        </p>
      )}
    </div>
  );
}
