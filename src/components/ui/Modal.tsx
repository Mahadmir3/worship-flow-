"use client";

import React, { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const CloseModalCtx = React.createContext<() => void>(() => {});
export const useCloseModal = () => React.useContext(CloseModalCtx);

/**
 * Accessible modal: Esc to close, backdrop click, aria-modal, focus moved inside.
 * Children may be server-rendered content (forms etc.) passed from RSC pages.
 */
export function Modal({
  trigger,
  title,
  subtitle,
  children,
  wide,
}: {
  trigger: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  wide?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <button type="button" aria-haspopup="dialog" onClick={() => setOpen(true)} className="contents">
        {trigger}
      </button>
      {open && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`max-h-[92vh] w-full ${wide ? "sm:max-w-3xl" : "sm:max-w-lg"} overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-pop sm:rounded-3xl`}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-ink">{title}</h3>
                {subtitle && <p className="mt-0.5 text-sm text-ink/50">{subtitle}</p>}
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close dialog"
                className="rounded-lg p-1.5 text-ink/40 hover:bg-brand-50 hover:text-ink"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <CloseModalCtx.Provider value={close}>{children}</CloseModalCtx.Provider>
          </div>
        </div>
      )}
    </>
  );
}
