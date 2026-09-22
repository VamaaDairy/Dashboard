/**
 * Builds the local Postgres database from nothing.
 *
 *   npm run db:setup           # create db if absent, apply migrations, bootstrap
 *   npm run db:setup -- --reset  # drop every table first, then the same
 *
 * What it leaves behind is the *whole* structure and none of the content: all
 * the tables, views and functions in db/*.sql, plus exactly two rows that the
 * app cannot boot without - one empty scenario to hang the model off, and one
 * login. No classes, no fields, no parameters, no objects, no BOM lines, no
 * procurement or daily records. Those you create from the UI.
 *
 * Unlike db/seed.ts this never writes cost data, so it is safe to re-run: the
 * migrations are skipped when the schema is already there and the bootstrap
 * rows are only inserted when missing. Only --reset destroys anything.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const DB_DIR = join(process.cwd(), "db");
const URL_STR = process.env.DATABASE_URL ?? "postgres://localhost:5432/costing_erp";
const RESET = process.argv.includes("--reset");

// The database we are building, and the maintenance database we have to be
// connected to in order to create it (you cannot `create database` from inside
// the database being created).
const dbUrl = new URL(URL_STR);
const dbName = decodeURIComponent(dbUrl.pathname.replace(/^\//, "")) || "costing_erp";
const adminUrl = new URL(URL_STR);
adminUrl.pathname = "/postgres";

const connect = async (url: string) => {
  const c = new Client({ connectionString: url });
  await c.connect();
  return c;
};

/** Migrations are every NNN_*.sql in db/, applied in filename order. */
function migrations() {
  return readdirSync(DB_DIR)
    .filter((f) => /^\d{3}_.*\.sql$/.test(f))
    .sort();
}

async function ensureDatabase() {
  const admin = await connect(adminUrl.toString());
  try {
    const { rowCount } = await admin.query("select 1 from pg_database where datname = $1", [dbName]);
    if (rowCount) {
      console.log(`database ${dbName} already exists`);
      return false;
    }
    // Identifier, so it cannot be parameterised - quote it instead.
    await admin.query(`create database "${dbName.replace(/"/g, '""')}"`);
    console.log(`created database ${dbName}`);
    return true;
  } finally {
    await admin.end();
  }
}

async function applyMigrations(db: Client) {
  if (RESET) {
    await db.query("drop schema public cascade; create schema public");
    console.log("dropped and recreated schema public");
  } else {
    const { rows } = await db.query("select to_regclass('public.scenario') as t");
    if (rows[0].t) {
      console.log("schema already applied - skipping migrations (use --reset to rebuild)");
      return;
    }
  }

  for (const file of migrations()) {
    await db.query(readFileSync(join(DB_DIR, file), "utf8"));
    console.log(`applied ${file}`);
  }
}

/**
 * The two rows the app genuinely cannot start without. Everything the costing
 * model is made of stays empty.
 */
async function bootstrap(db: Client) {
  const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
  const password = process.env.ADMIN_PASSWORD ?? "costing123";
  const name = process.env.ADMIN_NAME ?? "Admin";
  const code = process.env.SCENARIO_CODE ?? "base";

  const user = await db.query<{ id: string; fresh: boolean }>(
    `insert into app_user (email, name, role, password_hash)
     values ($1, $2, 'owner', $3)
     on conflict (email) do update set email = excluded.email
     returning id, (xmax = 0) as fresh`,
    [email, name, await bcrypt.hash(password, 10)],
  );
  console.log(user.rows[0].fresh ? `created login ${email}` : `login ${email} already exists`);

  const scenario = await db.query<{ code: string; fresh: boolean }>(
    `insert into scenario (code, name, description, status, created_by)
     values ($1, $2, $3, 'active', $4)
     on conflict (code) do update set code = excluded.code
     returning code, (xmax = 0) as fresh`,
    [
      code,
      process.env.SCENARIO_NAME ?? "Base model",
      "Empty model. Add classes, fields, parameters and objects from the app.",
      user.rows[0].id,
    ],
  );
  console.log(
    scenario.rows[0].fresh ? `created empty scenario "${code}"` : `scenario "${code}" already exists`,
  );
}

/** Proves the structure is all there and the content is not. */
async function report(db: Client) {
  const { rows } = await db.query<{ tables: number; views: number; functions: number }>(
    `select (select count(*) from information_schema.tables
              where table_schema = 'public' and table_type = 'BASE TABLE')::int as tables,
            (select count(*) from information_schema.views
              where table_schema = 'public')::int as views,
            (select count(*) from information_schema.routines
              where routine_schema = 'public')::int as functions`,
  );
  const { tables, views, functions } = rows[0];
  console.log(`\nschema: ${tables} tables, ${views} views, ${functions} functions`);

  // Row counts across every base table, so "zero seeded data" is verifiable
  // rather than asserted.
  const { rows: names } = await db.query<{ t: string }>(
    `select table_name as t from information_schema.tables
      where table_schema = 'public' and table_type = 'BASE TABLE' order by table_name`,
  );
  // Sequential: one Client cannot have two queries in flight.
  const counts: { t: string; n: number }[] = [];
  for (const { t } of names) {
    const r = await db.query<{ n: number }>(`select count(*)::int as n from "${t}"`);
    counts.push({ t, n: r.rows[0].n });
  }
  const nonEmpty = counts.filter((c) => c.n > 0);
  console.log(
    `data:   ${counts.reduce((a, c) => a + c.n, 0)} rows total` +
      (nonEmpty.length ? ` (${nonEmpty.map((c) => `${c.t}=${c.n}`).join(", ")})` : ""),
  );
}

async function main() {
  await ensureDatabase();
  const db = await connect(dbUrl.toString());
  try {
    await applyMigrations(db);
    await bootstrap(db);
    await report(db);
  } finally {
    await db.end();
  }
  console.log("\nready - npm run dev");
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
