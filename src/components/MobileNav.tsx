"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  Church,
  Home,
  ListMusic,
  MoreHorizontal,
  Settings,
  Music4,
  MessageSquare,
  CheckSquare,
  BarChart3,
  FolderOpen,
  Users,
  CalendarDays,
  LogOut,
  Wifi,
} from "lucide-react";

export function MobileNav({ role }: { role: string }) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const tabs = [
    { href: "/dashboard", label: "Home", icon: Home, exact: true },
    { href: "/services", label: "Services", icon: Church },
    { href: "/schedule", label: "Schedule", icon: CalendarClock },
    { href: "/teams", label: "Teams", icon: Users },
  ];

  const moreLinks = [
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/people", label: "People", icon: Users },
    { href: "/songs", label: "Songs", icon: ListMusic },
    { href: "/rehearsals", label: "Rehearsals", icon: Music4 },
    { href: "/media", label: "Media Library", icon: FolderOpen },
    { href: "/messages", label: "Messages", icon: MessageSquare },
    { href: "/tasks", label: "Tasks", icon: CheckSquare },
    { href: "/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/settings", label: "Settings", icon: Settings },
  ];

  const isActive = (href: string, exact?: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <>
      {moreOpen && (
        <div
          className="fixed inset-0 z-[60] bg-ink/40 backdrop-blur-sm lg:hidden"
          onClick={() => setMoreOpen(false)}
        />
      )}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-[70] border-t border-line bg-white/95 backdrop-blur lg:hidden no-print"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        {moreOpen && (
          <div className="grid grid-cols-3 gap-1 border-b border-line p-3">
            {moreLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMoreOpen(false)}
                className="flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-medium text-ink/70 hover:bg-brand-50"
              >
                <l.icon className="h-5 w-5 text-brand-600" />
                {l.label}
              </Link>
            ))}
            <form action="/api/auth/logout" method="post" className="flex">
              <button className="flex w-full flex-col items-center gap-1.5 rounded-xl px-2 py-3 text-[11px] font-medium text-rose-600">
                <LogOut className="h-5 w-5" />
                Sign out
              </button>
            </form>
          </div>
        )}
        <div className="grid grid-cols-5">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
                isActive(t.href, t.exact) ? "text-brand-700" : "text-ink/45"
              }`}
            >
              <t.icon className="h-5 w-5" />
              {t.label}
              {isActive(t.href, t.exact) && (
                <span className="absolute bottom-0 h-0.5 w-8 rounded-full bg-gold-500" />
              )}
            </Link>
          ))}
          <button
            type="button"
            onClick={() => setMoreOpen((o) => !o)}
            aria-expanded={moreOpen}
            aria-label="More pages"
            className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${
              moreOpen ? "text-brand-700" : "text-ink/45"
            }`}
          >
            <MoreHorizontal className="h-5 w-5" />
            More
          </button>
        </div>
      </nav>
    </>
  );
}
