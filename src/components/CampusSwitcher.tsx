"use client";

import { setCampusFilter } from "@/actions/settings";
import { MapPin } from "lucide-react";

export function CampusSwitcher({ campuses }: { campuses: { id: string; name: string }[] }) {
  if (campuses.length <= 1) return null;
  return (
    <label className="flex items-center gap-2 rounded-xl bg-surface/10 px-3 py-2 text-xs font-semibold text-brand-100">
      <MapPin className="h-4 w-4 text-gold-300" aria-hidden />
      <span className="sr-only">Filter by campus</span>
      <select
        defaultValue=""
        onChange={(e) => setCampusFilter(e.target.value)}
        className="w-full bg-transparent text-white outline-none [&>option]:text-ink"
        aria-label="Filter by campus"
      >
        <option value="">All campuses</option>
        {campuses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </label>
  );
}
