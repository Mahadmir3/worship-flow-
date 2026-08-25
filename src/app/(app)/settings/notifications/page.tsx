import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, CardHeader } from "@/components/ui/primitives";
import { setNotifPrefs } from "@/actions/settings";

export const metadata = { title: "Notification settings" };

export default async function NotifSettingsPage() {
  const user = await requireUser();
  const fullUser = await prisma.user.findUnique({ where: { id: user.id } });
  const prefs = fullUser?.notifPrefs
    ? JSON.parse(fullUser.notifPrefs)
    : { email: true, sms: false, push: true };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Notifications</h1>
        <p className="mt-1 text-sm text-ink/50">How you'll be notified about schedules and changes</p>
      </div>

      <Card>
        <CardHeader title="Delivery channels" subtitle="In-app notifications are always on" />
        <form action={setNotifPrefs} className="space-y-4 p-5">
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3.5">
            <span>
              <span className="block text-sm font-bold text-ink">Email notifications</span>
              <span className="block text-xs text-ink/50">Schedule requests, confirmations and weekly summaries</span>
            </span>
            <input type="checkbox" name="email" defaultChecked={prefs.email} className="h-5 w-5 rounded" />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3.5">
            <span>
              <span className="block text-sm font-bold text-ink">SMS notifications</span>
              <span className="block text-xs text-ink/50">Delivered via the pluggable SMS provider (e.g. Africa's Talking)</span>
            </span>
            <input type="checkbox" name="sms" defaultChecked={prefs.sms} className="h-5 w-5 rounded" />
          </label>
          <label className="flex items-center justify-between gap-4 rounded-2xl border border-line px-4 py-3.5">
            <span>
              <span className="block text-sm font-bold text-ink">Push notifications</span>
              <span className="block text-xs text-ink/50">Through the PWA when installed on a phone</span>
            </span>
            <input type="checkbox" name="push" defaultChecked={prefs.push} className="h-5 w-5 rounded" />
          </label>
          <button className="btn-primary">Save preferences</button>
        </form>
      </Card>
    </div>
  );
}
