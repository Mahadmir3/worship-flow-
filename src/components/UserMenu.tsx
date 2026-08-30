"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import { ROLE_LABEL } from "@/lib/constants";

export function UserMenu({ name, role, email }: { name: string; role: string; email: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-xl p-1.5 transition hover:bg-brand-50"
        aria-haspopup="menu"
        aria-label="Account menu"
      >
        <Avatar name={name} size={32} />
        <span className="hidden text-left sm:block">
          <span className="block max-w-[9rem] truncate text-sm font-semibold leading-tight text-ink">{name}</span>
          <span className="block text-[11px] leading-tight text-ink/45">{ROLE_LABEL[role] || role}</span>
        </span>
        <ChevronDown className="hidden h-4 w-4 text-ink/40 sm:block" />
      </button>
      {open && (
        <div className="absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-2xl border border-line bg-surface shadow-pop">
          <div className="border-b border-line px-4 py-3">
            <p className="truncate text-sm font-bold text-ink">{name}</p>
            <p className="truncate text-xs text-ink/45">{email}</p>
          </div>
          <div className="p-1.5">
            <Link href="/settings" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50">
              Settings
            </Link>
            <Link href="/settings/notifications" onClick={() => setOpen(false)} className="block rounded-lg px-3 py-2 text-sm font-medium text-ink/80 hover:bg-brand-50">
              Notification settings
            </Link>
            <form action="/api/auth/logout" method="post">
              <button type="submit" className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50">
                Sign out
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
