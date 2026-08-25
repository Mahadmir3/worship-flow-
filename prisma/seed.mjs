/**
 * WorshipFlow demo seed — Grace Community Church, Kampala.
 * Run: node prisma/seed.mjs   (idempotent: wipes & recreates demo data)
 */
import { PrismaClient } from "@prisma/client";
import crypto from "crypto";
import fs from "fs";
import path from "path";

let prisma;
if ((process.env.DATABASE_URL || "").startsWith("postgres")) {
  const { PrismaPg } = await import("@prisma/adapter-pg");
  prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
} else {
  prisma = new PrismaClient();
}

function hashPassword(pw) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(pw, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}
const PW = hashPassword("grace2026");

// ── Synthesize a short practice-loop WAV so the media player is demoable ──
function writePracticeLoop() {
  const sampleRate = 22050;
  const seconds = 16;
  const n = sampleRate * seconds;
  const data = Buffer.alloc(n * 2);
  // G – C – Em – D chord pads, 4s each
  const chords = [
    [196.0, 246.94, 293.66], // G3 B3 D4
    [261.63, 329.63, 392.0], // C4 E4 G4
    [164.81, 196.0, 246.94], // E3 G3 B3
    [146.83, 220.0, 293.66], // D3 A3 D4
  ];
  for (let i = 0; i < n; i++) {
    const t = i / sampleRate;
    const chord = chords[Math.floor(t / 4) % chords.length];
    const beat = t % 2;
    const env = Math.exp(-1.1 * beat);
    let v = 0;
    for (const f of chord) v += Math.sin(2 * Math.PI * f * t) * 0.16;
    v += Math.sin(2 * Math.PI * chord[0] * 2 * t) * 0.05 * env; // sparkle octave
    const kick = (t % 0.5) < 0.04 ? Math.sin(2 * Math.PI * 60 * t) * 0.35 * Math.exp(-((t % 0.5) * 90)) : 0;
    const sample = Math.max(-1, Math.min(1, v * (0.5 + 0.5 * env) + kick));
    data.writeInt16LE(Math.round(sample * 32000), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  const dir = path.join(process.cwd(), "public", "uploads");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "practice-loop-g.wav"), Buffer.concat([header, data]));
  return "/uploads/practice-loop-g.wav";
}

const DEMO_LYRICS_NOTE = "(Demo placeholder lyrics — replace with your licensed lyrics.)";

