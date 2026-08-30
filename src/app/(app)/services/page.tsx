import Link from "next/link";
import { Church, Clock, FolderPlus, MapPin, MoveRight, Pencil, Plus, Trash2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { SERVICE_STATUS } from "@/lib/constants";
import { fmtDate, fmtDurationRange, todayIn } from "@/lib/format";
import { getCampusFilter } from "@/actions/settings";
import { Badge, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { canDo } from "@/lib/perms";
import { createFolder, deleteFolder, moveServiceToFolder, renameFolder } from "@/actions/settings";

export const metadata = { title: "Events" };

export default async function ServicesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ folder?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const today = todayIn(user.organization.timezone);
  const campusFilter = await getCampusFilter();

  const [folders, services, canManage, canAdmin] = await Promise.all([
    prisma.eventFolder.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { sortOrder: "asc" },
      include: { _count: { select: { services: true } } },
    }),
    prisma.service.findMany({
      where: {
        organizationId: user.organizationId,
        ...(campusFilter ? { campusId: campusFilter } : {}),
      },
      include: { type: true, campus: true, venue: true, folder: true, assignments: true },
      orderBy: { date: "desc" },
      take: 80,
    }),
    canDo(user, "manage_services"),
    canDo(user, "manage_org"),
  ]);

  const activeFolder = folders.find((f) => f.id === searchParams.folder) || null;
  const visible = activeFolder
    ? services.filter((s) => s.folderId === activeFolder.id)
    : services;
  const upcoming = visible.filter((s) => s.date >= today).reverse();
  const past = visible.filter((s) => s.date < today);
  const unfiled = services.filter((s) => !s.folderId);

  // Grouped view when browsing "All events"
  const groups = activeFolder
    ? []
    : [
        ...folders.map((f) => ({
          folder: f,
          items: services.filter((s) => s.folderId === f.id),
        })),
        ...(unfiled.length ? [{ folder: null, items: unfiled }] : []),
      ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Events</h1>
          <p className="mt-1 text-sm text-ink/50">
            {activeFolder ? `${activeFolder.name} · ${visible.length} event${visible.length === 1 ? "" : "s"}` : `${services.length} events organised in ${folders.length} folder${folders.length === 1 ? "" : "s"}`}
          </p>
        </div>
        {canManage && (
          <Link href="/services/new" className="btn-primary">
            <Plus className="h-4 w-4" /> New event
          </Link>
        )}
      </div>

      {/* Folder tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Event folders">
        <Link
          href="/services"
          role="tab"
          aria-selected={!activeFolder}
          className={`chip whitespace-nowrap px-4 py-2 ${!activeFolder ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-ink/65 hover:border-brand-300"}`}
        >
          <FolderIcon /> All events <span className="opacity-60">{services.length}</span>
        </Link>
        {folders.map((f) => (
          <Link
            key={f.id}
            href={`/services?folder=${f.id}`}
            role="tab"
            aria-selected={activeFolder?.id === f.id}
            className={`chip whitespace-nowrap px-4 py-2 ${activeFolder?.id === f.id ? "border-brand-700 bg-brand-700 text-white" : "border-line bg-surface text-ink/65 hover:border-brand-300"}`}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: f.color }} aria-hidden />
            {f.name} <span className="opacity-60">{f._count.services}</span>
          </Link>
        ))}
        {canAdmin && (
          <Modal
            title="New folder"
            subtitle="Group your events — e.g. Sundays, conferences, weddings."
            trigger={
              <button className="chip whitespace-nowrap border-dashed border-line bg-surface px-3 py-2 text-ink/55 hover:border-brand-400 hover:text-brand-700">
                <FolderPlus className="h-3.5 w-3.5" /> New folder
              </button>
            }
          >
            <form action={createFolder} className="space-y-4">
              <div>
                <label className="label" htmlFor="fd-name">Folder name</label>
                <input id="fd-name" name="name" required className="input" placeholder="e.g. Conferences" />
              </div>
              <div>
                <label className="label" htmlFor="fd-color">Colour</label>
                <select id="fd-color" name="color" className="input" defaultValue="#4F46E5">
                  {["#4F46E5", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DB2777", "#64748B"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full">Create folder</button>
            </form>
          </Modal>
        )}
      </div>

      {/* Folder admin bar */}
      {activeFolder && canAdmin && (
        <div className="flex items-center gap-2">
          <Modal
            title="Rename folder"
            trigger={<button className="btn-secondary btn-sm"><Pencil className="h-3.5 w-3.5" /> Rename</button>}
          >
            <form action={renameFolder} className="space-y-4">
              <input type="hidden" name="folderId" value={activeFolder.id} />
              <div>
                <label className="label" htmlFor="rf-name">Folder name</label>
                <input id="rf-name" name="name" defaultValue={activeFolder.name} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="rf-color">Colour</label>
                <select id="rf-color" name="color" className="input" defaultValue={activeFolder.color}>
                  {["#4F46E5", "#7C3AED", "#0891B2", "#059669", "#D97706", "#DB2777", "#64748B"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
              <button className="btn-primary w-full">Save</button>
            </form>
          </Modal>
          <Modal
            title={`Delete “${activeFolder.name}”?`}
            subtitle="The events inside are kept and become unfiled."
            trigger={<button className="btn-danger btn-sm"><Trash2 className="h-3.5 w-3.5" /> Delete folder</button>}
          >
            <form action={deleteFolder} className="space-y-4">
              <input type="hidden" name="folderId" value={activeFolder.id} />
              <p className="text-sm text-ink/60">This removes the folder only. No events are deleted.</p>
              <button className="btn-danger w-full">Delete folder</button>
            </form>
          </Modal>
        </div>
      )}

      {services.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={<Church className="h-6 w-6" />}
            title="No events yet"
            hint="Create your first event to start planning. WorshipFlow will help you build the order, schedule teams and share resources."
          />
        </div>
      ) : activeFolder ? (
        <>
          <ServiceTable title="Upcoming" services={upcoming} folders={folders} canManage={canManage} />
          {past.length > 0 && <ServiceTable title="Past" services={past.slice(0, 12)} folders={folders} canManage={canManage} />}
        </>
      ) : (
        groups.map((g) => (
          <section key={g.folder?.id || "unfiled"}>
            <div className="mb-3 flex items-center gap-2">
              {g.folder ? (
                <>
                  <span className="h-3 w-3 rounded-full" style={{ background: g.folder.color }} aria-hidden />
                  <h2 className="text-base font-bold tracking-tight text-ink">{g.folder.name}</h2>
                </>
              ) : (
                <h2 className="text-base font-bold tracking-tight text-ink/50">Unfiled</h2>
              )}
              <span className="text-xs text-ink/40">{g.items.length}</span>
              {g.folder && (
                <Link href={`/services?folder=${g.folder.id}`} className="text-xs font-bold text-brand-700 hover:underline">
                  Open →
                </Link>
              )}
            </div>
            <ServiceTable title="" services={g.items} folders={folders} canManage={canManage} hideTitles />
          </section>
        ))
      )}
    </div>
  );
}

function FolderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor" aria-hidden className="opacity-70">
      <path d="M1.5 3.5A1.5 1.5 0 0 1 3 2h3.2c.4 0 .78.16 1.06.44l.86.86c.1.1.22.2.44.2H13a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 13 13.5H3a1.5 1.5 0 0 1-1.5-1.5v-8.5Z" />
    </svg>
  );
}

function ServiceTable({
  title,
  services,
  folders,
  canManage,
  hideTitles,
}: {
  title: string;
  services: any[];
  folders: any[];
  canManage: boolean;
  hideTitles?: boolean;
}) {
  const isPast = hideTitles ? false : title === "Past";
  return (
    <div className="card divide-y divide-line/70 overflow-hidden">
      {!hideTitles && (
        <p className="border-b border-line px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-ink/45">
          {title}
        </p>
      )}
      {services.slice(0, hideTitles ? 8 : undefined).map((svc) => {
        const open = svc.assignments.filter((a: any) => a.status === "OPEN").length;
        const status = SERVICE_STATUS[svc.status] || SERVICE_STATUS.PLANNING;
        return (
          <div
            key={svc.id}
            className={`flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center ${isPast ? "opacity-70" : ""}`}
          >
            <Link href={`/services/${svc.id}`} className="flex w-full min-w-0 flex-1 items-center gap-4 sm:w-auto">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-[10px] font-extrabold uppercase leading-tight text-white"
                style={{ background: svc.type?.color || "#323A8C" }}
              >
                {svc.date.slice(8)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink hover:text-brand-700">{svc.title}</p>
                <p className="flex flex-wrap items-center gap-x-3 text-xs text-ink/50">
                  <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDurationRange(svc.startTime, svc.endTime)}</span>
                  <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{svc.campus?.name}</span>
                  <span>{fmtDate(svc.date, { weekday: undefined, year: undefined })}</span>
                </p>
              </div>
            </Link>
            <div className="flex flex-wrap items-center gap-2">
              {svc.folder && (
                <Badge className="border-line bg-paper text-ink/60">
                  <span className="h-2 w-2 rounded-full" style={{ background: svc.folder.color }} aria-hidden />
                  {svc.folder.name}
                </Badge>
              )}
              {!isPast &&
                (open > 0 ? (
                  <Badge className="border-amber-200 bg-amber-50 text-amber-700">{open} open</Badge>
                ) : (
                  <Badge className="border-emerald-200 bg-emerald-50 text-emerald-600">Full team</Badge>
                ))}
              <Badge className={status.className}>{status.label}</Badge>
              {canManage && (
                <Modal
                  title={`Move “${svc.title}”`}
                  trigger={
                    <button className="rounded-lg p-1.5 text-ink/30 hover:bg-brand-50 hover:text-brand-700" aria-label="Move to folder">
                      <MoveRight className="h-4 w-4" />
                    </button>
                  }
                >
                  <form action={moveServiceToFolder} className="space-y-4">
                    <input type="hidden" name="serviceId" value={svc.id} />
                    <div>
                      <label className="label" htmlFor={`mf-${svc.id}`}>Folder</label>
                      <select id={`mf-${svc.id}`} name="folderId" className="input" defaultValue={svc.folderId || ""}>
                        <option value="">— Unfiled —</option>
                        {folders.map((f: any) => (
                          <option key={f.id} value={f.id}>{f.name}</option>
                        ))}
                      </select>
                    </div>
                    <button className="btn-primary w-full">Move event</button>
                  </form>
                </Modal>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
