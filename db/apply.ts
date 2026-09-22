/**
 * Applies one db/*.sql file directly against DATABASE_URL, bypassing the
 * "skip if the schema already exists" guard in db/setup.ts. For adding a new
 * migration to a database that has already been set up, without --reset
 * destroying what is in it.
 *
 *   npm run db:apply -- 004_tanks.sql
 */
import "dotenv/config";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run db:apply -- <file-in-db-dir>");
  process.exit(1);
}

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp",
  });
  await client.connect();
  try {
    await client.query(readFileSync(join(process.cwd(), "db", file), "utf8"));
    console.log(`applied ${file}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
