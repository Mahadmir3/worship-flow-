/** Dependency-free SVG charts — fast, accessible, themeable. */

export function BarChart({
  data,
  color = "rgb(50 58 140 / 0.9)",
  height = 180,
}: {
  data: { label: string; value: number }[];
  color?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-2" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${d.value}`).join(", ")}>
      {data.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-bold text-ink/50">{d.value}</span>
          <div
            className="w-full rounded-t-lg transition-all"
            style={{ height: `${Math.max((d.value / max) * (height - 44), 3)}px`, background: color, minHeight: 3 }}
          />
          <span className="w-full truncate text-center text-[10px] font-semibold text-ink/50" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Donut({
  value,
  label,
  sublabel,
  size = 140,
  color = "rgb(5 150 105 / 0.9)",
  track = "rgb(59 71 166 / 0.12)",
}: {
  value: number; // 0-100
  label?: string;
  sublabel?: string;
  size?: number;
  color?: string;
  track?: string;
}) {
  const r = size / 2 - 10;
  const c = 2 * Math.PI * r;
  const filled = (Math.min(Math.max(value, 0), 100) / 100) * c;
  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${label || ""} ${value}%`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={12} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={12}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c - filled}`}
        />
      </svg>
      <div className="-mt-[calc(50%+10px)] mb-[calc(25%)] text-center">
        <p className="text-2xl font-extrabold text-ink">{value}%</p>
        {label && <p className="text-xs font-semibold text-ink/55">{label}</p>}
      </div>
      {sublabel && <p className="mt-2 text-xs text-ink/45">{sublabel}</p>}
    </div>
  );
}

export function Sparkline({
  points,
  width = 560,
  height = 140,
  color = "#323A8C",
}: {
  points: number[];
  width?: number;
  height?: number;
  color?: string;
}) {
  const max = Math.max(...points, 1);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${i * step} ${height - (p / max) * (height - 16) - 8}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" role="img" aria-label="Trend">
      <path d={`${d} L ${width} ${height} L 0 ${height} Z`} fill={color} opacity={0.08} />
      <path d={d} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" />
    </svg>
  );
}

export function HBar({
  data,
  color = "#323A8C",
  max: maxOverride,
}: {
  data: { label: string; value: number; hint?: string }[];
  color?: string;
  max?: number;
}) {
  const max = maxOverride ?? Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="space-y-3">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
            <span className="min-w-0 truncate font-semibold text-ink/75">{d.label}</span>
            <span className="shrink-0 font-bold text-ink/55">{d.hint || d.value}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-brand-100/60">
            <div className="h-full rounded-full" style={{ width: `${(d.value / max) * 100}%`, background: color }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
