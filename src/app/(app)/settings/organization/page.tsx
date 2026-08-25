import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCIES, TIMEZONES } from "@/lib/constants";
import { canDo } from "@/lib/perms";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createCampus, createVenue, updateOrganization } from "@/actions/settings";

export const metadata = { title: "Organization settings" };

export default async function OrgSettingsPage() {
  const user = await requireUser();
  const manage = await canDo(user, "manage_org");

  const [org, campuses] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId }, include: { campuses: { include: { venues: true } } } }),
    prisma.campus.findMany({ where: { organizationId: user.organizationId }, include: { venues: true } }),
  ]);
  if (!org) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Organization</h1>
        <p className="mt-1 text-sm text-ink/50">Identity, campuses, venues and regional settings</p>
      </div>

      <Card>
        <CardHeader title="Church information" subtitle={manage ? "Applies to your whole workspace" : "Read-only — requires administrator"} />
        {manage ? (
          <form action={updateOrganization} className="grid gap-4 p-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label" htmlFor="org-name">Organization name</label>
              <input id="org-name" name="name" defaultValue={org.name} required className="input" />
            </div>
            <div>
              <label className="label" htmlFor="org-tz">Time zone</label>
              <select id="org-tz" name="timezone" defaultValue={org.timezone} className="input">
                {TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label" htmlFor="org-cur">Currency</label>
              <select id="org-cur" name="currency" defaultValue={org.currency} className="input">
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.label}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <button className="btn-primary">Save organization</button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 p-5 text-sm text-ink/70">
            <p><b>{org.name}</b></p>
            <p>{org.timezone} · {org.currency}</p>
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Campuses & venues"
          subtitle="Filter services, teams and people by campus"
          action={
            manage ? (
              <Modal
                title="Add a campus"
                trigger={<button className="btn-primary btn-sm">Add campus</button>}
              >
                <form action={createCampus} className="space-y-4">
                  <div>
                    <label className="label" htmlFor="cs-name">Campus name</label>
                    <input id="cs-name" name="name" required className="input" placeholder="e.g. Ntinda Campus" />
                  </div>
                  <div>
                    <label className="label" htmlFor="cs-addr">Address</label>
                    <input id="cs-addr" name="address" className="input" />
                  </div>
                  <div>
                    <label className="label" htmlFor="cs-venue">Main venue (optional)</label>
                    <input id="cs-venue" name="venueName" className="input" placeholder="e.g. Main Auditorium" />
                  </div>
                  <button className="btn-primary w-full">Create campus</button>
                </form>
              </Modal>
            ) : undefined
          }
        />
        <ul className="divide-y divide-line/70">
          {campuses.map((c) => (
            <li key={c.id} className="px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-bold text-ink">{c.name}</p>
                <Badge className="border-line bg-paper text-ink/55">{c.venues.length} venue{c.venues.length === 1 ? "" : "s"}</Badge>
              </div>
              {c.address && <p className="mt-0.5 text-xs text-ink/50">{c.address}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">
                {c.venues.map((v) => (
                  <Badge key={v.id} className="border-brand-100 bg-brand-50 text-brand-700">{v.name}{v.capacity ? ` · ${v.capacity}` : ""}</Badge>
                ))}
                {c.venues.length === 0 && <span className="text-xs text-ink/40">No venues yet</span>}
              </div>
              {manage && (
                <div className="mt-3">
                  <Modal
                    title={`Add venue to ${c.name}`}
                    trigger={<button className="btn-secondary btn-sm">Add venue</button>}
                  >
                    <form action={createVenue} className="space-y-4">
                      <input type="hidden" name="campusId" value={c.id} />
                      <div>
                        <label className="label" htmlFor="vn-name">Venue name</label>
                        <input id="vn-name" name="name" required className="input" placeholder="e.g. Youth Hall" />
                      </div>
                      <div>
                        <label className="label" htmlFor="vn-cap">Capacity (optional)</label>
                        <input id="vn-cap" name="capacity" type="number" className="input" />
                      </div>
                      <button className="btn-primary w-full">Add venue</button>
                    </form>
                  </Modal>
                </div>
              )}
            </li>
          ))}
        </ul>
        {campuses.length === 0 && <EmptyState title="No campuses" />}
      </Card>
    </div>
  );
}
