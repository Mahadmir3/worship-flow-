import Link from "next/link";
import { Hash, Pin, Plus, Send, Megaphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Avatar, Card, CardHeader, EmptyState } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/Modal";
import { createChannel, postMessage, togglePin } from "@/actions/messages";
import { ChatThread } from "@/components/ChatThread";

export const metadata = { title: "Messages" };

export default async function MessagesPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ c?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();
  const channels = await prisma.channel.findMany({
    where: { organizationId: user.organizationId },
    include: { messages: { orderBy: { createdAt: "desc" }, take: 1, include: { user: true } } },
    orderBy: { createdAt: "asc" },
  });

  const active = channels.find((c) => c.id === searchParams.c) || channels[0];
  const messages = active
    ? await prisma.message.findMany({
        where: { channelId: active.id },
        orderBy: { createdAt: "asc" },
        take: 80,
        include: { user: true },
      })
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">Messages</h1>
          <p className="mt-1 text-sm text-ink/50">Team channels, announcements & coordination</p>
        </div>
        <Modal
          title="Create a channel"
          trigger={<button className="btn-primary"><Plus className="h-4 w-4" /> New channel</button>}
        >
          <form action={createChannel} className="space-y-4">
            <div>
              <label className="label" htmlFor="ch-name">Channel name</label>
              <input id="ch-name" name="name" required className="input" placeholder="e.g. Youth Worship" />
            </div>
            <div>
              <label className="label" htmlFor="ch-purpose">Purpose</label>
              <input id="ch-purpose" name="purpose" className="input" placeholder="What is this channel about?" />
            </div>
            <button className="btn-primary w-full">Create channel</button>
          </form>
        </Modal>
      </div>

      <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
        <Card className="h-fit overflow-hidden">
          <CardHeader title="Channels" icon={<Hash className="h-4 w-4" />} />
          <ul className="max-h-96 overflow-y-auto">
            {channels.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/messages?c=${c.id}`}
                  className={`block px-5 py-3 transition ${active?.id === c.id ? "bg-brand-50" : "hover:bg-brand-50/50"}`}
                >
                  <p className={`text-sm font-bold ${active?.id === c.id ? "text-brand-800" : "text-ink"}`}>
                    <Hash className="mr-1 inline h-3.5 w-3.5 text-ink/35" />
                    {c.name}
                  </p>
                  {c.messages[0] && (
                    <p className="mt-0.5 truncate text-xs text-ink/45">
                      {c.messages[0].user.name.split(" ")[0]}: {c.messages[0].body}
                    </p>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>

        {active ? (
          <Card className="flex min-h-[28rem] flex-col overflow-hidden">
            <CardHeader title={active.name} subtitle={active.purpose || "Channel"} icon={<Megaphone className="h-4 w-4" />} />
            <ChatThread
              channelId={active.id}
              initialMessages={messages.map((m) => ({
                id: m.id,
                body: m.body,
                pinned: m.pinned,
                author: m.user.name,
                createdAt: m.createdAt.toISOString(),
              }))}
              canPin={true}
            />
          </Card>
        ) : (
          <div className="card">
            <EmptyState title="No channels yet" hint="Create your first channel to start communicating." />
          </div>
        )}
      </div>
    </div>
  );
}
