import Link from "next/link";
import { Bell, Building2, CreditCard, ShieldCheck } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { canDo } from "@/lib/perms";
import { ROLE_LABEL } from "@/lib/constants";

export const metadata = { title: "Settings" };

const SECTIONS = [
  { href: "/settings/organization", title: "Organization", desc: "Name, campuses, venues, timezone & currency", icon: Building2 },
  { href: "/settings/permissions", title: "Roles & permissions", desc: "Roles, admin-granted rights & what people can add", icon: ShieldCheck },
  { href: "/settings/notifications", title: "Notifications", desc: "Email, SMS and push preferences", icon: Bell },
  { href: "/settings/billing", title: "Billing & payments", desc: "Plan, currencies & mobile money providers", icon: CreditCard },
];

export default async function SettingsPage() {
  const user = await requireUser();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 text-sm text-ink/50">
          {user.organization.name} · you are {ROLE_LABEL[user.role] || user.role}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="card flex items-center gap-4 p-5 transition hover:border-brand-300 hover:shadow-pop">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <s.icon className="h-5 w-5" />
            </span>
            <div>
              <p className="font-bold text-ink">{s.title}</p>
              <p className="text-sm text-ink/50">{s.desc}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
