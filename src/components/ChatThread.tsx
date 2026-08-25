"use client";

import { useEffect, useRef, useState } from "react";
import { Pin, PinOff, Send } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { postMessage, togglePin } from "@/actions/messages";

export type ChatMessage = {
  id: string;
  body: string;
  pinned: boolean;
  author: string;
  createdAt: string;
};

export function ChatThread({
  channelId,
  initialMessages,
  canPin,
}: {
  channelId: string;
  initialMessages: ChatMessage[];
  canPin: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMessages(initialMessages), [initialMessages]);

  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/messages?channelId=${channelId}`, { cache: "no-store" });
        const json = await res.json();
        if (Array.isArray(json.messages)) {
          setMessages((prev) =>
            JSON.stringify(prev) === JSON.stringify(json.messages) ? prev : json.messages
          );
        }
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [channelId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  const pinned = messages.filter((m) => m.pinned);
  const unpinned = messages.filter((m) => !m.pinned);

  return (
    <>
      {pinned.length > 0 && (
        <div className="border-b border-gold-200 bg-gold-50/70 px-5 py-3">
          {pinned.map((m) => (
            <p key={m.id} className="flex items-start gap-2 text-sm text-ink/75">
              <Pin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-gold-600" />
              <span>
                <b>{m.author}:</b> {m.body}
              </span>
            </p>
          ))}
        </div>
      )}
      <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
        {unpinned.length === 0 && (
          <p className="py-8 text-center text-sm text-ink/40">No messages yet — say hello 👋</p>
        )}
        {unpinned.map((m) => (
          <div key={m.id} className="flex items-start gap-3">
            <Avatar name={m.author} size={34} />
            <div className="min-w-0 flex-1">
              <p className="flex items-baseline gap-2">
                <span className="text-sm font-bold text-ink">{m.author}</span>
                <span className="text-[11px] text-ink/40">
                  {new Date(m.createdAt).toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap text-sm leading-relaxed text-ink/75">
                {renderMentions(m.body)}
              </p>
            </div>
            {canPin && (
              <form action={togglePin}>
                <input type="hidden" name="messageId" value={m.id} />
                <button
                  className="rounded-lg p-1.5 text-ink/25 transition hover:bg-gold-50 hover:text-gold-600"
                  aria-label={m.pinned ? "Unpin message" : "Pin message"}
                >
                  {m.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              </form>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form
        action={async (fd) => {
          const body = String(fd.get("body") || "");
          if (body.trim()) {
            setInput("");
            await postMessage(fd);
          }
        }}
        className="flex items-center gap-2 border-t border-line p-4"
      >
        <input
          name="body"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          className="input"
          placeholder={`Message… use @name to mention someone`}
          aria-label="Message"
          maxLength={1000}
        />
        <input type="hidden" name="channelId" value={channelId} />
        <button type="submit" className="btn-primary shrink-0" aria-label="Send message">
          <Send className="h-4 w-4" />
        </button>
      </form>
    </>
  );
}

function renderMentions(body: string) {
  return body.split(/(@\w+)/g).map((part, i) =>
    part.startsWith("@") ? (
      <span key={i} className="rounded-md bg-brand-100 px-1 font-bold text-brand-800">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}
