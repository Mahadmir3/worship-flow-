import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { hashPassword, createSession } from "@/lib/auth";
import { audit } from "@/lib/audit";

function pubUrl(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host") || "localhost:3000";
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim() || (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

function isHttps(req: NextRequest): boolean {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0].trim();
  return proto ? proto === "https" : false;
}

const DEFAULT_TYPES = [
  { name: "Sunday Morning", color: "#4F46E5", defaultStart: "09:00", defaultDurationMin: 120 },
  { name: "Sunday Evening", color: "#7C3AED", defaultStart: "18:00", defaultDurationMin: 90 },
  { name: "Midweek Service", color: "#0891B2", defaultStart: "18:00", defaultDurationMin: 90 },
  { name: "Youth Service", color: "#DB2777", defaultStart: "17:30", defaultDurationMin: 90 },
  { name: "Prayer Service", color: "#D97706", defaultStart: "06:00", defaultDurationMin: 60 },
];

const DEFAULT_TEAMS = [
  {
    name: "Worship Team",
    category: "WORSHIP",
    positions: ["Worship Leader", "Lead Vocal", "Background Vocal", "Acoustic Guitar", "Electric Guitar", "Bass", "Keyboard", "Drums", "Percussion"],
  },
  {
    name: "Production",
    category: "PRODUCTION",
    positions: ["Sound Engineer", "Lighting", "Projection", "Livestream", "Camera", "Stage Manager"],
  },
];

export async function POST(req: NextRequest) {
  // CSRF: Origin must match the forwarded host or direct host (proxy/preview friendly)
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      const originHost = new URL(origin).host;
      const allowed = [req.headers.get("x-forwarded-host"), req.headers.get("host")].filter(Boolean);
      if (!allowed.includes(originHost)) {
        return NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      }
    } catch {}
  }

  const form = await req.formData();
  const orgName = String(form.get("orgName") || "").trim();
  const name = String(form.get("name") || "").trim();
  const email = String(form.get("email") || "").trim().toLowerCase();
  const password = String(form.get("password") || "");

  if (!orgName || !name || !email || password.length < 8) {
    return NextResponse.redirect(new URL("/signup?error=invalid", pubUrl(req)), 303);
  }

  const exists = await prisma.user.findUnique({ where: { email } });
  if (exists) {
    return NextResponse.redirect(new URL("/signup?error=exists", pubUrl(req)), 303);
  }

  const slug = `${orgName.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 30)}-${Math.random().toString(36).slice(2, 6)}`;
  // All-or-nothing: if anything fails mid-signup (crash, blip), nothing is
  // left behind — no more half-created churches that block the next attempt.
  const { org, user } = await prisma.$transaction(async (tx) => {
  const org = await tx.organization.create({ data: { name: orgName, slug } });
  const campus = await tx.campus.create({
    data: { organizationId: org.id, name: "Main Campus" },
  });
  await tx.venue.create({ data: { campusId: campus.id, name: "Main Auditorium" } });
  for (const t of DEFAULT_TYPES) {
    await tx.serviceType.create({ data: { organizationId: org.id, ...t } });
  }
  for (const t of DEFAULT_TEAMS) {
    await tx.team.create({
      data: {
        organizationId: org.id,
        campusId: campus.id,
        name: t.name,
        category: t.category,
        positions: { create: t.positions.map((name, i) => ({ name, sortOrder: i })) },
      },
    });
  }

  const person = await tx.person.create({
    data: { organizationId: org.id, name, email, campusId: campus.id },
  });
  const user = await tx.user.create({
    data: {
      organizationId: org.id,
      email,
      name,
      role: "OWNER",
      passwordHash: hashPassword(password),
      personId: person.id,
    },
  });

  // Starter channels
  for (const c of [
    { name: "General", purpose: "Church-wide updates" },
    { name: "Worship Team", purpose: "Music & worship coordination" },
    { name: "Production", purpose: "Sound, lighting, media" },
  ]) {
    await tx.channel.create({
      data: { organizationId: org.id, name: c.name, slug: `${c.name.toLowerCase().replace(/\s+/g, "-")}-${org.id}`, purpose: c.purpose },
    });
  }

    return { org, user };
  });

  // Same embedded-preview fix as login: frame-friendly (SameSite=None) cookie when
  // served over https, plus ?wf_token= fallback — middleware promotes it to the
  // session cookie and strips it from the URL, so previews that block cookies
  // entirely still land the new OWNER logged-in on /onboarding.
  const https = isHttps(req);
  const token = await createSession(user.id, { thirdParty: https });
  await audit(org.id, user.id, "org.create", "Organization", org.id, { name: orgName });

  return NextResponse.redirect(new URL(`/onboarding?wf_token=${token}`, pubUrl(req)), 303);
}
