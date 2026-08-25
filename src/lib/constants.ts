/** Roles, statuses, item types, currencies & timezones — single source of truth. */

export const ROLES = [
  { id: "OWNER", label: "Owner", description: "The pastor who paid — owns the church account, billing and everything." },
  { id: "ADMIN", label: "Administrator", description: "Runs the whole account: creates events, teams, people & songs, grants rights." },
  { id: "LEADER", label: "Department Leader", description: "Leads their own department — its members and rehearsals. Worship & choir leaders also manage songs." },
  { id: "VOLUNTEER", label: "Volunteer", description: "Sees their own schedule and teams until an admin gives more rights." },
] as const;

export type RoleId = (typeof ROLES)[number]["id"];

export const ROLE_LABEL: Record<string, string> = Object.fromEntries(
  ROLES.map((r) => [r.id, r.label])
);

/** Permission capabilities. `can()` is the single authorization gate. */
export const CAPABILITIES = [
  "manage_org",
  "manage_billing",
  "manage_services",
  "manage_songs",
  "manage_teams",
  "manage_people",
  "manage_rehearsals",
  "manage_production",
  "manage_tasks",
  "schedule",
  "view_analytics",
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const MATRIX: Record<string, Capability[]> = {
  OWNER: [...CAPABILITIES],
  ADMIN: [...CAPABILITIES].filter((c) => c !== "manage_billing"),
  WORSHIP_PASTOR: [
    "manage_services",
    "manage_songs",
    "manage_teams",
    "manage_people",
    "manage_rehearsals",
    "schedule",
    "view_analytics",
    "manage_tasks",
  ],
  MUSIC_DIRECTOR: ["manage_songs", "manage_rehearsals", "schedule"],
  TEAM_LEADER: ["manage_teams", "schedule", "manage_tasks"],
  PRODUCTION: ["manage_production", "schedule", "manage_tasks"],
  PASTOR: [],
  MUSICIAN: [],
  VOLUNTEER: [],
};

export function can(role: string, capability: Capability): boolean {
  return (MATRIX[role] || []).includes(capability);
}

/** Roles that can edit a service plan / run live mode. */
export function canControlService(role: string): boolean {
  return ["OWNER", "ADMIN", "WORSHIP_PASTOR", "TEAM_LEADER"].includes(role);
}

// ── Service item types ──
export const ITEM_TYPES: Record<string, { label: string; color: string }> = {
  WELCOME: { label: "Welcome", color: "#2563EB" },
  PRAYER: { label: "Prayer", color: "#D97706" },
  SONG: { label: "Song", color: "#4F46E5" },
  WORSHIP_SET: { label: "Worship Set", color: "#6366F1" },
  OFFERING: { label: "Offering", color: "#059669" },
  ANNOUNCEMENT: { label: "Announcement", color: "#0891B2" },
  SERMON: { label: "Sermon", color: "#B45309" },
  RESPONSE: { label: "Response", color: "#7C3AED" },
  COMMUNION: { label: "Communion", color: "#9333EA" },
  TESTIMONY: { label: "Testimony", color: "#DB2777" },
  MEDIA: { label: "Media / Video", color: "#0D9488" },
  DRAMA: { label: "Drama", color: "#E11D48" },
  CLOSING: { label: "Closing", color: "#64748B" },
  OTHER: { label: "Other", color: "#94A3B8" },
};

export const ASSIGNMENT_STATUS: Record<string, { label: string; className: string }> = {
  OPEN: { label: "Open", className: "bg-slate-100 text-slate-600 border-slate-200" },
  PENDING: { label: "Pending", className: "bg-amber-50 text-amber-700 border-amber-200" },
  ACCEPTED: { label: "Accepted", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  CONFIRMED: { label: "Confirmed", className: "bg-emerald-600 text-white border-emerald-600" },
  DECLINED: { label: "Declined", className: "bg-rose-50 text-rose-700 border-rose-200" },
  REPLACEMENT_REQUESTED: { label: "Replacement requested", className: "bg-orange-50 text-orange-700 border-orange-200" },
};

export const SERVICE_STATUS: Record<string, { label: string; className: string }> = {
  PLANNING: { label: "Planning", className: "bg-amber-50 text-amber-700 border-amber-200" },
  READY: { label: "Ready", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  COMPLETED: { label: "Completed", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

export const REHEARSAL_SONG_STATUS = [
  { id: "NOT_STARTED", label: "Not started" },
  { id: "LEARNING", label: "Learning" },
  { id: "REHEARSED", label: "Rehearsed" },
  { id: "READY", label: "Ready" },
];

export const TASK_STATUS: Record<string, { label: string; className: string }> = {
  TODO: { label: "To do", className: "bg-slate-100 text-slate-700 border-slate-200" },
  IN_PROGRESS: { label: "In progress", className: "bg-amber-50 text-amber-700 border-amber-200" },
  DONE: { label: "Done", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
};

export const TASK_PRIORITY: Record<string, { label: string; className: string }> = {
  LOW: { label: "Low", className: "bg-slate-100 text-slate-500 border-slate-200" },
  MEDIUM: { label: "Medium", className: "bg-sky-50 text-sky-700 border-sky-200" },
  HIGH: { label: "High", className: "bg-rose-50 text-rose-700 border-rose-200" },
};

export const TEAM_CATEGORY: Record<string, { label: string; color: string }> = {
  WORSHIP: { label: "Worship", color: "#4F46E5" },
  CHOIR: { label: "Choir", color: "#7C3AED" },
  PRODUCTION: { label: "Production", color: "#0891B2" },
  MINISTRY: { label: "Ministry", color: "#059669" },
  CUSTOM: { label: "Custom", color: "#D97706" },
};

export const MEDIA_FOLDERS = [
  { id: "songs", label: "Songs" },
  { id: "charts", label: "Chord Charts" },
  { id: "sermons", label: "Sermons" },
  { id: "plans", label: "Service Plans" },
  { id: "rehearsals", label: "Rehearsals" },
  { id: "graphics", label: "Graphics" },
  { id: "videos", label: "Videos" },
  { id: "production", label: "Production" },
];

/** African + global currencies supported by the billing/settings layer. */
export const CURRENCIES = [
  { code: "UGX", label: "Ugandan Shilling (UGX)" },
  { code: "KES", label: "Kenyan Shilling (KES)" },
  { code: "RWF", label: "Rwandan Franc (RWF)" },
  { code: "TZS", label: "Tanzanian Shilling (TZS)" },
  { code: "ZMW", label: "Zambian Kwacha (ZMW)" },
  { code: "NGN", label: "Nigerian Naira (NGN)" },
  { code: "ZAR", label: "South African Rand (ZAR)" },
  { code: "CDF", label: "Congolese Franc (CDF)" },
  { code: "USD", label: "US Dollar (USD)" },
];

export const TIMEZONES = [
  "Africa/Kampala",
  "Africa/Nairobi",
  "Africa/Kigali",
  "Africa/Dar_es_Salaam",
  "Africa/Lusaka",
  "Africa/Lagos",
  "Africa/Johannesburg",
  "Africa/Kinshasa",
  "Europe/London",
  "America/New_York",
  "UTC",
];

/** Payment provider registry for the future-ready billing architecture. */
export const PAYMENT_PROVIDER_KINDS = [
  { kind: "MTN_MOMO", label: "MTN Mobile Money" },
  { kind: "AIRTEL_MONEY", label: "Airtel Money" },
  { kind: "MOBILE_MONEY_GENERIC", label: "Mobile Money (generic)" },
  { kind: "CARD", label: "Card payments" },
];

export const AVATAR_COLORS = [
  "#4F46E5", "#0891B2", "#059669", "#D97706", "#DB2777",
  "#7C3AED", "#2563EB", "#DC2626", "#0D9488", "#B45309",
];
