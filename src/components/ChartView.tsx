"use client";

import { useMemo, useState } from "react";
import { Minus, Plus } from "lucide-react";
import { transposeChart, KEYS, prettyKey } from "@/lib/music";

export function ChartView({ chart, sourceKey }: { chart: string; sourceKey: string | null }) {
  const [targetKey, setTargetKey] = useState(sourceKey || "C");
  const steps = useMemo(() => {
    if (!sourceKey) return 0;
    const from = KEYS.indexOf(sourceKey);
    const to = KEYS.indexOf(targetKey);
    if (from < 0 || to < 0) return 0;
    return ((to - from) % 12 + 12) % 12;
  }, [sourceKey, targetKey]);

  const transposed = useMemo(() => transposeChart(chart, steps), [chart, steps]);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-ink/45">Key</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Transpose down"
            className="rounded-lg border border-line bg-surface p-1.5 text-ink/60 hover:border-brand-400"
            onClick={() => {
              const idx = KEYS.indexOf(targetKey);
              setTargetKey(KEYS[(idx + 11) % 12]);
            }}
          >
            <Minus className="h-3.5 w-3.5" />
          </button>
          <select
            value={targetKey}
            onChange={(e) => setTargetKey(e.target.value)}
            aria-label="Select key"
            className="rounded-lg border border-line bg-surface px-2.5 py-1.5 text-sm font-bold text-ink outline-none focus:border-brand-400"
          >
            {KEYS.map((k) => (
              <option key={k} value={k}>{prettyKey(k)}</option>
            ))}
          </select>
          <button
            type="button"
            aria-label="Transpose up"
            className="rounded-lg border border-line bg-surface p-1.5 text-ink/60 hover:border-brand-400"
            onClick={() => {
              const idx = KEYS.indexOf(targetKey);
              setTargetKey(KEYS[(idx + 1) % 12]);
            }}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
        {sourceKey && targetKey !== sourceKey && (
          <span className="chip border-gold-200 bg-gold-50 text-gold-700">
            transposed from {prettyKey(sourceKey)}
          </span>
        )}
      </div>
      <pre className="chart-pre rounded-2xl border border-line bg-paper/60 p-5 text-ink/85">{transposed}</pre>
    </div>
  );
}
