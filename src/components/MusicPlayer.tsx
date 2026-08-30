"use client";

import { useEffect, useRef, useState } from "react";
import { Play, Pause, RotateCcw, Repeat, Volume2, VolumeX } from "lucide-react";

/**
 * Integrated practice player: play/pause, seek, loop, playback speed and A/B
 * loop for drilling specific sections. Accepts any audio URL; YouTube links
 * are rendered through the embed player instead.
 */
export function MusicPlayer({
  url,
  youtubeId,
  title,
}: {
  url?: string | null;
  youtubeId?: string | null;
  title: string;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [ab, setAb] = useState<{ a: number | null; b: number | null }>({ a: null, b: null });
  const [muted, setMuted] = useState(false);

  const isYouTube = !!youtubeId;

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    const onTime = () => {
      setTime(el.currentTime);
      if (ab.a !== null && ab.b !== null && el.currentTime >= ab.b) {
        el.currentTime = ab.a;
      }
    };
    const onMeta = () => setDuration(el.duration || 0);
    el.addEventListener("timeupdate", onTime);
    el.addEventListener("loadedmetadata", onMeta);
    return () => {
      el.removeEventListener("timeupdate", onTime);
      el.removeEventListener("loadedmetadata", onMeta);
    };
  }, [ab]);

  if (isYouTube) {
    return (
      <div className="card overflow-hidden">
        <div className="aspect-video w-full bg-ink">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube.com/embed/${youtubeId}`}
            title={title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          />
        </div>
      </div>
    );
  }

  if (!url) return null;

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (playing) {
      el.pause();
      setPlaying(false);
    } else {
      el.play().catch(() => {});
      setPlaying(true);
    }
  }

  function setSpeedCmd(v: number) {
    setSpeed(v);
    if (audioRef.current) audioRef.current.playbackRate = v;
  }

  return (
    <div className="card p-4">
      <audio ref={audioRef} src={url} loop={loop} muted={muted} preload="metadata" />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? "Pause" : "Play"}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-700 text-white transition hover:bg-brand-800"
        >
          {playing ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-ink">{title}</p>
          <input
            type="range"
            min={0}
            max={duration || 100}
            step={0.1}
            value={time}
            onChange={(e) => {
              const v = Number(e.target.value);
              setTime(v);
              if (audioRef.current) audioRef.current.currentTime = v;
            }}
            aria-label="Seek"
            className="mt-1.5 w-full accent-[rgb(var(--wf-brand-700))]"
          />
          <div className="mt-0.5 flex justify-between text-[11px] tabular-nums text-ink/45">
            <span>{fmtSec(time)}</span>
            <span>{fmtSec(duration)}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <select
          value={speed}
          onChange={(e) => setSpeedCmd(Number(e.target.value))}
          aria-label="Playback speed"
          className="rounded-lg border border-line bg-surface px-2 py-1.5 text-xs font-semibold text-ink/70"
        >
          {[0.5, 0.75, 1, 1.25, 1.5].map((s) => (
            <option key={s} value={s}>{s}×</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setLoop((l) => !l)}
          aria-pressed={loop}
          className={`chip border-line ${loop ? "bg-brand-700 text-white" : "bg-surface text-ink/60"}`}
        >
          <Repeat className="h-3.5 w-3.5" /> Loop
        </button>
        <button
          type="button"
          onClick={() => setAb((s) => ({ ...s, a: audioRef.current?.currentTime ?? 0 }))}
          className={`chip border-line ${ab.a !== null ? "bg-gold-500 text-white" : "bg-surface text-ink/60"}`}
        >
          Set A {ab.a !== null && `(${fmtSec(ab.a)})`}
        </button>
        <button
          type="button"
          onClick={() => setAb((s) => ({ ...s, b: audioRef.current?.currentTime ?? 0 }))}
          className={`chip border-line ${ab.b !== null ? "bg-gold-500 text-white" : "bg-surface text-ink/60"}`}
        >
          Set B {ab.b !== null && `(${fmtSec(ab.b)})`}
        </button>
        {(ab.a !== null || ab.b !== null) && (
          <button type="button" onClick={() => setAb({ a: null, b: null })} className="chip border-line bg-surface text-ink/60">
            <RotateCcw className="h-3.5 w-3.5" /> Clear A/B
          </button>
        )}
        <button
          type="button"
          onClick={() => setMuted((m) => !m)}
          aria-label={muted ? "Unmute" : "Mute"}
          className="rounded-lg p-1.5 text-ink/50 hover:bg-brand-50"
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );
}

function fmtSec(s: number): string {
  if (!isFinite(s)) return "0:00";
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function youTubeId(url?: string | null): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]{11})/);
  return m ? m[1] : null;
}
