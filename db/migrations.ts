/**
 * Which migrations a database has, and applying the ones it doesn't.
 *
 * Every db/NNN_*.sql file is a migration, applied in filename order and
 * recorded in `schema_migrations` in the same transaction - so a file either
 * applied completely and is recorded, or not at all. Running setup again on
 * any database only applies the files it hasn't had yet.
 *
 * Databases built before this ledger existed have the schema but no record of
 * it. The first time one is seen, each file is checked for the first table,
 * view or index it creates: if that already exists the file is recorded as
 * applied without running it again, otherwise it is applied.
 */
import type { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const DB_DIR = join(process.cwd(), "db");

/** Every NNN_*.sql in db/, in the order they apply. */
export function migrationFiles(): string[] {
  return readdirSync(DB_DIR).filter((f) => /^\d{3}_.*\.sql$/.test(f)).sort();
}

export function readMigration(file: string): string {
  return readFileSync(join(DB_DIR, file), "utf8");
}

export async function ensureLedger(db: Client) {
  await db.query(
    `create table if not exists schema_migrations (
       filename    text primary key,
       applied_at  timestamptz not null default now()
     )`,
  );
}

export async function appliedMigrations(db: Client): Promise<Set<string>> {
  const { rows } = await db.query<{ filename: string }>(`select filename from schema_migrations`);
  return new Set(rows.map((r) => r.filename));
}

/** Runs one migration and records it, together or not at all. */
export async function applyMigration(db: Client, file: string) {
  await db.query("begin");
  try {
    await db.query(readMigration(file));
    await db.query(
      `insert into schema_migrations (filename) values ($1) on conflict (filename) do nothing`,
      [file],
    );
    await db.query("commit");
  } catch (e) {
    await db.query("rollback");
    throw new Error(`${file}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** The first table, view or index a migration creates - how an unrecorded, already-applied file is recognised. */
function firstCreated(sql: string): string | null {
  const noComments = sql.replace(/--.*$/gm, "");
  const m = noComments.match(/create\s+(?:or\s+replace\s+)?(?:unique\s+)?(?:table|view|index)\s+(?:if\s+not\s+exists\s+)?([a-z_][a-z0-9_]*)/i);
  return m ? m[1] : null;
}

/**
 * Brings the database up to date: applies every migration it hasn't had.
 * Returns what happened to each file.
 */
export async function migrate(db: Client): Promise<{ file: string; action: "applied" | "recorded" | "skipped" }[]> {
  await ensureLedger(db);
  const done = await appliedMigrations(db);

  // A database built before the ledger: record what's already there instead of re-running it.
  const { rows } = await db.query<{ t: string | null }>(`select to_regclass('public.scenario')::text as t`);
  const legacy = done.size === 0 && rows[0].t !== null;

  const out: { file: string; action: "applied" | "recorded" | "skipped" }[] = [];
  for (const file of migrationFiles()) {
    if (done.has(file)) { out.push({ file, action: "skipped" }); continue; }
    if (legacy) {
      const name = firstCreated(readMigration(file));
      const exists = name
        ? (await db.query<{ t: string | null }>(`select to_regclass($1)::text as t`, [`public.${name}`])).rows[0].t !== null
        : false;
      if (exists) {
        await db.query(`insert into schema_migrations (filename) values ($1) on conflict do nothing`, [file]);
        out.push({ file, action: "recorded" });
        continue;
      }
    }
    await applyMigration(db, file);
    out.push({ file, action: "applied" });
  }
  return out;
}
