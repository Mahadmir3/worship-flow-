"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useCloseModal } from "@/components/ui/Modal";

export type ActionResult = {
  ok?: boolean;
  message?: string;
  tempEmail?: string;
  tempPassword?: string;
} | void;

/**
 * Form for use inside modals: submits the server action as a real form action
 * (so React + the Next router manage the request properly), locks the form
 * while pending (no double-taps), closes the modal on success — and if the
 * action returns temporary login credentials, shows them once before closing.
 */
export function ModalForm({
  action,
  children,
  className,
  successMessage,
}: {
  action: (fd: FormData) => Promise<ActionResult>;
  children: React.ReactNode;
  className?: string;
  successMessage?: string;
}) {
  const close = useCloseModal();
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creds, setCreds] = useState<{ email: string; password: string } | null>(null);

  if (creds) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-bold text-emerald-800">Login created ✓</p>
          <p className="mt-1 text-xs text-emerald-700">Share these with your volunteer — they&apos;ll be asked to choose a new password after logging in.</p>
          <div className="mt-3 space-y-1 rounded-lg bg-surface p-3 font-mono text-sm text-ink">
            <p><span className="text-ink/50">email: </span>{creds.email}</p>
            <p><span className="text-ink/50">password: </span>{creds.password}</p>
          </div>
        </div>
        <button type="button" className="btn-primary w-full" onClick={close}>
          Done
        </button>
      </div>
    );
  }

  async function submit(fd: FormData) {
    setError(null);
    setPending(true);
    try {
      const result = await action(fd);
      if (result && (result as { tempPassword?: string }).tempPassword) {
        setCreds({
          email: (result as { tempEmail?: string }).tempEmail || "",
          password: (result as { tempPassword?: string }).tempPassword,
        });
        return;
      }
      close();
    } catch (err) {
      // redirect() inside a server action surfaces as a digest error — that is
      // a SUCCESS: the router is already taking the user to the new page.
      const digest = (err as { digest?: string })?.digest || "";
      if (typeof digest === "string" && digest.startsWith("NEXT_REDIRECT")) {
        // success — the action asked to move on to another page.
        // digest format: NEXT_REDIRECT;<replace|push>;<path>;<status>;…
        const parts = digest.split(";");
        const target = parts[2];
        close();
        if (target && target.startsWith("/")) router.push(target);
        return;
      }
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className={className}>
      {/* fieldset disables every input+button inside while pending —
          instant feedback and impossible to double-submit */}
      <fieldset disabled={pending} className={className ? undefined : "space-y-0"}>
        {children}
        {pending && (
          <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-brand-700">
            <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
            {successMessage || "Saving…"}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>
        )}
      </fieldset>
    </form>
  );
}
