import Link from "next/link";
import { AVATAR_COLORS } from "@/lib/constants";
import { initials } from "@/lib/format";

export function cn(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("card", className)}>{children}</div>;
}

export function CardHeader({
  title,
  subtitle,
  action,
  icon,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div className="flex items-center gap-3">
        {icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            {icon}
          </span>
        )}
        <div>
          <h2 className="text-sm font-bold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink/50">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

export function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <span className={cn("chip", className || "border-line bg-slate-50 text-slate-600")}>{children}</span>;
}

export function Avatar({
  name,
  size = 36,
  color,
}: {
  name: string;
  size?: number;
  color?: string;
}) {
  const idx =
    name.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % AVATAR_COLORS.length;
  const bg = color || AVATAR_COLORS[idx];
  return (
    <span
      aria-hidden
      className="inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.36 }}
    >
      {initials(name)}
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: React.ReactNode;
  title: string;
  hint?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-300">
        {icon || <span className="text-2xl">🎵</span>}
      </div>
      <div>
        <p className="font-semibold text-ink">{title}</p>
        {hint && <p className="mx-auto mt-1 max-w-sm text-sm text-ink/50">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-xl bg-brand-100/70", className)} />;
}

export function SectionTitle({
  children,
  action,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="text-base font-bold tracking-tight text-ink">{children}</h2>
      {action}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  icon,
  tone = "brand",
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon?: React.ReactNode;
  tone?: "brand" | "gold" | "green" | "red" | "cyan";
}) {
  const tones: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    gold: "bg-gold-100 text-gold-700",
    green: "bg-emerald-50 text-emerald-600",
    red: "bg-rose-50 text-rose-600",
    cyan: "bg-cyan-50 text-cyan-700",
  };
  return (
    <div className="card flex items-center gap-4 p-4">
      {icon && (
        <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tones[tone])}>
          {icon}
        </span>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink/45">{label}</p>
        <p className="truncate text-xl font-bold text-ink">{value}</p>
        {sub && <p className="text-xs text-ink/50">{sub}</p>}
      </div>
    </div>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
  className,
}: {
  href: string;
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "gold";
  className?: string;
}) {
  const cls =
    variant === "primary" ? "btn-primary" : variant === "gold" ? "btn-gold" : "btn-secondary";
  return (
    <Link href={href} className={cn(cls, className)}>
      {children}
    </Link>
  );
}
