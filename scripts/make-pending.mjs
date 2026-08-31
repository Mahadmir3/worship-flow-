// One-off test helper: make N assignments PENDING for a person in an org.
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
const per = await pool.query('SELECT id FROM "Person" WHERE "organizationId"=$1 AND name=$2', [oid, personName]);
const u = await pool.query(
  `UPDATE "Assignment" SET "personId"=$1, status='PENDING', "notifiedAt"=now()
   WHERE id IN (SELECT id FROM "Assignment" WHERE "serviceId" IN (SELECT id FROM "Service" WHERE "organizationId"=$2) LIMIT $3)
   RETURNING id, "positionName"`,
  [per.rows[0].id, oid, n]
);
console.log("pending now:", u.rows.map((r) => `${r.id} (${r.positionName})`));
await pool.end();
