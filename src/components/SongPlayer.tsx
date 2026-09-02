"use client";

import { useState } from "react";
import { ExternalLink, Play, Youtube } from "lucide-react";

/**
 * Plays the song's YouTube video INSIDE the page (embedded, no leaving the
 * site). If we only have a search link, the first play resolves the actual
 * video automatically and caches it on the song.
 */
export function SongPlayer({
  songId,
  videoId,
  fallbackUrl,
}: {
  songId: string;
  videoId: string | null;
  fallbackUrl: string | null;
}) {
  const [id, setId] = useState<string | null>(videoId);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);

  if (id) {
    return (
      <div className="w-full">
        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-ink shadow-pop">
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?rel=0`}
            title="Song video"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
          />
        </div>
        <a
          href={`https://www.youtube.com/watch?v=${id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-ink/40 hover:text-brand-700"
        >
          <ExternalLink className="h-3 w-3" /> open on YouTube instead
        </a>
      </div>
    );
  }

  if (failed) {
    return fallbackUrl ? (
      <a
        href={fallbackUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-rose-700"
      >
        <Youtube className="h-4 w-4" /> Find it on YouTube
      </a>
    ) : null;
  }

  return (
    <button
      type="button"
      disabled={loading}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/youtube/resolve?songId=${songId}`);
          const json = await res.json();
          if (json.videoId) setId(json.videoId);
          else setFailed(true);
        } catch {
          setFailed(true);
        } finally {
          setLoading(false);
        }
      }}
      className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-rose-700 disabled:opacity-60"
    >
      {loading ? (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" className="opacity-25" />
          <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ) : (
        <Play className="h-4 w-4" />
      )}
      {loading ? "Finding the video…" : "Play in WorshipFlow"}
    </button>
  );
}
