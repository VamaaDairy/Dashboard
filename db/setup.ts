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
 * Unlike db/seed.ts this never writes cost data, so it is safe to re-run: only
 * migrations the database hasn't had yet are applied (see db/migrations.ts),
 * and the bootstrap rows are only inserted when missing. Only --reset
 * destroys anything.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { Client } from "pg";
import { migrate } from "./migrations";

// On Vercel there is no local database to fall back to: without DATABASE_URL the
// build would only fail later with "connection refused", so say what's missing.
if (!process.env.DATABASE_URL && process.env.VERCEL) {
  console.error(
    "DATABASE_URL is not set for this deployment. Add it in Vercel -> Project -> Settings -> " +
      "Environment Variables (tick Production and Preview), then redeploy.",
  );
  process.exit(1);
}
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

async function ensureDatabase() {
  // Hosted Postgres (Neon, Supabase, Vercel...) hands out a database that
  // already exists and often won't let you reach the maintenance one - then
  // there is nothing to create, so carry on with the database we were given.
  let admin: Client;
  try {
    admin = await connect(adminUrl.toString());
  } catch {
    console.log(`can't reach the maintenance database - using ${dbName} as it is`);
    return false;
  }
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

/** Applies whatever migrations this database hasn't had yet - all of them on a new one. */
async function applyMigrations(db: Client) {
  if (RESET) {
    await db.query("drop schema public cascade; create schema public");
    console.log("dropped and recreated schema public");
  }

  const results = await migrate(db);
  for (const r of results) {
    if (r.action === "applied") console.log(`applied ${r.file}`);
    if (r.action === "recorded") console.log(`${r.file} was already in the database - recorded it`);
  }
  if (results.every((r) => r.action === "skipped")) console.log("schema up to date - no new migrations");
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
