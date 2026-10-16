/**
 * Builds the real database for the portal from the parsed data model:
 *   db/042_fp_schema.sql               - one table per entity that is stored (fp_<snake_name>)
 *   src/lib/fp/spec/model.json         - table / column / foreign-key map the app queries through
 *
 * An entity is a stored table if it has a `uid`, or it is one of the small masters (state, country...).
 * The rest of the 289 are report / dashboard result shapes - they are computed from the tables, not stored.
 *
 *   npx tsx tools/fp/gen-schema.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

interface Field { name: string; type: string; required: boolean; list: boolean; args: string | null }
interface Entity { name: string; services: string[]; fields: Field[] }

const root = process.cwd();
const raw: Entity[] = JSON.parse(readFileSync(join(root, "src/lib/fp/spec/entities.json"), "utf8"));
// the schemas spell a few names two ways (firm / Firm): one table, the union of the fields
const entities: Entity[] = [];
for (const e of raw) {
  const same = entities.find((x) => x.name.toLowerCase() === e.name.toLowerCase());
  if (!same) { entities.push({ ...e, fields: [...e.fields] }); continue; }
  for (const f of e.fields) if (!same.fields.some((x) => x.name === f.name)) same.fields.push(f);
}
// field types that point at the other spelling
const alias = new Map(raw.map((e) => [e.name, entities.find((x) => x.name.toLowerCase() === e.name.toLowerCase())!.name]));
for (const e of entities) for (const f of e.fields) f.type = alias.get(f.type) ?? f.type;

/** Masters with no uid that still need a table. */
const NATURAL = new Set(["state", "country", "team", "division", "outletType", "leaveType", "chain", "cluster", "beatFrequency"]);
const isTable = (e: Entity) => e.fields.some((f) => f.name === "uid") || NATURAL.has(e.name);

export const snake = (s: string) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2").toLowerCase();

const tables = entities.filter(isTable);
const byName = new Map(tables.map((e) => [e.name, e]));
const q = (s: string) => `"${s}"`;

const SQL_TYPE: Record<string, string> = {
  String: "text", Int: "integer", Float: "double precision", Boolean: "boolean", Date: "timestamptz",
  SequelizeJSON: "jsonb", BigInt: "bigint", ID: "text",
};

interface Col { field: string; col: string; sql: string; required: boolean; fk?: string }
interface Tbl { entity: string; table: string; pk: string; columns: Col[]; relations: Record<string, { fk: string; target: string }> }

const model: Record<string, Tbl> = {};
const ddl: string[] = [];
const fkDdl: string[] = [];
const idx: string[] = [];

for (const e of tables) {
  const table = "fp_" + snake(e.name);
  const hasUid = e.fields.some((f) => f.name === "uid");
  const cols: Col[] = [];
  const rel: Tbl["relations"] = {};
  const names = new Set(e.fields.map((f) => f.name));
  const lines: string[] = [];

  if (!hasUid) lines.push(`  ${q("id")} bigserial primary key`);

  for (const f of e.fields) {
    // relation to another entity: stored through <name>Uid on this table
    if (byName.has(f.type) || entities.some((x) => x.name === f.type)) {
      if (!f.list && names.has(f.name + "Uid") && byName.has(f.type)) rel[f.name] = { fk: f.name + "Uid", target: f.type };
      continue;
    }
    const sql = SQL_TYPE[f.type] ?? (f.list ? "jsonb" : "text");
    const isList = f.list;
    let type = isList ? "jsonb" : sql;
    const col = snake(f.name);
    let line = `  ${q(col)} `;
    if (f.name === "uid") {
      line += "uuid primary key default gen_random_uuid()";
      type = "uuid";
    } else if (/Uid$/.test(f.name) && !isList) {
      type = "uuid";
      line += "uuid";
      if (f.required) line += " not null";
    } else if (f.name === "createdAt" || f.name === "updatedAt") {
      line += "timestamptz not null default now()";
    } else {
      line += type;
      if (f.required && !isList) line += " not null";
    }
    lines.push(line);
    cols.push({ field: f.name, col, sql: type, required: f.required });
  }

  // foreign keys: explicit relation first, else <entity>Uid naming
  for (const c of cols) {
    if (!/Uid$/.test(c.field) || c.field === "uid") continue;
    const base = c.field.slice(0, -3);
    const viaRel = rel[base]?.target;
    const target = viaRel ?? (byName.has(base) ? base : null);
    if (!target || !byName.get(target)?.fields.some((f) => f.name === "uid")) continue;
    c.fk = target;
    if (!rel[base]) rel[base] = { fk: c.field, target };
    fkDdl.push(`alter table ${q(table)} add constraint ${q(`${table}_${c.col}_fk`.slice(0, 62))} foreign key (${q(c.col)}) references ${q("fp_" + snake(target))} (${q("uid")}) on delete ${c.required ? "restrict" : "set null"};`);
    idx.push(`create index ${q(`${table}_${c.col}_ix`.slice(0, 62))} on ${q(table)} (${q(c.col)});`);
  }

  ddl.push(`create table ${q(table)} (\n${lines.join(",\n")}\n);`);
  model[e.name] = { entity: e.name, table, pk: hasUid ? "uid" : "id", columns: cols, relations: rel };
}

const header = `-- Generated by tools/fp/gen-schema.ts from the portal spec (src/app/md.md). Do not edit by hand.
-- ${tables.length} tables; every foreign key is added after all tables exist.
`;
writeFileSync(join(root, "db/042_fp_schema.sql"), header + "\n" + ddl.join("\n\n") + "\n\n" + fkDdl.join("\n") + "\n\n" + idx.join("\n") + "\n");
writeFileSync(join(root, "src/lib/fp/spec/model.json"), JSON.stringify(model, null, 1));
console.log(`tables: ${tables.length}, fks: ${fkDdl.length}, columns: ${Object.values(model).reduce((n, t) => n + t.columns.length, 0)}`);
