"use client";

import { useFormStatus } from "react-dom";

/**
 * Submit button with instant pending feedback — shows a spinner + pending
 * text the moment it's clicked, so slow networks never feel like a dead click.
 * Must be rendered inside a <form>.
 */
export function SubmitButton({
  children,
  pendingText,
  className,
  disabled,
}: {
  children: React.ReactNode;
  pendingText?: string;
  className?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className={`${className || ""} ${pending ? "relative cursor-wait opacity-60" : ""}`}
      disabled={disabled || pending}
    >
      {pending ? (
        <span className="inline-flex items-center gap-1.5">
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
            <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </svg>
          {pendingText || "Working…"}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
