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
  Users,
  Music4,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canDo } from "@/lib/perms";
import { BRAND } from "@/lib/brand";
import { prisma } from "@/lib/db";
import { SearchPalette } from "@/components/SearchPalette";
import { NotificationBell } from "@/components/NotificationBell";
import { AssistantWidget } from "@/components/AssistantWidget";
import { MobileNav } from "@/components/MobileNav";
import { CampusSwitcher } from "@/components/CampusSwitcher";
import { UserMenu } from "@/components/UserMenu";
import { Logo } from "@/components/Logo";
import { Sidebar, SidebarSection } from "@/components/Sidebar";
import { ThemeToggle } from "@/components/ThemeToggle";

const icon = (I: React.ComponentType<{ className?: string }>) => (
  <I className="h-[18px] w-[18px]" />
);

export async function AppShell({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [campuses, unread] = await Promise.all([
    prisma.campus.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
    prisma.notification.count({ where: { userId: user.id, readAt: null } }),
  ]);

  const planning: SidebarSection["items"] = [
    { href: "/services", label: "Services", icon: icon(Church) },
    { href: "/calendar", label: "Calendar", icon: icon(CalendarDays) },
    { href: "/schedule", label: "My Schedule", icon: icon(CalendarClock) },
    { href: "/rehearsals", label: "Rehearsals", icon: icon(Music4) },
  ];
  const people: SidebarSection["items"] = [
    { href: "/teams", label: "Teams", icon: icon(Users) },
    { href: "/people", label: "People", icon: icon(Mic2) },
  ];
  const library: SidebarSection["items"] = [
    { href: "/songs", label: "Songs", icon: icon(ListMusic) },
    { href: "/media", label: "Media Library", icon: icon(FolderOpen) },
  ];
  const general: SidebarSection["items"] = [
    { href: "/messages", label: "Messages", icon: icon(MessageSquare), count: unread || undefined },
    { href: "/tasks", label: "Tasks", icon: icon(CheckSquare) },
  ];
  if (await canDo(user, "view_analytics")) {
    general.push({ href: "/analytics", label: "Analytics", icon: icon(BarChart3) });
  }
  general.push({ href: "/settings", label: "Settings", icon: icon(Settings) });

  const sections: SidebarSection[] = [
    { label: "Main", items: [{ href: "/dashboard", label: "Dashboard", icon: icon(LayoutDashboard) }] },
    { label: "Planning", items: planning },
    { label: "People", items: people },
    { label: "Library", items: library },
    { label: "General", items: general },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <div className="mx-auto flex max-w-[1500px] gap-5 p-4 lg:p-5">
        <Sidebar
          sections={sections}
          brandName={BRAND.name}
          orgName={user.organization.name}
          footer={
            <div className="rounded-2xl border border-line bg-surface p-3 text-xs leading-relaxed text-ink/55">
              <p className="font-bold text-ink">{user.organization.name}</p>
              <p className="mt-0.5">{BRAND.tagline}</p>
            </div>
          }
        />

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-4 z-40 mb-4 rounded-2xl border border-line bg-paper/90 backdrop-blur no-print">
            <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
              <div className="lg:hidden">
                <Logo className="h-8 w-8" />
              </div>
              <div className="min-w-0 flex-1">
                <SearchPalette />
              </div>
              <ThemeToggle />
              <NotificationBell initialUnread={unread} />
              <UserMenu name={user.name} role={user.role} email={user.email} />
            </div>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 px-1 pb-28 sm:px-2 lg:pb-6">
            {children}
          </main>
          <footer className="no-print hidden px-6 pb-4 text-center text-xs text-ink/35 lg:block">
            {BRAND.name} {BRAND.version} — {BRAND.tagline}
          </footer>
        </div>
      </div>

      <MobileNav role={user.role} />
      <AssistantWidget />
    </div>
  );
}
