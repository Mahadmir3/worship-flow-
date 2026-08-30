"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronsLeft, ChevronsRight } from "lucide-react";

export type SidebarSection = {
  label: string;
  items: { href: string; label: string; icon: React.ReactNode; count?: number }[];
};

/**
 * Neumorphic collapsible sidebar (approved design). Active item = red pill.
 * Collapse state persists per browser. Sections fold their labels away.
 */
export function Sidebar({
  sections,
  brandName,
  orgName,
  footer,
}: {
  sections: SidebarSection[];
  brandName: string;
  orgName: string;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem("wf-sidebar") === "collapsed");
    } catch {}
  }, []);

  const toggle = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem("wf-sidebar", !c ? "collapsed" : "open");
      } catch {}
      return !c;
    });
  };

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <aside
      className={`wf-sidebar sticky top-4 hidden max-h-[calc(100vh-2rem)] shrink-0 lg:flex lg:flex-col ${collapsed ? "wf-collapsed" : ""}`}
      aria-label="Main navigation"
    >
      {/* Brand */}
      <div className="mb-4 flex items-center gap-3 px-1">
        <button
          type="button"
          onClick={toggle}
          className="wf-brand-row flex min-w-0 flex-1 items-center gap-3 text-left"
          title={collapsed ? "Expand menu" : undefined}
          aria-label={collapsed ? "Expand menu" : undefined}
        >
          <span className="wf-brand-tile flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-accent text-[17px] font-extrabold text-white">
            {brandName.slice(0, 1)}
          </span>
          <span className={`min-w-0 overflow-hidden whitespace-nowrap ${collapsed ? "w-0 opacity-0" : "max-w-[160px] opacity-100"} transition-all duration-300`}>
            <span className="block text-[15px] font-bold leading-tight text-ink">{brandName}</span>
            <span className="block text-[10px] font-medium uppercase tracking-wider text-ink/45">{orgName}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={toggle}
          className={`wf-collapse-btn flex h-8 w-8 shrink-0 items-center justify-center ${collapsed ? "hidden" : "flex"}`}
          aria-label="Collapse menu"
          title="Collapse menu"
        >
          <ChevronsLeft className="h-[18px] w-[18px]" />
        </button>
        {collapsed && (
          <button
            type="button"
            onClick={toggle}
            className="wf-collapse-btn flex h-8 w-8 shrink-0 items-center justify-center"
            aria-label="Expand menu"
            title="Expand menu"
          >
            <ChevronsRight className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <nav className="flex-1" aria-label="Sections">
        {sections.map((section) => (
          <div key={section.label}>
            <p className="wf-label">{section.label}</p>
            {section.items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive(item.href) ? "page" : undefined}
                className={`wf-nav-item ${isActive(item.href) ? "wf-active" : ""}`}
              >
                {item.icon}
                <span className="wf-text">{item.label}</span>
                {item.count ? <span className="wf-count">{item.count > 99 ? "99+" : item.count}</span> : null}
              </Link>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer slot (campus switcher etc.) */}
      {footer ? (
        <div className={`mt-3 overflow-hidden whitespace-nowrap ${collapsed ? "hidden" : "block"}`}>{footer}</div>
      ) : null}
    </aside>
  );
}
