// One-off: for every service in an org that has no assignments yet,
// seed OPEN positions from all the org's teams (mirrors the fixed
// createService seeding for services made before the fix).
import { Pool } from "pg";
const pool = new Pool({
  connectionString: "postgresql://postgres.vmyondexswqbldxtsokj:M%40H%40adm!r21@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const orgName = process.argv[2];

const o = await pool.query('SELECT id FROM "Organization" WHERE name=$1', [orgName]);
if (!o.rows.length) {
  console.error("org not found:", orgName);
  process.exit(1);
}
const oid = o.rows[0].id;

const services = await pool.query(
  `SELECT s.id, s.title, s.date FROM "Service" s
   WHERE s."organizationId"=$1 AND NOT EXISTS (SELECT 1 FROM "Assignment" a WHERE a."serviceId"=s.id)
   ORDER BY s.date`,
  [oid]
);
const teams = await pool.query(
  'SELECT t.id, p.name FROM "Team" t JOIN "Position" p ON p."teamId"=t.id WHERE t."organizationId"=$1 ORDER BY t.name, p."sortOrder"',
  [oid]
);

for (const s of services.rows) {
  for (const row of teams.rows) {
    await pool.query(
      `INSERT INTO "Assignment" (id, "serviceId", "teamId", "positionName", status, "createdAt")
       VALUES (gen_random_uuid()::text, $1, $2, $3, 'OPEN', now())`,
      [s.id, row.id, row.name]
    );
  }
  console.log(`seeded ${teams.rows.length} positions → ${s.title} (${s.date})`);
}
if (!services.rows.length) console.log("no empty services found (all already have positions)");
await pool.end();
