"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

type Notif = {
  id: string;
  title: string;
  body: string;
  kind: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

export function NotificationBell({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notif[] | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch("/api/notifications", { cache: "no-store" });
        const json = await res.json();
        setUnread(json.unread || 0);
      } catch {}
    };
    const iv = setInterval(poll, 30000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      const res = await fetch("/api/notifications?full=1", { cache: "no-store" });
      const json = await res.json();
      setItems(json.items || []);
      await fetch("/api/notifications", { method: "POST" });
      setUnread(0);
    };
    load();
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div className="relative" ref={boxRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications${unread ? ` (${unread} unread)` : ""}`}
        className="relative rounded-xl p-2.5 text-ink/60 transition hover:bg-brand-50 hover:text-ink"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gold-500 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[22rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="border-b border-line px-4 py-3">
            <p className="text-sm font-bold text-ink">Notifications</p>
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!items && <p className="px-4 py-6 text-sm text-ink/40">Loading…</p>}
            {items && items.length === 0 && (
              <p className="px-4 py-8 text-center text-sm text-ink/40">You're all caught up 🎉</p>
            )}
            {items?.map((n) => (
              <Link
                key={n.id}
                href={n.link || "#"}
                onClick={() => setOpen(false)}
                className={`block border-b border-line/60 px-4 py-3 transition hover:bg-brand-50/60 ${
                  n.read ? "" : "bg-brand-50/40"
                }`}
              >
                <p className="text-sm font-semibold text-ink">{n.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-ink/55">{n.body}</p>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
