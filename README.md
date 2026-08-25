# WorshipFlow

**Plan the service. Equip the team. Strengthen the ministry.**

A production-minded, mobile-first church service & worship management platform — service planning, drag-and-drop order of service, smart volunteer scheduling, song library with transposable chord charts, rehearsals, communication, analytics, live mode and an AI assistant. Designed with African churches in mind (UGX + 8 more currencies, WhatsApp sharing, low-bandwidth mode, Mobile Money-ready billing architecture, Africa/Kampala-first timezones).

> Demo tenant: **Grace Community Church, Kampala** — one-click personas on the login page (password `grace2026`).

---

## Quick start

```bash
npm install
npx prisma db push        # create the SQLite database (Postgres-ready schema)
node prisma/seed.mjs      # load the Grace Community demo data
npm run dev               # http://localhost:3000
```

Demo accounts (all use password `grace2026`):

| Persona | Email | Role |
|---|---|---|
| David Mukisa | `david@gracecommunity.ug` | Owner / Worship Pastor |
| Mary Achieng | `mary@gracecommunity.ug` | Administrator |
| Sarah Nakato | `sarah@gracecommunity.ug` | Volunteer (Lead Vocal) |
| James Okello | `james@gracecommunity.ug` | Musician (Guitar) |
| Grace Atim | `grace@gracecommunity.ug` | Production Lead |
| Robert Kigongo | `robert@gracecommunity.ug` | Senior Pastor |

---

## Tech stack

- **Next.js 14 (App Router) + TypeScript** — server components + server actions (no client-side API layer to maintain)
- **Tailwind CSS** — original design system driven by CSS variables (rebrand in one file)
- **Prisma + SQLite** — the schema is PostgreSQL-compatible: change `provider` to `postgresql` and set `DATABASE_URL` to migrate. All enums are strings validated in `src/lib/constants.ts` so both engines work.
- **Custom auth** — scrypt password hashing, httpOnly session cookies, org-scoped queries
- **@dnd-kit** — accessible drag-and-drop order of service (touch + keyboard fallback buttons)
- **PWA** — manifest + service worker (network-first, offline fallback; registered in production builds)

## Project map

```
prisma/schema.prisma      24-table relational schema (orgs → campuses → services → items…)
prisma/seed.mjs           Demo data + a synthesized practice-track WAV
src/lib/
  auth.ts                 sessions, hashing, requireUser()
  permissions.ts→constants.ts  roles, capabilities, can(), statuses
  scheduling.ts           Smart scheduling engine (availability, load, conflicts, burnout)
  ai.ts                   WorshipFlow Assistant (local intent engine + OpenAI-compatible LLM provider interface)
  music.ts                chord-chart transposition engine
  notify.ts               in-app notifications + email/SMS/push provider hooks
  audit.ts                audit log
  format.ts               dates/times in the church's own timezone
src/actions/              server actions (services, scheduling, songs, teams, rehearsals, tasks, messages, media, settings)
src/app/(app)/            authenticated app: dashboard, services (+/plan,/live), calendar, schedule,
                          teams, people, songs, rehearsals, media, messages, tasks, analytics,
                          settings (organization/permissions/notifications/billing), onboarding
src/components/           AppShell, ServicePlanEditor (DnD), LiveView, MusicPlayer (A/B loop, speed),
                          ChartView (transpose), SearchPalette (Ctrl/Cmd+K), AssistantWidget, charts (SVG)
```

## What's fully functional

- Login / signup / roles / permissions / org isolation (every query is scoped by `organizationId`)
- Service CRUD, templates, **drag-and-drop plan builder** with auto-computed times & visual timeline
- **Auto Schedule** + ranked replacement suggestions with real warnings (double-booking, unavailability, over-serving, missing drummers)
- Accept / decline / request-replacement volunteer flow with notifications back to leaders
- Availability (blockouts + recurring weekly) & preferred serving frequency (burnout guard)
- Song library, multiple arrangements per song, **transposable chord charts**, lyrics, media links, usage history
- Rehearsals: RSVP, song readiness cycle (Not started → Learning → Rehearsed → Ready), checklist
- **Live mode**: current/next/later, countdown, progress bar, controller console (keyboard), emergency announcements — synced across viewers via polling
- Channels & pinned messages, service comments, task board, analytics (SVG charts incl. burnout watchlist)
- Global search (Ctrl/Cmd+K), notification inbox with polling
- Multi-campus filtering, WhatsApp share links, print-friendly service orders
- Onboarding wizard for new churches

## Provider abstraction points (by design)

| Concern | Interface | Swap in |
|---|---|---|
| AI | `getLLMProvider()` in `src/lib/ai.ts` (env: `WORSHIPFLOW_LLM_BASE_URL/KEY/MODEL`) | any OpenAI-compatible API |
| Payments | `PaymentProvider` table + `src/actions/settings.ts` | MTN MoMo, Airtel Money, cards — keys via env, never hardcoded |
| Notifications | `notify()` channels in `src/lib/notify.ts` | SMTP, Africa's Talking, WhatsApp Business API, FCM |
| File storage | `saveFile()` in `src/actions/media.ts` | S3 / R2 / Backblaze |

## Rebranding (name, logo, colors)

1. `src/lib/brand.ts` — product name & tagline
2. `public/icon.svg`, `public/icon-512.png`, `public/manifest.webmanifest` — icons/PWA identity
3. `src/app/globals.css` — the `--wf-brand-*` and `--wf-gold-*` CSS variables (Tailwind reads them everywhere)

## Production deployment

1. Set `provider = "postgresql"` in `prisma/schema.prisma`, point `DATABASE_URL` at managed Postgres (Neon/Supabase/RDS), run `prisma migrate deploy`.
2. `npm run build && npm start` (Vercel: `npm run build` is detected automatically; add the service worker & manifest at the domain root — already in `/public`).
3. Set env vars for any providers you enable (LLM, SMS, storage, payments). Secrets never live in the repo.
4. Security already in place: scrypt hashing, rate-limited login, same-origin CSRF checks, Prisma parameterization (SQLi-safe), React auto-escaping (XSS), httpOnly cookies, audit log, per-org data isolation.

## Landmark decisions & demo notes

- Dates are stored as church-local `YYYY-MM-DD` strings; "today" is computed in the organization's timezone.
- Demo song lyrics are **original placeholders** — replace with your licensed lyrics (CCLI fields are ready). Song metadata is factual.
- The seed synthesizes a real audio practice loop at `public/uploads/practice-loop-g.wav` so the media player (speed, loop, A/B) is demoable offline.
