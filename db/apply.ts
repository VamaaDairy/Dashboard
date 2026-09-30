/**
 * Applies one db/*.sql file to DATABASE_URL and records it in
 * schema_migrations. A file already recorded is refused, so it can't be run
 * twice by accident. Usually unnecessary - `npm run db:setup` applies every
 * migration a database hasn't had yet.
 *
 *   npm run db:apply -- 008_farmer_transporter.sql
 */
import "dotenv/config";
import { Client } from "pg";
import { appliedMigrations, applyMigration, ensureLedger, migrationFiles } from "./migrations";

const file = process.argv[2];
if (!file) {
  console.error("usage: npm run db:apply -- <file-in-db-dir>");
  process.exit(1);
}

async function main() {
  if (!migrationFiles().includes(file)) throw new Error(`${file} is not a migration in db/`);
  const client = new Client({
    connectionString: process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp",
  });
  await client.connect();
  try {
    await ensureLedger(client);
    if ((await appliedMigrations(client)).has(file)) {
      console.log(`${file} is already applied - nothing to do`);
      return;
    }
    await applyMigration(client, file);
    console.log(`applied ${file}`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
