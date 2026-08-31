import { Pool } from "pg";
const pool = new Pool({ connectionString: "postgresql://postgres.vmyondexswqbldxtsokj:M%40H%40adm!r21@aws-1-eu-west-1.pooler.supabase.com:6543/postgres", ssl: { rejectUnauthorized: false }, max: 1 });
const r = await pool.query('select status, note from "Assignment" where id=$1', [process.argv[2]]);
console.log("final state:", r.rows[0]);
await pool.end();
