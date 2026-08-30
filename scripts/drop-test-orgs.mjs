// One-off: remove deploy-test organizations from prod, respecting FK order.
// For every FK edge (child → parent) where the parent table has organizationId,
// delete child rows pointing at the orgs being removed; then the org-owned rows
// themselves, children-first.
import { Pool } from "pg";

const url = process.argv[2];
const names = process.argv.slice(3);
const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 1 });

const orgs = await pool.query('SELECT id FROM "Organization" WHERE name = ANY($1)', [names]);
const ids = orgs.rows.map((r) => r.id);
if (ids.length === 0) {
  console.log("nothing to delete");
  process.exit(0);
}

// FK edges within public schema
const fks = await pool.query(`
  SELECT replace(conrelid::regclass::text,'"','') AS child, replace(confrelid::regclass::text,'"','') AS parent,
         (SELECT a.attname FROM pg_attribute a
          WHERE a.attrelid = co.conrelid AND a.attnum = co.conkey[1] AND NOT a.attisdropped) AS col
  FROM pg_constraint co
  WHERE contype = 'f' AND connamespace = 'public'::regnamespace
`);

const tables = await pool.query(
  "SELECT table_name::text AS t FROM information_schema.tables WHERE table_schema = 'public'"
);
const allTables = tables.rows.map((r) => r.t);
const orgCols = new Set(); // tables having organizationId
for (const tb of allTables) {
  const c = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name='organizationId'`,
    [tb]
  );
  if (c.rowCount) orgCols.add(tb);
}

// topological order (children before parents) via DFS
const order = [];
const seen = new Set();
function visit(tb) {
  if (seen.has(tb)) return;
  seen.add(tb);
  for (const fk of fks.rows.filter((f) => f.child === tb)) visit(fk.parent);
  order.push(tb);
}
allTables.forEach(visit);

let deleted = 0;
for (const tb of [...order].reverse()) {
  if (tb === "Organization") continue;
  const conditions = [];
  if (orgCols.has(tb)) conditions.push(`"organizationId" = ANY($1)`);
  for (const fk of fks.rows.filter((f) => f.child === tb && orgCols.has(f.parent))) {
    const col = fk.col;
    conditions.push(
      `"${col}" IN (SELECT id FROM "${fk.parent}" WHERE "organizationId" = ANY($1))`
    );
  }
  if (conditions.length === 0) continue;
  const r = await pool.query(`DELETE FROM "${tb}" WHERE ${conditions.join(" OR ")}`, [ids]);
  deleted += r.rowCount;
}

const orgsDel = await pool.query('DELETE FROM "Organization" WHERE id = ANY($1) RETURNING name', [ids]);
await pool.query('DELETE FROM "Session" WHERE "userId" NOT IN (SELECT id FROM "User")');
console.log("removed orgs:", orgsDel.rows.map((r) => r.name).join(", "));
console.log("child rows deleted:", deleted);
const keep = await pool.query('SELECT name FROM "Organization"');
console.log("kept:", keep.rows.map((r) => r.name).join(", "));
await pool.end();
