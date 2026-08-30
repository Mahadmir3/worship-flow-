import { CheckCircle2, CreditCard, Smartphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CURRENCIES } from "@/lib/constants";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { togglePaymentProvider } from "@/actions/settings";

export const metadata = { title: "Billing & payments" };

export default async function BillingPage() {
  const user = await requireUser();
  const isOwner = user.role === "OWNER";

  const [org, providers] = await Promise.all([
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
    prisma.paymentProvider.findMany({ where: { organizationId: user.organizationId }, orderBy: { name: "asc" } }),
  ]);
  if (!org) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Billing & payments</h1>
        <p className="mt-1 text-sm text-ink/50">
          Future-ready payment architecture — providers are pluggable, credentials never live in the app
        </p>
      </div>

      <Card>
        <CardHeader title="Current plan" icon={<CreditCard className="h-4 w-4" />} />
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div>
            <p className="text-lg font-extrabold text-ink">
              Free during beta <Badge className="border-emerald-200 bg-emerald-50 text-emerald-700 ml-1">Active</Badge>
            </p>
            <p className="mt-1 text-sm text-ink/55">
              Unlimited services, teams and songs. Billing currency: <b>{org.currency}</b>
            </p>
          </div>
          <div className="text-right text-xs text-ink/45">
            <p>Change currency in Organization settings.</p>
            <p className="mt-0.5">Supported: {CURRENCIES.map((c) => c.code).join(" · ")}</p>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Payment providers"
          subtitle="Enable the providers your church uses — Mobile Money first-class"
          icon={<Smartphone className="h-4 w-4" />}
        />
        <ul className="divide-y divide-line/70">
          {providers.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-4">
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${p.enabled ? "bg-emerald-50 text-emerald-600" : "bg-paper text-ink/35"}`}>
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-bold text-ink">{p.name}</p>
                <p className="text-xs text-ink/50">{p.kind.replace(/_/g, " ").toLowerCase()} · credentials configured via environment secrets</p>
              </div>
              {isOwner ? (
                <form action={togglePaymentProvider}>
                  <input type="hidden" name="providerId" value={p.id} />
                  <button className={p.enabled ? "btn btn-sm border border-line bg-surface text-ink/60" : "btn-primary btn-sm"}>
                    {p.enabled ? "Disable" : "Enable"}
                  </button>
                </form>
              ) : (
                <Badge className={p.enabled ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-line bg-paper text-ink/50"}>
                  {p.enabled ? "enabled" : "disabled"}
                </Badge>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-4 text-xs leading-relaxed text-ink/45">
          The payment layer is provider-agnostic: a <code className="rounded bg-paper px-1">PaymentProvider</code> interface
          (see <code className="rounded bg-paper px-1">src/lib</code>) adapts MTN MoMo, Airtel Money and card
          gateways. No keys are hardcoded — secrets are injected per deployment.
        </p>
      </Card>
    </div>
  );
}
