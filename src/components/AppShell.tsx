import Link from "next/link";
import {
  CalendarDays,
  CheckSquare,
  BarChart3,
  Church,
  FolderOpen,
  LayoutDashboard,
  ListMusic,
  MessageSquare,
  Mic2,
  CalendarClock,
  Settings,
  Sparkles,
  Users,
  Music4,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canDo } from "@/lib/perms";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { Avatar } from "@/components/ui/primitives";
import { SearchPalette } from "@/components/SearchPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { AssistantWidget } from "@/components/AssistantWidget";
import { MobileNav } from "@/components/MobileNav";
import { CampusSwitcher } from "@/components/CampusSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { Logo } from "@/components/Logo";

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [campuses, unread] = await Promise.all([
    prisma.campus.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const nav: { href: string; label: string; icon: React.ReactNode }[] = [
    { href: "/dashboard", label: "Dashboard", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
    { href: "/services", label: "Services", icon: <Church className="h-[18px] w-[18px]" /> },
    { href: "/calendar", label: "Calendar", icon: <CalendarDays className="h-[18px] w-[18px]" /> },
    { href: "/schedule", label: "My Schedule", icon: <CalendarClock className="h-[18px] w-[18px]" /> },
    { href: "/teams", label: "Teams", icon: <Users className="h-[18px] w-[18px]" /> },
    { href: "/people", label: "People", icon: <Mic2 className="h-[18px] w-[18px]" /> },
    { href: "/songs", label: "Songs", icon: <ListMusic className="h-[18px] w-[18px]" /> },
    { href: "/rehearsals", label: "Rehearsals", icon: <Music4 className="h-[18px] w-[18px]" /> },
    { href: "/media", label: "Media Library", icon: <FolderOpen className="h-[18px] w-[18px]" /> },
    { href: "/messages", label: "Messages", icon: <MessageSquare className="h-[18px] w-[18px]" /> },
    { href: "/tasks", label: "Tasks", icon: <CheckSquare className="h-[18px] w-[18px]" /> },
  ];
  if (await canDo(user, "view_analytics")) {
    nav.push({ href: "/analytics", label: "Analytics", icon: <BarChart3 className="h-[18px] w-[18px]" /> });
  }
  nav.push({ href: "/settings", label: "Settings", icon: <Settings className="h-[18px] w-[18px]" /> });

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-gradient-to-b from-brand-900 to-brand-950 text-white lg:flex">
        <div className="flex items-center gap-2.5 px-5 pb-5 pt-6">
          <Logo className="h-9 w-9" mono />
          <div>
            <p className="text-[15px] font-extrabold tracking-tight">{BRAND.name}</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-gold-300/90">
              Service Suite
            </p>
          </div>
        </div>
        <div className="px-4 pb-4">
          <CampusSwitcher campuses={campuses.map((c) => ({ id: c.id, name: c.name }))} />
        </div>
        <nav className="flex-1 space-y-0.5 px-3 pb-4" aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-brand-100/80 transition hover:bg-white/10 hover:text-white"
            >
              <span className="text-brand-200/70 transition group-hover:text-gold-300">{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="wf-decor px-5 pb-5">
          <div className="rounded-2xl bg-white/5 p-4 text-xs leading-relaxed text-brand-100/70">
            <p className="font-bold text-gold-300">{user.organization.name}</p>
            <p className="mt-1">{BRAND.tagline}</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 border-b border-line bg-paper/90 backdrop-blur no-print">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="lg:hidden">
              <Logo className="h-8 w-8" />
            </div>
            <div className="min-w-0 flex-1">
              <SearchPalette />
            </div>
            <NotificationBell initialUnread={unread} />
            <UserMenu name={user.name} role={user.role} email={user.email} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 pb-28 sm:px-6 lg:pb-10">
          {children}
        </main>
        <footer className="no-print hidden border-t border-line px-6 py-4 text-center text-xs text-ink/35 lg:block">
          {BRAND.name} {BRAND.version} — {BRAND.tagline}
        </footer>
      </div>

      <MobileNav role={user.role} />
      <AssistantWidget />
    </div>
  );
}
