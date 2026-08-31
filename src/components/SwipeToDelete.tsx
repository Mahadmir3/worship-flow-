"use client";

import { useRef, useState, useTransition } from "react";
import { Trash2 } from "lucide-react";

/**
 * Mobile-native delete: swipe the row left (or long-press / hover on desktop)
 * to reveal a delete button. A confirm step guards against accidents.
 * The server action itself enforces permissions (admin/owner only).
 */
export function SwipeToDelete({
  action,
  id,
  confirmLabel,
  children,
  enabled = true,
}: {
  action: (fd: FormData) => Promise<void>;
  id: string;
  confirmLabel: string;
  children: React.ReactNode;
  enabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [dx, setDx] = useState(0);
  const [pending, start] = useTransition();
  const startX = useRef(0);
  const startY = useRef(0);
  const horizontal = useRef<boolean | null>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressClick = useRef(false); // long-press opened delete → swallow the follow-up click

  if (!enabled) return <>{children}</>;

  const close = () => {
    setOpen(false);
    setDx(0);
  };

  const doDelete = () => {
    if (!window.confirm(`Delete “${confirmLabel}”? This cannot be undone.`)) {
      close();
      return;
    }
    const fd = new FormData();
    fd.set("id", id);
    start(async () => {
      try {
        await action(fd);
      } catch (e) {
        alert(e instanceof Error ? e.message : "Could not delete");
      }
      close();
    });
  };

  return (
    <div className="relative overflow-hidden">
      {/* delete layer sits behind the row, revealed on swipe */}
      <div className={`absolute inset-y-0 right-0 flex items-center transition-opacity ${open || dx < -20 ? "opacity-100" : "opacity-0"}`}>
        <button
          type="button"
          onClick={doDelete}
          disabled={pending}
          className="flex h-full items-center gap-1.5 rounded-l-xl bg-rose-600 px-4 text-xs font-bold text-white"
          aria-label={`Delete ${confirmLabel}`}
        >
          {pending ? (
            <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          ) : (
            <Trash2 className="h-4 w-4" />
          )}
          {pending ? "Deleting…" : "Delete"}
        </button>
      </div>

      <div
        className="relative bg-surface transition-transform"
        style={{ transform: `translateX(${open ? -96 : dx}px)`, touchAction: "pan-y" }}
        onMouseDown={(e) => {
          // desktop: click-and-hold reveals delete (plain clicks still navigate)
          if (e.button !== 0) return;
          suppressClick.current = false;
          pressTimer.current = setTimeout(() => {
            setOpen(true);
            suppressClick.current = true; // releasing after the hold must NOT open the row
          }, 550);
        }}
        onClickCapture={(e) => {
          // capture phase: beat the row's own Link handler so a release after
          // a long-press does not also navigate into the row
          if (suppressClick.current) {
            e.preventDefault();
            e.stopPropagation();
            suppressClick.current = false;
          }
        }}
        onMouseUp={() => {
          if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
        }}
        onMouseLeave={() => {
          if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
        }}
        onTouchStart={(e) => {
          const t = e.touches[0];
          startX.current = t.clientX;
          startY.current = t.clientY;
          horizontal.current = null;
          suppressClick.current = false;
          pressTimer.current = setTimeout(() => {
            setOpen(true);
            suppressClick.current = true;
          }, 550); // long-press
        }}
        onTouchMove={(e) => {
          if (pressTimer.current) {
            clearTimeout(pressTimer.current);
            pressTimer.current = null;
          }
          const t = e.touches[0];
          const deltaX = t.clientX - startX.current;
          const deltaY = t.clientY - startY.current;
          if (horizontal.current === null && (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8)) {
            horizontal.current = Math.abs(deltaX) > Math.abs(deltaY);
          }
          if (horizontal.current) {
            const next = open ? Math.min(0, -96 + deltaX) : Math.max(-96, Math.min(0, deltaX));
            setDx(next);
          }
        }}
        onTouchEnd={() => {
          if (pressTimer.current) clearTimeout(pressTimer.current);
          if (horizontal.current && dx < -40) {
            setOpen(true);
            setDx(0);
          } else {
            close();
          }
        }}
        onContextMenu={(e) => {
          // long-press on mobile triggers context menu → reveal delete instead
          e.preventDefault();
          setOpen(true);
        }}
      >
        {children}
      </div>
    </div>
  );
}
