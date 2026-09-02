// OWNER RESCUE — create or repair a church owner's login directly in the
// database, bypassing the app. Use when the only owner is locked out.
//
//   node scripts/owner-rescue.mjs "<church name>" "<email>" "<new password>"
//
// - If a user with that email exists in this church: password reset + role OWNER.
// - If not: creates the Person + OWNER user.
// - Never touches other churches; refuses emails already used by another church.
import { Pool } from "pg";
import { randomBytes, scryptSync } from "node:crypto";
import { readFileSync } from "node:fs";

const [orgName, email, password] = process.argv.slice(2);
if (!orgName || !email || !password || password.length < 8) {
  console.error('Usage: node scripts/owner-rescue.mjs "<church name>" "<email>" "<password (min 8 chars)>"');
  process.exit(1);
}

const env = readFileSync(".env.production.local", "utf8");
const url = env.match(/DATABASE_URL_MIGRATIONS="([^"]+)"/)?.[1] || env.match(/DATABASE_URL="([^"]+)"/)[1];
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });
const nid = () => "c" + randomBytes(12).toString("hex");

function hashPassword(pw) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(pw, salt, 64).toString("hex");
  return `scrypt:${salt}:${hash}`;
}

const org = await pool.query('SELECT id, name FROM "Organization" WHERE name = $1', [orgName]);
if (!org.rows.length) {
  console.error(`Church not found: "${orgName}"`);
  process.exit(1);
}
const oid = org.rows[0].id;

const existing = await pool.query('SELECT id, "organizationId" FROM "User" WHERE email = $1', [email.toLowerCase()]);
if (existing.rows.length && existing.rows[0].organizationId !== oid) {
  console.error("That email already belongs to a user in ANOTHER church. Pick a different email.");
  process.exit(1);
}

let userId;
if (existing.rows.length) {
  userId = existing.rows[0].id;
  await pool.query('UPDATE "User" SET "passwordHash" = $1, role = $2 WHERE id = $3', [hashPassword(password), "OWNER", userId]);
  await pool.query('DELETE FROM "Session" WHERE "userId" = $1', [userId]);
  console.log(`Reset existing user ${email} to OWNER with the new password.`);
} else {
  let person = await pool.query('SELECT id FROM "Person" WHERE "organizationId" = $1 AND lower(email) = $2', [oid, email.toLowerCase()]);
  let personId;
  if (person.rows.length) {
    personId = person.rows[0].id;
    console.log("Linking to their existing person profile.");
  } else {
    const p = await pool.query('INSERT INTO "Person" (id, "organizationId", name, email) VALUES ($1,$2,$3,$4) RETURNING id', [nid(), oid, "Owner", email.toLowerCase()]);
    personId = p.rows[0].id;
  }
  const u = await pool.query(
    'INSERT INTO "User" (id, "organizationId", email, name, role, "passwordHash", "personId") VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
    [nid(), oid, email.toLowerCase(), "Owner", "OWNER", hashPassword(password), personId]
  );
  userId = u.rows[0].id;
  console.log(`Created new OWNER login for ${email}.`);
}

console.log(`Done. ${org.rows[0].name}: sign in at the app with ${email} and the new password.`);
await pool.end();
