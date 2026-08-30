"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search as SearchIcon } from "lucide-react";

type Result = {
  group: string;
  items: { id: string; label: string; sub?: string; href: string }[];
};

export function SearchPalette() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [active, setActive] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 30);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const json = await res.json();
        setResults(json.results || []);
        setActive(0);
      } catch {
        /* ignore */
      }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const flat = results.flatMap((r) => r.items);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 text-sm text-ink/40 transition hover:border-brand-300 hover:text-ink/60"
        aria-label="Search (Ctrl+K)"
      >
        <SearchIcon className="h-4 w-4" />
        <span className="flex-1 text-left">Search people, songs, services…</span>
        <kbd className="hidden rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-semibold text-ink/40 sm:block">
          Ctrl K
        </kbd>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-[95] flex items-start justify-center bg-ink/40 p-4 pt-[12vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Global search"
        className="w-full max-w-xl overflow-hidden rounded-2xl bg-surface shadow-pop"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="h-5 w-5 text-brand-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, flat.length - 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              }
              if (e.key === "Enter" && flat[active]) go(flat[active].href);
            }}
            placeholder="Search people, teams, services, songs, tasks…"
            className="w-full bg-transparent py-4 text-[15px] outline-none placeholder:text-ink/30"
            aria-label="Search query"
          />
        </div>
        <div className="max-h-[55vh] overflow-y-auto p-2">
          {!q && (
            <p className="px-3 py-8 text-center text-sm text-ink/40">
              Start typing to search across your whole church workspace.
            </p>
          )}
          {q && !flat.length && (
            <p className="px-3 py-8 text-center text-sm text-ink/40">No matches for “{q}”.</p>
          )}
          {results.map((group) => (
            <div key={group.group} className="mb-1">
              <p className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-ink/35">
                {group.group}
              </p>
              {group.items.map((item) => {
                const idx = flat.indexOf(item);
                return (
                  <button
                    key={item.href + item.id}
                    type="button"
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => go(item.href)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm ${
                      idx === active ? "bg-brand-50 text-brand-900" : "text-ink/80"
                    }`}
                  >
                    <span className="font-medium">{item.label}</span>
                    {item.sub && <span className="text-xs text-ink/40">{item.sub}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
