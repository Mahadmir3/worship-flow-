"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

/**
 * Button that asks "are you sure?" then runs a server action directly.
 * For destructive one-click operations that don't need a form.
 */
export function ConfirmButton({
  action,
  fields = {},
  confirm,
  children,
  className,
  pendingLabel = "Working…",
}: {
  action: (fd: FormData) => Promise<void>;
  fields?: Record<string, string>;
  confirm: string;
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className={className}
      onClick={() => {
        if (pending) return;
        if (!window.confirm(confirm)) return;
        const fd = new FormData();
        for (const [k, v] of Object.entries(fields)) fd.set(k, v);
        start(async () => {
          try {
            await action(fd);
            router.refresh(); // make sure the page shows the new state
          } catch (e) {
            const digest = (e as { digest?: string })?.digest || "";
            if (!String(digest).startsWith("NEXT_REDIRECT")) {
              alert(e instanceof Error ? e.message : "Something went wrong");
            }
          }
        });
      }}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}
