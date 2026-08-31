import { Pool } from "pg";
const pool = new Pool({
  connectionString: "postgresql://postgres.vmyondexswqbldxtsokj:M%40H%40adm!r21@aws-1-eu-west-1.pooler.supabase.com:6543/postgres",
  ssl: { rejectUnauthorized: false }, max: 1,
});
await pool.query('UPDATE "Assignment" SET status=$1, "respondedAt"=null, note=null WHERE id=$2', ["PENDING", process.argv[2]]);
console.log("reset to PENDING");
await pool.end();
