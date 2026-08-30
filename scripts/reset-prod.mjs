// One-off: truncate all public tables in the production Supabase (used to
// remove deploy-test rows so the user starts with a clean slate).
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const url = process.argv[2];
if (!url) {
  console.error("usage: node scripts/reset-prod.mjs <postgres-url>");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: url });
const prisma = new PrismaClient({ adapter });

const rows = await prisma.$queryRawUnsafe(
  "SELECT table_name::text AS t FROM information_schema.tables WHERE table_schema = 'public'"
);
const list = rows.map((r) => `"${r.t}"`).join(", ");
console.log(`truncating ${rows.length} tables…`);
await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} CASCADE`);

console.log("orgs:", await prisma.organization.count(), "| users:", await prisma.user.count());
await prisma.$disconnect();
