"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Megaphone, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { fmtTime } from "@/lib/format";
import { setLiveAnnouncement, setLiveCursor } from "@/actions/services";

type LiveItem = { id: string; title: string; type: string; startTime: string; durationSec: number; notes: string | null; personName: string | null };

export function LiveView({
  serviceId,
  serviceTitle,
  items,
  canControl,
  initialCursor,
  initialAnnouncement,
}: {
  serviceId: string;
  serviceTitle: string;
  items: LiveItem[];
  canControl: boolean;
  initialCursor: string | null;
  initialAnnouncement: string | null;
}) {
  const [cursor, setCursor] = useState<string | null>(initialCursor);
  const [announcement, setAnnouncement] = useState<string | null>(initialAnnouncement);
  const [running, setRunning] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const [draftAnnouncement, setDraftAnnouncement] = useState("");
  const [showControls, setShowControls] = useState(false);
  const startedRef = useRef(Date.now() - 0);

  // Poll live state every 4s (multi-device sync without websockets in demo mode)
  useEffect(() => {
    const iv = setInterval(async () => {
      try {
        const res = await fetch(`/api/live?serviceId=${serviceId}`, { cache: "no-store" });
        const json = await res.json();
        if (typeof json.currentItemId !== "undefined") setCursor(json.currentItemId);
        if (typeof json.announcement !== "undefined") setAnnouncement(json.announcement || null);
      } catch {}
    }, 4000);
    return () => clearInterval(iv);
  }, [serviceId]);

  // Countdown ticker
  useEffect(() => {
    const iv = setInterval(() => {
      if (running) setElapsed((e) => e + 1);
    }, 1000);
    return () => clearInterval(iv);
  }, [running]);

  const idx = items.findIndex((i) => i.id === cursor);
  const current = idx >= 0 ? items[idx] : null;
  const next = idx >= 0 && idx + 1 < items.length ? items[idx + 1] : null;
  const later = idx >= 0 ? items.slice(idx + 2, idx + 5) : items.slice(1, 4);

  const totalSec = items.reduce((n, i) => n + i.durationSec, 0);
  const doneSec = items.slice(0, Math.max(idx, 0)).reduce((n, i) => n + i.durationSec, 0);
  const progress = totalSec ? Math.min(100, Math.round((doneSec / totalSec) * 100)) : 0;

  const goTo = useCallback(
    (i: number) => {
      const item = items[i];
      if (!item) return;
      setCursor(item.id);
      startedRef.current = Date.now();
      setElapsed(0);
      if (canControl) setLiveCursor(serviceId, item.id);
    },
    [items, canControl, serviceId]
  );

  // Keyboard control for operators
  useEffect(() => {
    if (!canControl) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goTo(Math.max(idx, 0) + 1 <= items.length - 1 ? Math.max(idx + 1, 0) : idx);
      if (e.key === "ArrowLeft") goTo(Math.max(idx - 1, 0));
      if (e.key === " ") {
        e.preventDefault();
        setRunning((r) => !r);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [canControl, idx, items.length, goTo]);

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-brand-950 text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
        <a href={`/services/${serviceId}`} className="inline-flex items-center gap-2 rounded-xl bg-surface/10 px-3 py-2 text-sm font-semibold hover:bg-surface/20">
          <ArrowLeft className="h-4 w-4" /> Exit live mode
        </a>
        <div className="text-center">
          <p className="text-sm font-extrabold uppercase tracking-[0.25em] text-gold-300">Live — {serviceTitle}</p>
          <p className="text-xs text-brand-200/60">{items.length} items · {progress}% complete</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`chip ${running ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300" : "border-white/20 bg-surface/10 text-brand-100"}`}>
            <span className={`h-2 w-2 rounded-full ${running ? "animate-pulse bg-emerald-400" : "bg-brand-300"}`} />
            {running ? "Running" : "Paused"}
          </span>
          {canControl && (
            <button type="button" onClick={() => setShowControls((s) => !s)} className="rounded-xl bg-surface/10 px-3 py-2 text-sm font-semibold hover:bg-surface/20">
              {showControls ? "Hide" : "Show"} controls
            </button>
          )}
        </div>
      </div>

      {/* Announcement banner */}
      {announcement && (
        <div role="alert" className="bg-gold-500 px-6 py-3 text-center text-lg font-extrabold text-brand-950">
          📢 {announcement}
        </div>
      )}

      {/* Current / next */}
      <div className="flex flex-1 flex-col items-center justify-center gap-8 px-6 text-center">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-gold-300">Current</p>
          <h1 className="mt-3 text-5xl font-extrabold leading-tight tracking-tight sm:text-7xl">
            {current ? current.title : items[0]?.title || "Service start"}
          </h1>
          {current && (
            <p className="mt-4 text-lg text-brand-100/80">
              {fmtTime(current.startTime)} · {Math.round(current.durationSec / 60)} min
              {current.personName ? ` · led by ${current.personName}` : ""}
            </p>
          )}
          {current?.notes && (
            <p className="mx-auto mt-4 max-w-xl rounded-2xl bg-surface/10 px-5 py-3 text-sm text-brand-100/90">{current.notes}</p>
          )}
        </div>

        <div className="grid w-full max-w-3xl gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-surface/5 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-200/70">Next</p>
            <p className="mt-2 text-xl font-extrabold">{next ? next.title : "— end of service —"}</p>
            {next && <p className="text-xs text-brand-200/70">{fmtTime(next.startTime)}</p>}
          </div>
          <div className="rounded-2xl border border-white/10 bg-surface/5 p-5 text-left">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-200/70">Later</p>
            <ul className="mt-2 space-y-1 text-sm text-brand-100/85">
              {later.length ? later.map((i) => (
                <li key={i.id} className="truncate">{fmtTime(i.startTime)} — {i.title}</li>
              )) : (
                <li>—</li>
              )}
            </ul>
          </div>
        </div>

        {/* Countdown */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setRunning((r) => !r)}
            className="flex h-14 w-14 items-center justify-center rounded-full bg-gold-500 hover:bg-gold-600"
            aria-label={running ? "Pause timer" : "Resume timer"}
          >
            {running ? <Pause className="h-6 w-6" /> : <Play className="h-6 w-6" />}
          </button>
          <span className="font-mono text-4xl font-bold tabular-nums" aria-label="Time in current item">
            {fmtElapsed(elapsed)}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-6 pb-4">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface/10" role="progressbar" aria-valuenow={progress} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full rounded-full bg-gradient-to-r from-gold-500 to-gold-300 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* Controller console */}
      {canControl && showControls && (
        <div className="border-t border-white/10 bg-brand-900/95 px-6 py-4">
          <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-3">
            <button type="button" onClick={() => goTo(Math.max(idx - 1, 0))} className="btn bg-surface/10 hover:bg-surface/20" aria-label="Previous item">
              <SkipBack className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => goTo(Math.max(idx + 1, 0))} disabled={idx >= items.length - 1} className="btn bg-gold-500 hover:bg-gold-600" aria-label="Next item">
              <SkipForward className="h-5 w-5" /> Next item
            </button>
            <div className="flex min-w-[16rem] flex-1 items-center gap-2">
              <Megaphone className="h-5 w-5 shrink-0 text-gold-300" />
              <input
                value={draftAnnouncement}
                onChange={(e) => setDraftAnnouncement(e.target.value)}
                placeholder="Emergency announcement…"
                aria-label="Emergency announcement"
                className="w-full rounded-xl border border-white/15 bg-surface/10 px-3.5 py-2 text-sm text-white placeholder:text-brand-200/50 outline-none focus:border-gold-300"
              />
              <button
                type="button"
                className="btn bg-surface/10 hover:bg-surface/20"
                onClick={async () => {
                  await setLiveAnnouncement(serviceId, draftAnnouncement);
                  setAnnouncement(draftAnnouncement || null);
                  setDraftAnnouncement("");
                }}
              >
                Show
              </button>
              {announcement && (
                <button
                  type="button"
                  className="btn bg-rose-500/80 hover:bg-rose-500"
                  onClick={async () => {
                    await setLiveAnnouncement(serviceId, "");
                    setAnnouncement(null);
                  }}
                >
                  Clear
                </button>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[11px] text-brand-200/50">
            Keyboard: ← / → to move, Space to pause the timer. Viewers' screens update automatically.
          </p>
        </div>
      )}
    </div>
  );
}

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