async function main() {
  console.log("Seeding Grace Community Church…");

  // Wipe (demo DB only)
  const tables = [
    "session", "auditLog", "notification", "comment", "message", "channel", "task", "attendance",
    "rehearsalMember", "rehearsalSong", "rehearsal", "mediaFile", "arrangement", "song",
    "blockout", "assignment", "serviceItem", "serviceTemplate", "service", "eventFolder",
    "serviceType", "position", "teamMember", "team", "permissionGrant", "user",
    "paymentProvider", "person", "venue", "campus", "organization",
  ];
  for (const t of [...tables, "eventFolder", "permissionGrant"]) {
    await prisma[t].deleteMany().catch(() => {});
  }

  const practiceLoop = writePracticeLoop();

  // ── Organization ──
  const org = await prisma.organization.create({
    data: {
      name: "Grace Community Church",
      slug: "grace-community-kampala",
      timezone: "Africa/Kampala",
      currency: "UGX",
      setupCompleted: true,
    },
  });

  // ── Campuses & venues ──
  const main = await prisma.campus.create({ data: { organizationId: org.id, name: "Kampala Main Campus", address: "Plot 12, Kololo Hill Drive, Kampala" } });
  const ntinda = await prisma.campus.create({ data: { organizationId: org.id, name: "Ntinda Campus", address: "Stretcher Road, Ntinda, Kampala" } });
  const mainAud = await prisma.venue.create({ data: { campusId: main.id, name: "Main Auditorium", capacity: 1200 } });
  const youthHall = await prisma.venue.create({ data: { campusId: main.id, name: "Youth Hall", capacity: 300 } });
  const ntindaHall = await prisma.venue.create({ data: { campusId: ntinda.id, name: "Ntinda Hall", capacity: 250 } });

  // ── Service types ──
  const st = {};
  for (const t of [
    { key: "sunAM", name: "Sunday Morning", color: "#4F46E5", defaultStart: "09:00", defaultDurationMin: 150 },
    { key: "sunPM", name: "Sunday Evening", color: "#7C3AED", defaultStart: "18:00", defaultDurationMin: 90 },
    { key: "midweek", name: "Midweek Service", color: "#0891B2", defaultStart: "18:00", defaultDurationMin: 90 },
    { key: "youth", name: "Youth Service", color: "#DB2777", defaultStart: "17:30", defaultDurationMin: 90 },
    { key: "prayer", name: "Prayer Service", color: "#D97706", defaultStart: "06:00", defaultDurationMin: 60 },
    { key: "special", name: "Special Event", color: "#059669", defaultStart: "10:00", defaultDurationMin: 180 },
  ]) {
    st[t.key] = await prisma.serviceType.create({ data: { organizationId: org.id, name: t.name, color: t.color, defaultStart: t.defaultStart, defaultDurationMin: t.defaultDurationMin } });
  }

  // ── People & users ──
  const P = {};
  const peopleDefs = [
    ["david", "David Mukisa", "david@gracecommunity.ug", "OWNER", "+256700100101", "Worship leading, acoustic guitar, vocals"],
    ["mary", "Mary Achieng", "mary@gracecommunity.ug", "ADMIN", "+256700100102", "Administration"],
    ["sarah", "Sarah Nakato", "sarah@gracecommunity.ug", "VOLUNTEER", "+256700100103", "Lead vocals, harmonies"],
    ["james", "James Okello", "james@gracecommunity.ug", "VOLUNTEER", "+256700100104", "Acoustic Guitar, Electric Guitar"],
    ["michael", "Michael Ssemakula", null, null, "+256700100105", "Bass"],
    ["peter", "Peter Ssebunya", "peter@gracecommunity.ug", "LEADER", "+256700100106", "Keyboard, keys, arranging"],
    ["daniel", "Daniel Kiggundu", "daniel@gracecommunity.ug", "MUSICIAN", "+256700100107", "Drums"],
    ["grace", "Grace Atim", "grace@gracecommunity.ug", "LEADER", "+256700100108", "Sound engineering, mixing"],
    ["robert", "Robert Kigongo", "robert@gracecommunity.ug", "VOLUNTEER", "+256700100109", "Teaching, preaching"],
    ["esther", "Esther Nabirye", null, null, "+256700100110", "Background vocals"],
    ["rachel", "Rachel Komuhangi", null, null, "+256700100111", "Background vocals"],
    ["samuel", "Samuel Lukwago", null, null, "+256700100112", "Percussion, congas, djembe"],
    ["joseph", "Joseph Kato", null, null, "+256700100113", "Electric Guitar"],
    ["deborah", "Deborah Ainembabazi", null, null, "+256700100114", "Keyboard, piano"],
    ["emmanuel", "Emmanuel Tumusiime", null, null, "+256700100115", "Livestream, camera"],
    ["brian", "Brian Mugisha", null, null, "+256700100116", "Lighting"],
    ["florence", "Florence Kyomuhendo", null, null, "+256700100117", "Projection, media slides"],
    ["agnes", "Agnes Nakanwagi", null, null, "+256700100118", "Ushering, hospitality"],
    ["stephen", "Stephen Wandera", null, null, "+256700100119", "Children's ministry"],
    ["betty", "Betty Nalubega", null, null, "+256700100120", "Hospitality, catering"],
    ["isaac", "Isaac Muwanga", null, null, "+256700100121", "Prayer, intercession"],
    ["caleb", "Caleb Odongo", null, null, "+256700100122", "Security"],
    ["hannah", "Hannah Namutebi", null, null, "+256700100123", "Welcome team"],
    ["lydia", "Lydia Auma", null, null, "+256700100124", "Choir, vocals, directing"],
  ];
  for (const [key, name, email, role, phone, skills] of peopleDefs) {
    const person = await prisma.person.create({
      data: { organizationId: org.id, name, email, phone, whatsapp: phone, skills, campusId: main.id, preferredFrequency: 2 + (key.length % 3) },
    });
    P[key] = person;
    if (email) {
      const user = await prisma.user.create({
        data: { organizationId: org.id, email, name, role: role || "VOLUNTEER", passwordHash: PW, personId: person.id },
      });
      P[key].userId = user.id;
    }
  }

  // ── Teams & positions ──
  const teamDef = [
    ["band", "Band", "WORSHIP", "peter", [
      ["Acoustic Guitar", "acoustic guitar"], ["Electric Guitar", "electric guitar"], ["Bass", "bass"],
      ["Keyboard", "keyboard, keys"], ["Drums", "drums"], ["Percussion", "percussion, congas, djembe"],
    ]],
    ["singers", "Singers", "WORSHIP", "david", [
      ["Worship Leader", "worship leading"], ["Lead Vocal", "lead vocals"], ["Background Vocal", "background vocals, harmonies"],
    ]],
    ["choir", "Choir", "CHOIR", "lydia", [["Choir Director", "choir, directing"], ["Soprano", "soprano"], ["Alto", "alto"], ["Tenor", "tenor"]]],
    ["media", "Media", "PRODUCTION", "florence", [
      ["Projection", "projection, media slides"], ["Livestream", "livestream"], ["Camera", "camera"],
      ["Lighting", "lighting"], ["Stage Manager", "stage"],
    ]],
    ["sound", "Sound", "PRODUCTION", "grace", [
      ["Sound Engineer", "sound engineering, mixing"], ["Monitor Engineer", "monitors, in-ears"],
    ]],
    ["ushers", "Ushers", "MINISTRY", "agnes", [["Head Usher", "ushering"], ["Usher", "ushering"]]],
    ["prayer", "Prayer Team", "MINISTRY", "isaac", [["Prayer Leader", "prayer, intercession"], ["Intercessor", "prayer"]]],
    ["children", "Children's Ministry", "MINISTRY", "stephen", [["Children's Lead", "children"], ["Children's Helper", "children"]]],
    ["hospitality", "Hospitality", "MINISTRY", "betty", [["Hospitality Lead", "hospitality"], ["Welcome Desk", "welcome"]]],
  ];
  const T = {};
  for (const [key, name, category, leaderKey, positions] of teamDef) {
    const team = await prisma.team.create({
      data: {
        organizationId: org.id,
        campusId: main.id,
        name,
        category,
        leaderPersonId: P[leaderKey].id,
        positions: { create: positions.map(([nm, skills], i) => ({ name: nm, sortOrder: i, skills })) },
      },
    });
    T[key] = team;
  }

  // Team memberships
  const membershipDef = [
    ["band", ["peter", "james", "michael", "daniel", "samuel", "joseph", "deborah"]],
    ["singers", ["david", "sarah", "esther", "rachel"]],
    ["choir", ["lydia", "esther", "rachel", "sarah", "hannah"]],
    ["media", ["florence", "emmanuel", "brian", "caleb"]],
    ["sound", ["grace"]],
    ["ushers", ["agnes", "hannah", "caleb", "betty"]],
    ["prayer", ["isaac", "esther", "rachel"]],
    ["children", ["stephen", "betty", "hannah"]],
    ["hospitality", ["betty", "agnes", "hannah"]],
  ];
  for (const [teamKey, memberKeys] of membershipDef) {
    for (const mk of memberKeys) {
      await prisma.teamMember.create({
        data: {
          teamId: T[teamKey].id,
          personId: P[mk].id,
          isLeader: P[mk].id === T[teamKey].leaderPersonId,
          skills: P[mk].skills,
        },
      });
    }
  }

  // ── Event folders ──
  const F = {};
  for (const [key, name, color, sortOrder] of [
    ["sundays", "Sunday Services", "#4F46E5", 0],
    ["midweek", "Midweek & Prayer", "#0891B2", 1],
    ["youth", "Youth", "#DB2777", 2],
    ["special", "Conferences & Special", "#059669", 3],
  ]) {
    F[key] = await prisma.eventFolder.create({ data: { organizationId: org.id, name, color, sortOrder } });
  }

  // ── Admin-granted rights (demo: Peter & Grace have rights, others wait for an admin) ──
  for (const [userKey, capabilities] of [
    ["grace", ["schedule"]], // extra right on top of her Leader level
  ]) {
    for (const capability of capabilities) {
      await prisma.permissionGrant.create({
        data: { organizationId: org.id, userId: P[userKey].userId, capability, grantedById: P.mary.userId },
      });
    }
  }

  // ── Songs ──
  const chart = (lines) => lines.join("\n");
  const songs = [
    {
      key: "waymaker", title: "Way Maker", artist: "Sinach", writer: "Osinachi Kalu Okoro Egbu", defaultKey: "G", bpm: 72,
      genre: "Worship", tags: "faithfulness, healing, sovereignty, Africa", ccli: "7081010", copyright: "© 2015 Sinach (demo metadata)",
      arrangements: [
        { name: "Original (album)", key: "G", bpm: 72, chart: chart([
          "[Intro]",
          "G   D   Em   C",
          "",
          "[Verse 1]",
          "G                     D",
          "Placeholder verse line one",
          "Em                    C",
          "Placeholder verse line two",
          "",
          "[Chorus]",
          "C          G       D        Em",
          "Placeholder chorus line one",
          "C          G       D",
          "Placeholder chorus line two",
          "",
          "[Bridge]",
          "Em      C      G      D",
          "Placeholder bridge (x4)",
        ]) },
        { name: "Acoustic (youth)", key: "E", bpm: 76, chart: chart([
          "[Verse]",
          "E                B",
          "Placeholder verse",
          "C#m              A",
          "Placeholder verse",
          "[Chorus]",
          "A     E     B     C#m",
          "Chorus line",
        ]) },
        { name: "Full Band", key: "G", bpm: 72, chart: "[Same as Original — full band dynamics: pads + electric delay on chorus]" },
      ],
    },
    {
      key: "greatare", title: "Great Are You Lord", artist: "All Sons & Daughters", writer: "Jason Ingram, Leslie Jordan", defaultKey: "C", bpm: 68,
      genre: "Worship", tags: "praise, holiness, thanksgiving", ccli: "6460220", copyright: "© 2012 Integrity Music (demo metadata)",
      arrangements: [{ name: "Original", key: "C", bpm: 68, chart: chart([
        "[Verse]",
        "C                 Am",
        "Placeholder verse line",
        "F                 G",
        "Placeholder verse line",
        "[Chorus]",
        "F        C       G       Am",
        "Great are You, Lord (placeholder)",
        "F        C       G",
        "Chorus line two",
      ]) }],
    },
    {
      key: "beautifulname", title: "What A Beautiful Name", artist: "Hillsong Worship", writer: "Brooke Ligertwood, Ben Fielding", defaultKey: "D", bpm: 75,
      genre: "Worship", tags: "holiness, love, praise", ccli: "7068424", copyright: "© 2016 Hillsong Music (demo metadata)",
      arrangements: [{ name: "Original", key: "D", bpm: 75, chart: chart([
        "[Verse 1]",
        "D                Bm",
        "Placeholder verse",
        "A/F#             G",
        "Placeholder verse",
        "[Chorus]",
        "G          A        Bm",
        "What a beautiful Name (placeholder)",
        "G          A",
        "Chorus line",
      ]) }],
    },
    {
      key: "howgreat", title: "How Great Is Our God", artist: "Chris Tomlin", writer: "Chris Tomlin, Ed Cash, Jesse Reeves", defaultKey: "G", bpm: 78,
      genre: "Praise", tags: "praise, power, majesty", ccli: "4348399", copyright: "© 2004 EMI (demo metadata)",
      arrangements: [{ name: "Original", key: "G", bpm: 78, chart: chart([
        "[Verse]",
        "G                Em",
        "Placeholder verse",
        "C                D",
        "Placeholder verse",
        "[Chorus]",
        "G      Em       C",
        "How great is our God (placeholder)",
      ]) }],
    },
    {
      key: " tenthousand", title: "10,000 Reasons (Bless the Lord)", artist: "Matt Redman", writer: "Jonas Myrin, Matt Redman", defaultKey: "G", bpm: 74,
      genre: "Worship", tags: "thanksgiving, hope, bless", ccli: "6016350", copyright: "© 2011 Thankyou Music (demo metadata)",
      arrangements: [{ name: "Original", key: "G", bpm: 74, chart: chart([
        "[Verse]",
        "G                  C",
        "Placeholder verse",
        "G                  D",
        "Placeholder verse",
        "[Chorus]",
        "C          D       G       Em",
        "Bless the Lord, O my soul (placeholder)",
        "C          D       G",
        "Chorus line",
      ]) }],
    },
    {
      key: "blessedbe", title: "Blessed Be Your Name", artist: "Tree 63", writer: "Beth Redman, Matt Redman", defaultKey: "A", bpm: 130,
      genre: "Praise", tags: "praise, faithfulness, hope", ccli: "3772653", copyright: "© 2002 Thankyou Music (demo metadata)",
      arrangements: [{ name: "Upbeat", key: "A", bpm: 130, chart: chart([
        "[Verse]",
        "A                 E",
        "Placeholder verse",
        "F#m               D",
        "Placeholder verse",
        "[Chorus]",
        "D       A       E       F#m",
        "Blessed be Your name (placeholder)",
      ]) }],
    },
    {
      key: "nara", title: "Nara Ekele", artist: "Tim Godfrey", writer: "Tim Godfrey", defaultKey: "E", bpm: 80,
      genre: "Praise", tags: "thanksgiving, Africa, praise", ccli: "7104554", copyright: "© 2017 Roxe Music (demo metadata)",
      arrangements: [{ name: "Original", key: "E", bpm: 80, chart: chart([
        "[Verse — Igbo/English]",
        "E                 B",
        "Nara ekele (placeholder)",
        "C#m               A",
        "Take all the praise (placeholder)",
        "[Part]",
        "A       B       C#m",
        "Placeholder part (x3)",
      ]) }],
    },
    {
      key: "mightyman", title: "Mighty Man of War", artist: "Jimmy D Psalmist", writer: "Jimmy D Psalmist", defaultKey: "F", bpm: 85,
      genre: "Praise", tags: "power, Africa, warfare, victory", ccli: "7118925", copyright: "© 2017 Insight Music (demo metadata)",
      arrangements: [{ name: "Original", key: "F", bpm: 85, chart: chart([
        "[Verse]",
        "F                  Dm",
        "Placeholder verse",
        "Bb                 C",
        "Placeholder verse",
        "[Chorus]",
        "Bb      C       F       Dm",
        "Mighty man of war (placeholder)",
      ]) }],
    },
  ];

  const S = {};
  for (const s of songs) {
    const song = await prisma.song.create({
      data: {
        organizationId: org.id,
        title: s.title.trim(),
        artist: s.artist,
        writer: s.writer,
        defaultKey: s.defaultKey,
        bpm: s.bpm,
        genre: s.genre,
        tags: s.tags,
        ccliNumber: s.ccli,
        copyright: s.copyright,
        arrangements: {
          create: s.arrangements.map((a) => ({
            name: a.name,
            key: a.key,
            bpm: a.bpm,
            chart: a.chart,
            lyrics: `${DEMO_LYRICS_NOTE}\n\n[${a.name}]\nWords go here in verses, chorus and bridge sections.\nCharts and lyrics are fully editable per arrangement.`,
          })),
        },
      },
    });
    S[s.key.trim()] = song;
  }

  // ── Media ──
  const mediaDefs = [
    ["songs", "Way Maker — lyric video (search)", "LINK", "https://www.youtube.com/results?search_query=sinach+way+maker+official+video", "waymaker"],
    ["songs", "Great Are You Lord (search)", "LINK", "https://www.youtube.com/results?search_query=great+are+you+lord+all+sons+and+daughters", "greatare"],
    ["songs", "Practice loop — G/C/Em/D pad + click", "AUDIO", practiceLoop, "waymaker"],
    ["sermons", "Sunday sermon — audio archive", "LINK", "https://gracecommunity.ug/media", null],
    ["graphics", "Series artwork — God of Wonders", "LINK", "https://unsplash.com/s/photos/worship", null],
    ["production", "Sound console input list (template)", "LINK", "https://en.wikipedia.org/wiki/Mixing_console", null],
    ["videos", "Livestream highlight reel", "LINK", "https://www.youtube.com/results?search_query=church+livestream+highlight", null],
  ];
  for (const [folder, name, type, url, songKey] of mediaDefs) {
    await prisma.mediaFile.create({
      data: { organizationId: org.id, folder, name, type, url, songId: songKey ? S[songKey].id : null },
    });
  }

  // ── Services ──
  async function makeService(opts, items = [], assignments = []) {
    const svc = await prisma.service.create({
      data: {
        organizationId: org.id,
        campusId: opts.campusId,
        venueId: opts.venueId || null,
        typeId: typeof opts.typeId === "string" ? opts.typeId : opts.typeId.id,
        title: opts.title,
        date: opts.date,
        startTime: opts.startTime,
        endTime: opts.endTime,
        theme: opts.theme || null,
        scripture: opts.scripture || null,
        notes: opts.notes || null,
        status: opts.status || "PLANNING",
        folderId: opts.folderId || null,
        worshipLeaderId: opts.worshipLeaderId || null,
        preacherId: opts.preacherId || null,
        serviceLeaderId: opts.serviceLeaderId || null,
      },
    });
    for (const [i, it] of items.entries()) {
      await prisma.serviceItem.create({
        data: {
          serviceId: svc.id,
          sortOrder: i,
          title: it.title,
          type: it.type,
          durationSec: it.durationSec,
          personId: it.personId || null,
          songId: it.songId || null,
          key: it.key || null,
          notes: it.notes || null,
        },
      });
    }
    for (const a of assignments) {
      await prisma.assignment.create({
        data: {
          serviceId: svc.id,
          teamId: a.teamId,
          positionName: a.positionName,
          personId: a.personId || null,
          status: a.status || "OPEN",
          notifiedAt: a.personId ? new Date() : null,
          respondedAt: ["ACCEPTED", "CONFIRMED", "DECLINED"].includes(a.status) ? new Date() : null,
          note: a.note || null,
        },
      });
    }
    return svc;
  }

  const DEPT_TEAM = {
      "Worship Leader": "singers", "Lead Vocal": "singers", "Background Vocal": "singers",
      "Acoustic Guitar": "band", "Electric Guitar": "band", "Bass": "band", "Keyboard": "band",
      "Drums": "band", "Percussion": "band",
      "Sound Engineer": "sound", "Monitor Engineer": "sound",
      "Projection": "media", "Livestream": "media", "Camera": "media", "Lighting": "media", "Stage Manager": "media",
    };
  const worshipAssign = (rows) =>
    rows.map(([positionName, personKey, status, note]) => ({
      teamId: T[DEPT_TEAM[positionName] || "band"].id,
      positionName,
      personId: personKey ? P[personKey].id : null,
      status: status || (personKey ? "ACCEPTED" : "OPEN"),
      note,
    }));

  // Past services (Aug 16 & 23) — completed, with attendance
  const past16 = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.sunAM, title: "Sunday Worship Service", folderId: F.sundays.id, date: "2026-08-16", startTime: "09:00", endTime: "11:30", theme: "Rooted in Love", scripture: "Ephesians 3:17", status: "COMPLETED", worshipLeaderId: P.david.id, preacherId: P.robert.id },
    [
      { title: "Welcome", type: "WELCOME", durationSec: 300 },
      { title: "Opening Prayer", type: "PRAYER", durationSec: 300, personId: P.isaac.id },
      { title: "10,000 Reasons (Bless the Lord)", type: "SONG", durationSec: 330, songId: S["tenthousand"].id, key: "G" },
      { title: "Mighty Man of War", type: "SONG", durationSec: 330, songId: S.mightyman.id, key: "F" },
      { title: "Nara Ekele", type: "SONG", durationSec: 300, songId: S.nara.id, key: "E" },
      { title: "Offering", type: "OFFERING", durationSec: 600 },
      { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300 },
      { title: "Sermon — Rooted in Love", type: "SERMON", durationSec: 2400, personId: P.robert.id },
      { title: "Closing Prayer", type: "CLOSING", durationSec: 300 },
    ],
    worshipAssign([
      ["Worship Leader", "david", "CONFIRMED"], ["Lead Vocal", "sarah", "CONFIRMED"], ["Background Vocal", "esther", "CONFIRMED"],
      ["Acoustic Guitar", "james", "CONFIRMED"], ["Bass", "michael", "CONFIRMED"], ["Keyboard", "deborah", "CONFIRMED"],
      ["Drums", "daniel", "CONFIRMED"], ["Percussion", "samuel", "CONFIRMED"],
    ])
  );

  const past23 = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.sunAM, title: "Sunday Worship Service", folderId: F.sundays.id, date: "2026-08-23", startTime: "09:00", endTime: "11:30", theme: "Faithful God", scripture: "Lamentations 3:22-23", status: "COMPLETED", worshipLeaderId: P.david.id, preacherId: P.robert.id },
    [
      { title: "Welcome", type: "WELCOME", durationSec: 300 },
      { title: "Opening Prayer", type: "PRAYER", durationSec: 300 },
      { title: "Blessed Be Your Name", type: "SONG", durationSec: 300, songId: S.blessedbe.id, key: "A" },
      { title: "How Great Is Our God", type: "SONG", durationSec: 330, songId: S.howgreat.id, key: "G" },
      { title: "Way Maker", type: "SONG", durationSec: 360, songId: S.waymaker.id, key: "G" },
      { title: "Offering", type: "OFFERING", durationSec: 600 },
      { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300 },
      { title: "Sermon — Faithful God", type: "SERMON", durationSec: 2400, personId: P.robert.id },
      { title: "Closing Prayer", type: "CLOSING", durationSec: 300 },
    ],
    worshipAssign([
      ["Worship Leader", "david", "CONFIRMED"], ["Lead Vocal", "rachel", "CONFIRMED"], ["Background Vocal", "esther", "CONFIRMED"],
      ["Electric Guitar", "joseph", "CONFIRMED"], ["Bass", "michael", "CONFIRMED"], ["Keyboard", "peter", "CONFIRMED"],
      ["Drums", "daniel", "CONFIRMED"],
    ])
  );

  // THE hero service: this Sunday, Aug 30
  const aug30 = await makeService(
    {
      campusId: main.id, venueId: mainAud.id, typeId: st.sunAM, title: "Sunday Worship Service", folderId: F.sundays.id,
      date: "2026-08-30", startTime: "09:00", endTime: "11:30", theme: "God of Wonders", scripture: "Psalm 19:1",
      status: "READY", worshipLeaderId: P.david.id, preacherId: P.robert.id, serviceLeaderId: P.mary.id,
      notes: "Communion after sermon. Choir joins for the response song. Livestream on YouTube & Facebook.",
    },
    [
      { title: "Welcome & Call to Worship", type: "WELCOME", durationSec: 300, personId: P.mary.id },
      { title: "Opening Prayer", type: "PRAYER", durationSec: 300, personId: P.isaac.id },
      { title: "How Great Is Our God", type: "SONG", durationSec: 330, songId: S.howgreat.id, key: "G", notes: "Start with keys pad, band enters v2" },
      { title: "Way Maker", type: "SONG", durationSec: 360, songId: S.waymaker.id, key: "G", notes: "Bridge x2, then soft chorus" },
      { title: "What A Beautiful Name", type: "SONG", durationSec: 360, songId: S.beautifulname.id, key: "D" },
      { title: "Offering", type: "OFFERING", durationSec: 600, notes: "Background music: practice loop" },
      { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300, personId: P.hannah.id },
      { title: "Sermon — God of Wonders", type: "SERMON", durationSec: 2400, personId: P.robert.id, notes: "Psalm 19. Slides from Florence." },
      { title: "10,000 Reasons (Communion)", type: "SONG", durationSec: 360, songId: S["tenthousand"].id, key: "G", notes: "Choir joins. Communion served during song." },
      { title: "Closing Prayer & Benediction", type: "CLOSING", durationSec: 300, personId: P.robert.id },
    ],
    [
      ...worshipAssign([
        ["Worship Leader", "david", "ACCEPTED"],
        ["Lead Vocal", "sarah", "PENDING"],
        ["Background Vocal", "esther", "PENDING"],
        ["Acoustic Guitar", "james", "ACCEPTED"],
        ["Electric Guitar", "joseph", "ACCEPTED"],
        ["Bass", "michael", "ACCEPTED"],
        ["Keyboard", "peter", "ACCEPTED"],
        ["Drums", null, "OPEN"],
        ["Percussion", "samuel", "DECLINED", "Traveling upcountry on Friday, back Monday"],
      ]),
      ...[
        ["Sound Engineer", "grace", "ACCEPTED"], ["Lighting", "brian", "ACCEPTED"],
        ["Projection", "florence", "CONFIRMED"], ["Livestream", "emmanuel", "ACCEPTED"],
      ].map(([positionName, personKey, status]) => ({ teamId: T[DEPT_TEAM[positionName] || "sound"].id, positionName, personId: P[personKey].id, status })),
      ...[
        ["Head Usher", "agnes", "CONFIRMED"], ["Usher", "hannah", "ACCEPTED"], ["Usher", "caleb", "ACCEPTED"],
      ].map(([positionName, personKey, status]) => ({ teamId: T.ushers.id, positionName, personId: P[personKey].id, status })),
    ]
  );

  // Sep 6 — mostly open (auto-schedule demo)
  const sep6 = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.sunAM, title: "Sunday Worship Service", folderId: F.sundays.id, date: "2026-09-06", startTime: "09:00", endTime: "11:30", theme: "Walking in the Spirit", scripture: "Galatians 5:16", worshipLeaderId: P.david.id },
    [
      { title: "Welcome", type: "WELCOME", durationSec: 300 },
      { title: "Opening Prayer", type: "PRAYER", durationSec: 300 },
      { title: "Song 1 — TBD", type: "SONG", durationSec: 330 },
      { title: "Song 2 — TBD", type: "SONG", durationSec: 330 },
      { title: "Offering", type: "OFFERING", durationSec: 600 },
      { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300 },
      { title: "Sermon", type: "SERMON", durationSec: 2400 },
      { title: "Closing Prayer", type: "CLOSING", durationSec: 300 },
    ],
    [
      ...worshipAssign([
        ["Worship Leader", "david", "ACCEPTED"], ["Lead Vocal", null, "OPEN"], ["Background Vocal", null, "OPEN"],
        ["Acoustic Guitar", null, "OPEN"], ["Bass", null, "OPEN"], ["Keyboard", null, "OPEN"], ["Drums", null, "OPEN"],
      ]),
      { teamId: T.sound.id, positionName: "Sound Engineer", status: "OPEN" },
      { teamId: T.media.id, positionName: "Projection", status: "OPEN" },
    ]
  );

  const sep6ntinda = await makeService(
    { campusId: ntinda.id, venueId: ntindaHall.id, typeId: st.sunAM, title: "Ntinda Sunday Service", folderId: F.sundays.id, date: "2026-09-06", startTime: "10:00", endTime: "12:00" },
    [{ title: "Welcome", type: "WELCOME", durationSec: 300 }, { title: "Worship", type: "WORSHIP_SET", durationSec: 1500 }, { title: "Sermon", type: "SERMON", durationSec: 2100 }],
    [{ teamId: T.band.id, positionName: "Worship Leader", status: "OPEN" }, { teamId: T.ushers.id, positionName: "Head Usher", status: "OPEN" }]
  );

  const sep13 = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.sunAM, title: "Sunday Worship Service", folderId: F.sundays.id, date: "2026-09-13", startTime: "09:00", endTime: "11:30" },
    [{ title: "Welcome", type: "WELCOME", durationSec: 300 }, { title: "Worship", type: "WORSHIP_SET", durationSec: 1200 }, { title: "Sermon", type: "SERMON", durationSec: 2400 }],
    [{ teamId: T.band.id, positionName: "Worship Leader", status: "OPEN" }, { teamId: T.band.id, positionName: "Drums", status: "OPEN" }]
  );

  const sep20 = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.sunPM, title: "Sunday Evening Service", folderId: F.sundays.id, date: "2026-09-20", startTime: "18:00", endTime: "19:30" },
    [],
    []
  );

  const midweek = await makeService(
    { campusId: main.id, venueId: mainAud.id, typeId: st.midweek, title: "Midweek Prayer & Word", folderId: F.midweek.id, date: "2026-09-02", startTime: "18:00", endTime: "19:30" },
    [
      { title: "Worship", type: "WORSHIP_SET", durationSec: 900 },
      { title: "Prayer Focus — Nations", type: "PRAYER", durationSec: 1800, personId: P.isaac.id },
      { title: "Word", type: "SERMON", durationSec: 1200 },
    ],
    [{ teamId: T.prayer.id, positionName: "Prayer Leader", personId: P.isaac.id, status: "ACCEPTED" }]
  );

  const youth = await makeService(
    { campusId: main.id, venueId: youthHall.id, typeId: st.youth, title: "Ignite Youth Service", folderId: F.youth.id, date: "2026-08-28", startTime: "17:30", endTime: "19:00", theme: "Unashamed", scripture: "Romans 1:16" },
    [
      { title: "Games & Welcome", type: "WELCOME", durationSec: 600 },
      { title: "Worship", type: "WORSHIP_SET", durationSec: 1200 },
      { title: "Talk — Unashamed", type: "SERMON", durationSec: 1500 },
      { title: "Small Groups", type: "OTHER", durationSec: 900 },
    ],
    [{ teamId: T.band.id, positionName: "Worship Leader", personId: P.peter.id, status: "ACCEPTED" }]
  );

  // ── Attendance for past services ──
  for (const svc of [past16, past23]) {
    for (const key of ["david", "sarah", "james", "michael", "peter", "daniel", "esther", "grace", "florence", "emmanuel", "agnes", "hannah"]) {
      await prisma.attendance.create({
        data: {
          serviceId: svc.id,
          personId: P[key].id,
          status: key === "florence" && svc.id === past16.id ? "LATE" : "PRESENT",
        },
      });
    }
  }

  // ── Blockouts ──
  await prisma.blockout.create({ data: { personId: P.sarah.id, startDate: "2026-09-13", endDate: "2026-09-20", reason: "Family visit to Jinja" } });
  await prisma.blockout.create({ data: { personId: P.daniel.id, startDate: "2026-09-05", endDate: "2026-09-07", reason: "Wedding gig" } });
  await prisma.blockout.create({ data: { personId: P.rachel.id, startDate: "2026-09-06", endDate: "2026-09-06", reason: "Exam prep" } });
  await prisma.blockout.create({ data: { personId: P.michael.id, startDate: "2026-09-13", endDate: "2026-09-13", reason: "Travel" } });
  await prisma.blockout.create({ data: { personId: P.emmanuel.id, weekday: 2, startDate: "2026-01-01", endDate: "2026-12-31", reason: "Evening classes (every Wednesday)" } });

  // ── Rehearsals ──
  const rehearsal = async (opts, songRows = [], members = []) => {
    const r = await prisma.rehearsal.create({
      data: {
        organizationId: org.id,
        serviceId: opts.serviceId || null,
        teamId: opts.teamId || null,
        campusId: main.id,
        title: opts.title,
        date: opts.date,
        startTime: opts.startTime,
        endTime: opts.endTime,
        location: opts.location,
        notes: opts.notes || null,
        objectives: opts.objectives || null,
        checklist: JSON.stringify([
          { key: "vocals", label: "Vocal rehearsal", done: opts.checklist?.vocals || false },
          { key: "band", label: "Band rehearsal", done: opts.checklist?.band || false },
          { key: "sound", label: "Soundcheck", done: opts.checklist?.sound || false },
          { key: "lights", label: "Lighting check", done: false },
          { key: "media", label: "Media check", done: false },
          { key: "run", label: "Full run-through", done: false },
        ]),
      },
    });
    for (const s of songRows) {
      await prisma.rehearsalSong.create({
        data: { rehearsalId: r.id, songId: s.songId || null, title: s.title, status: s.status || "NOT_STARTED", notes: s.notes || null },
      });
    }
    for (const m of members) {
      await prisma.rehearsalMember.create({
        data: { id: `${r.id}_${P[m.key].id}`, rehearsalId: r.id, personId: P[m.key].id, attending: m.attending || "UNKNOWN" },
      });
    }
    return r;
  };

  await rehearsal(
    { serviceId: aug30.id, teamId: T.band.id, title: "Band Rehearsal — Aug 30 service", date: "2026-08-27", startTime: "18:00", endTime: "20:00", location: "Main Auditorium", objectives: "Lock transitions for Way Maker; teach communion flow; new electric tone check.", notes: "Come prepared — charts are in the song library. Bring your own cables.", checklist: { vocals: true, band: true } },
    [
      { songId: S.howgreat.id, title: "How Great Is Our God", status: "READY" },
      { songId: S.waymaker.id, title: "Way Maker", status: "REHEARSED", notes: "Bridge timing — wait for drums fill" },
      { songId: S.beautifulname.id, title: "What A Beautiful Name", status: "LEARNING" },
      { songId: S["tenthousand"].id, title: "10,000 Reasons (communion)", status: "NOT_STARTED", notes: "Choir joins — teach harmony stack" },
    ],
    [
      { key: "david", attending: "YES" }, { key: "sarah", attending: "YES" }, { key: "esther", attending: "YES" },
      { key: "james", attending: "YES" }, { key: "joseph", attending: "YES" }, { key: "michael", attending: "YES" },
      { key: "peter", attending: "YES" }, { key: "grace", attending: "YES" },
    ]
  );

  await rehearsal(
    { serviceId: null, teamId: T.choir.id, title: "Choir Practice", date: "2026-08-29", startTime: "16:00", endTime: "17:30", location: "Youth Hall", objectives: "Communion song harmonies" },
    [{ title: "10,000 Reasons — harmony stack", status: "LEARNING" }],
    [{ key: "lydia", attending: "YES" }, { key: "esther", attending: "YES" }, { key: "rachel", attending: "UNKNOWN" }]
  );

  await rehearsal(
    { serviceId: sep6.id, teamId: T.band.id, title: "Band Rehearsal — Sep 6 service", date: "2026-09-03", startTime: "18:00", endTime: "20:00", location: "Main Auditorium" },
    [],
    []
  );

  // ── Template ──
  await prisma.serviceTemplate.create({
    data: {
      organizationId: org.id,
      name: "Standard Sunday Flow",
      typeId: st.sunAM.id,
      items: JSON.stringify([
        { title: "Welcome & Call to Worship", type: "WELCOME", durationSec: 300 },
        { title: "Opening Prayer", type: "PRAYER", durationSec: 300 },
        { title: "Worship Song 1", type: "SONG", durationSec: 330 },
        { title: "Worship Song 2", type: "SONG", durationSec: 330 },
        { title: "Worship Song 3", type: "SONG", durationSec: 330 },
        { title: "Offering", type: "OFFERING", durationSec: 600 },
        { title: "Announcements", type: "ANNOUNCEMENT", durationSec: 300 },
        { title: "Sermon", type: "SERMON", durationSec: 2400 },
        { title: "Response Song", type: "SONG", durationSec: 330 },
        { title: "Closing Prayer", type: "CLOSING", durationSec: 300 },
      ]),
    },
  });

  // ── Channels & messages ──
  const channelDefs = [
    ["general", "general", "Church-wide updates"],
    ["worship-team", "worship-team", "Music & worship coordination"],
    ["production", "production", "Sound, lighting & media"],
    ["youth", "youth", "Youth ministry"],
    ["children", "children", "Children's ministry"],
    ["leadership", "leadership", "Pastors & department leads"],
  ];
  const C = {};
  for (const [name, slug, purpose] of channelDefs) {
    C[name] = await prisma.channel.create({ data: { organizationId: org.id, name: name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), slug: `${slug}-${org.id.slice(0, 6)}`, purpose } });
  }

  const msg = async (channelKey, userKey, body, pinned = false, minsAgo = 60) => {
    const u = await prisma.user.findFirst({ where: { personId: P[userKey].id } });
    if (!u) return;
    await prisma.message.create({
      data: { channelId: C[channelKey].id, userId: u.id, body, pinned, createdAt: new Date(Date.now() - minsAgo * 60000) },
    });
  };
  await msg("worship-team", "david", "Team! Thursday rehearsal 6 PM sharp — we're locking Way Maker transitions and teaching the communion harmony stack. Charts are in the Songs library 🎶", true, 240);
  await msg("worship-team", "david", "Drummer position for Sunday is still open — pray with me for the right person 🙏", false, 180);
  await msg("worship-team", "sarah", "@David I'll be there! Can we get the acoustic arrangement key for Way Maker?", false, 120);
  await msg("worship-team", "peter", "Key of E version is already in the library under 'Acoustic (youth)'.", false, 90);
  await msg("production", "grace", "Input list for Sunday is updated — choir gets 2 extra mics for the communion song.", false, 150);
  await msg("production", "emmanuel", "Livestream tested ✅ switching YouTube + Facebook at 8:45.", false, 60);
  await msg("general", "mary", "Reminder: ushers' briefing 8:15 AM Sunday. Welcome our first-time guests warmly!", false, 300);

  // ── Tasks ──
  const taskDefs = [
    [aug30.id, "Upload lyric slides for all 4 songs", "florence", "2026-08-29", "HIGH", "DONE"],
    [aug30.id, "Find a drummer for Sunday", "david", "2026-08-28", "HIGH", "IN_PROGRESS"],
    [aug30.id, "Prepare sermon slides — Psalm 19", "florence", "2026-08-29", "MEDIUM", "IN_PROGRESS"],
    [aug30.id, "Test livestream on YouTube & Facebook", "emmanuel", "2026-08-30", "HIGH", "TODO"],
    [aug30.id, "Print service order for ushers", "mary", "2026-08-30", "LOW", "TODO"],
    [null, "Return borrowed congas to storage", "samuel", "2026-09-01", "LOW", "TODO"],
    [sep6.id, "Choose setlist for Sep 6", "david", "2026-09-02", "MEDIUM", "TODO"],
  ];
  for (const [serviceId, title, personKey, dueDate, priority, status] of taskDefs) {
    await prisma.task.create({
      data: { organizationId: org.id, serviceId, title, assigneeId: P[personKey].id, dueDate, priority, status, createdById: P.david.userId || null },
    });
  }

  // ── Notifications ──
  const notif = async (userKey, title, body, kind = "INFO", link = null, hoursAgo = 3) => {
    const u = await prisma.user.findFirst({ where: { personId: P[userKey].id } });
    if (!u) return;
    await prisma.notification.create({
      data: { organizationId: org.id, userId: u.id, title, body, kind, link, createdAt: new Date(Date.now() - hoursAgo * 3600000) },
    });
  };
  await notif("sarah", "New request: Lead Vocal", "Sunday Worship Service · 2026-08-30 at 09:00 — Worship Team. Tap to see the plan and everyone serving with you.", "ASSIGNMENT", `/services/${aug30.id}?tab=team`, 26);
  await notif("sarah", "Rehearsal starts tomorrow", "Band Rehearsal — Aug 30 service · Thu 2026-08-27 at 18:00, Main Auditorium.", "INFO", "/rehearsals", 20);
  await notif("david", "James accepted — Acoustic Guitar", "Sunday Worship Service · 2026-08-30", "SUCCESS", "/services", 22);
  await notif("david", "Samuel declined — Percussion", "“Traveling upcountry on Friday, back Monday” — find a replacement on the service team tab.", "WARNING", `/services/${aug30.id}?tab=team`, 19);
  await notif("david", "You have 2 open volunteer positions", "Drums and Percussion are still open for Sunday 2026-08-30.", "WARNING", `/services/${aug30.id}?tab=team`, 5);
  await notif("grace", "New request: Sound Engineer", "Sunday Worship Service · 2026-08-30 at 09:00 — Production. Tap to see the plan and everyone serving with you.", "ASSIGNMENT", `/services/${aug30.id}?tab=team`, 30);
  await notif("mary", "5 tasks need attention this week", "Sunday service preparation is 40% complete.", "INFO", "/tasks", 8);
  await notif("robert", "Sermon slides pending", "Florence is preparing Psalm 19 slides — review before Saturday.", "INFO", "/tasks", 12);

  // ── Payment providers (disabled stubs) ──
  for (const [kind, name] of [["MTN_MOMO", "MTN Mobile Money (UGX)"], ["AIRTEL_MONEY", "Airtel Money (UGX)"], ["CARD", "Card (Visa/Mastercard)"]]) {
    await prisma.paymentProvider.create({ data: { organizationId: org.id, kind, name, enabled: false } });
  }

  // ── Audit log ──
  const auditDef = [
    ["david", "service.create", "Service", aug30.id, { title: "Sunday Worship Service", date: "2026-08-30" }],
    ["david", "service.update", "Service", aug30.id, { theme: "God of Wonders" }],
    ["david", "assignment.schedule", "Assignment", null, { position: "Lead Vocal", person: "Sarah Nakato" }],
    ["james", "assignment.accept", "Assignment", null, { position: "Acoustic Guitar" }],
    ["samuel", "assignment.decline", "Assignment", null, { position: "Percussion" }],
    ["mary", "service.update", "Service", aug30.id, { status: "READY" }],
    ["david", "song.create", "Song", S.waymaker.id, { title: "Way Maker" }],
  ];
  for (const [personKey, action, entity, entityId, meta] of auditDef) {
    await prisma.auditLog.create({
      data: {
        organizationId: org.id,
        userId: P[personKey].userId || null,
        action,
        entity,
        entityId,
        meta: JSON.stringify(meta),
        createdAt: new Date(Date.now() - Math.random() * 72 * 3600000),
      },
    });
  }

  console.log("✅ Seed complete.");
  console.log("   Login: david@gracecommunity.ug / grace2026 (Owner)");
  console.log("        sarah@gracecommunity.ug / grace2026 (Volunteer)");
  console.log("        mary@gracecommunity.ug / grace2026 (Administrator)");
  console.log("        peter@gracecommunity.ug / grace2026 (Dept. Leader — Worship, manages songs)");
  console.log("        grace@gracecommunity.ug / grace2026 (Dept. Leader — Production)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
