// One-off test helper: insert N OPEN assignments for a service's first team, then PENDING them for a person.
import { Pool } from "pg";
const pool = new Pool({
  connectionString: "postgresql://postgres.vmyondexswqbldxtsokj:M%40H%40adm!r21@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false },
  max: 1,
});
const orgName = process.argv[2];
const personName = process.argv[3];
const n = Number(process.argv[4] || 2);

const o = await pool.query('SELECT id FROM "Organization" WHERE name=$1', [orgName]);
const oid = o.rows[0].id;
const svc = await pool.query('SELECT id FROM "Service" WHERE "organizationId"=$1 ORDER BY "createdAt" DESC LIMIT 1', [oid]);
const team = await pool.query('SELECT id, name FROM "Team" WHERE "organizationId"=$1 LIMIT 1', [oid]);
const per = await pool.query('SELECT id FROM "Person" WHERE "organizationId"=$1 AND name=$2', [oid, personName]);
const pos = await pool.query('SELECT name FROM "Position" WHERE "teamId"=$1 ORDER BY "sortOrder" LIMIT $2', [team.rows[0].id, n]);

for (const p of pos.rows) {
  await pool.query(
    `INSERT INTO "Assignment" (id, "serviceId", "teamId", "positionName", status, "personId", "notifiedAt", "respondedAt")
     VALUES (gen_random_uuid()::text, $1, $2, $3, 'PENDING', $4, now(), null)`,
    [svc.rows[0].id, team.rows[0].id, p.name, per.rows[0].id]
  );
}
console.log("inserted PENDING:", pos.rows.map((r) => r.name), "for service", svc.rows[0].id);
await pool.end();
