import { KeyRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/SubmitButton";
import { changeOwnPassword } from "@/actions/settings";

export const metadata = { title: "Sign-in & security" };

export default async function SecurityPage({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<{ changed?: string }>;
}) {
  const searchParams = await searchParamsPromise;
  const user = await requireUser();

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-ink">Sign-in &amp; security</h1>
        <p className="mt-1 text-sm text-ink/50">{user.email}</p>
      </div>

      {searchParams.changed && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          Password updated ✓ Use your new password next time you sign in.
        </div>
      )}

      <Card className="p-6">
        <div className="mb-4 flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
            <KeyRound className="h-5 w-5" />
          </span>
          <div>
            <h2 className="font-bold text-ink">Change password</h2>
            <p className="text-xs text-ink/50">If you were given a temporary password, set your own here.</p>
          </div>
        </div>
        <form action={changeOwnPassword} className="space-y-4">
          <div>
            <label className="label" htmlFor="cur-pw">Current password</label>
            <input id="cur-pw" name="currentPassword" type="password" required autoComplete="current-password" className="input" />
          </div>
          <div>
            <label className="label" htmlFor="new-pw">New password</label>
            <input id="new-pw" name="newPassword" type="password" required minLength={8} autoComplete="new-password" className="input" placeholder="At least 8 characters" />
          </div>
          <div>
            <label className="label" htmlFor="conf-pw">Repeat new password</label>
            <input id="conf-pw" name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" className="input" />
          </div>
          <SubmitButton pendingText="Updating…" className="btn-primary w-full">Update password</SubmitButton>
        </form>
      </Card>
    </div>
  );
}
