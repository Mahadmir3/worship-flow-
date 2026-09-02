/** Date/time/format helpers. All planning dates are church-local YYYY-MM-DD strings. */

export function todayIn(tz = "Africa/Kampala"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date()); // YYYY-MM-DD
}

export function nowTimeIn(tz = "Africa/Kampala"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date()); // HH:MM
}

export function fmtDate(dateStr: string, opts: Intl.DateTimeFormatOptions = {}): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return new Intl.DateTimeFormat("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
    ...opts,
  }).format(d);
}

export function fmtDateShort(dateStr: string): string {
  return fmtDate(dateStr, { weekday: undefined, year: undefined });
}

export function fmtTime(hhmm: string): string {
  const [h, m] = (hhmm || "00:00").split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function addMinutes(hhmm: string, minutes: number): string {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + minutes;
  total = ((total % 1440) + 1440) % 1440;
  const nh = Math.floor(total / 60);
  const nm = total % 60;
  return `${String(nh).padStart(2, "0")}:${String(nm).padStart(2, "0")}`;
}

export function durationLabel(sec: number): string {
  const m = Math.round(sec / 60);
  return `${m} min`;
}

export function daysUntil(dateStr: string, from = todayIn()): number {
  const a = new Date(dateStr + "T12:00:00Z").getTime();
  const b = new Date(from + "T12:00:00Z").getTime();
  return Math.round((a - b) / 864e5);
}

export function relativeDay(dateStr: string, tz = "Africa/Kampala"): string {
  const diff = daysUntil(dateStr, todayIn(tz));
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  if (diff < 0) return `${-diff} days ago`;
  return fmtDate(dateStr, { weekday: "short", day: "numeric", month: "short" });
}

export function fmtDurationRange(start: string, end: string): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

export function currency(amount: number, code: string): string {
  try {
    return new Intl.NumberFormat("en-UG", {
      style: "currency",
      currency: code,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${code} ${amount.toLocaleString()}`;
  }
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export function monthKey(dateStr: string): string {
  return dateStr.slice(0, 7);
}

export function weekdayOf(dateStr: string): number {
  return new Date(dateStr + "T12:00:00Z").getUTCDay();
}
