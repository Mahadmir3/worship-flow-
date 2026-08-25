import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Share2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo } from "@/lib/perms";
import { fmtDate, fmtDurationRange } from "@/lib/format";
import { ServicePlanEditor } from "@/components/ServicePlanEditor";
import { PrintButton } from "@/components/PrintButton";

export const metadata = { title: "Service plan" };

export default async function PlanPage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const user = await requireUser();
  const service = await prisma.service.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: {
      type: true,
      campus: true,
      venue: true,
      items: { orderBy: { sortOrder: "asc" }, include: { song: true } },
    },
  });
  if (!service) notFound();

  const [people, songs] = await Promise.all([
    prisma.person.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.song.findMany({ where: { organizationId: user.organizationId }, orderBy: { title: "asc" } }),
  ]);

  const personNames = new Map(people.map((p) => [p.id, p.name]));
  const editable = await canDo(user, "manage_services");

  const whatsappText = encodeURIComponent(
    `${service.title} — ${fmtDate(service.date)}\n\n` +
      service.items
        .map((i) => `• ${i.title}${i.notes ? ` — ${i.notes}` : ""}`)
        .join("\n")
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 no-print">
        <Link href={`/services/${service.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink/50 hover:text-brand-700">
          <ArrowLeft className="h-4 w-4" /> Service details
        </Link>
        <div className="flex gap-2">
          <a href={`https://wa.me/?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="btn-secondary btn-sm">
            <Share2 className="h-3.5 w-3.5" /> Share on WhatsApp
          </a>
          <PrintButton />
        </div>
      </div>

      <div className="no-print">
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">{service.title} — plan</h1>
        <p className="mt-1 text-sm text-ink/50">
          {fmtDate(service.date)} · {fmtDurationRange(service.startTime, service.endTime)} · {service.campus?.name}
          {editable && (
            <span className="ml-2 hidden text-ink/35 sm:inline">Drag the grip handle to reorder · tap a row to expand</span>
          )}
        </p>
      </div>

      <div className="hidden print:block">
        <h1 className="text-xl font-extrabold">{service.title}</h1>
        <p className="text-sm">
          {fmtDate(service.date)} · {fmtDurationRange(service.startTime, service.endTime)} · {service.campus?.name}
          {service.venue ? ` — ${service.venue.name}` : ""}
        </p>
      </div>

      <ServicePlanEditor
        serviceId={service.id}
        startTime={service.startTime}
        editable={editable}
        people={people.map((p) => ({ id: p.id, name: p.name }))}
        songs={songs.map((s) => ({ id: s.id, title: s.title, defaultKey: s.defaultKey }))}
        items={service.items.map((i) => ({
          id: i.id,
          title: i.title,
          type: i.type,
          durationSec: i.durationSec,
          personId: i.personId,
          personName: i.personId ? personNames.get(i.personId) || null : null,
          songId: i.songId,
          songTitle: i.song?.title || null,
          key: i.key,
          notes: i.notes,
        }))}
      />
    </div>
  );
}
