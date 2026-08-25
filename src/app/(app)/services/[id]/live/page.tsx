import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canDo, leadsTeamIn } from "@/lib/perms";
import { addMinutes } from "@/lib/format";
import { LiveView } from "@/components/LiveView";

export const metadata = { title: "Live mode" };

export default async function LivePage({ params: paramsPromise }: { params: Promise<{ id: string }> }) {
  const params = await paramsPromise;
  const user = await requireUser();
  const service = await prisma.service.findFirst({
    where: { id: params.id, organizationId: user.organizationId },
    include: { items: { orderBy: { sortOrder: "asc" } } },
  });
  if (!service) notFound();

  const people = await prisma.person.findMany({ where: { organizationId: user.organizationId } });
  const personNames = new Map(people.map((p) => [p.id, p.name]));

  let t = service.startTime;
  const items = service.items.map((i) => {
    const start = t;
    t = addMinutes(t, Math.round(i.durationSec / 60));
    return {
      id: i.id,
      title: i.title,
      type: i.type,
      startTime: start,
      durationSec: i.durationSec,
      notes: i.notes,
      personName: i.personId ? personNames.get(i.personId) || null : null,
    };
  });

  return (
    <LiveView
      serviceId={service.id}
      serviceTitle={service.title}
      items={items}
      canControl={(await canDo(user, "manage_services")) || (await leadsTeamIn(user, ["PRODUCTION"]))}
      initialCursor={service.liveItemId}
      initialAnnouncement={service.liveAnnouncement}
    />
  );
}
