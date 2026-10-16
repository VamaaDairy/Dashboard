/**
 * Turns the Recibo portal spec (src/app/md.md) into JSON the app is built from:
 *   src/lib/fp/spec/entities.json  - the data model (289 entities, every field and type)
 *   src/lib/fp/spec/routes.json    - every route: screen composition, grid columns, buttons, API calls
 *   src/lib/fp/spec/sidebar.json   - the sidebar tree and the admin menu
 *
 *   npx tsx tools/fp/parse-spec.ts
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const SRC = join(process.cwd(), "src/app/md.md");
const OUT = join(process.cwd(), "src/lib/fp/spec");
const lines = readFileSync(SRC, "utf8").split(/\r?\n/);

const find = (re: RegExp, from = 0) => {
  for (let i = from; i < lines.length; i++) if (re.test(lines[i])) return i;
  return -1;
};
const sidebarAt = find(/^# Sidebar menu/);
const routesAt = find(/^# Route details/);
const sharedAt = find(/^# Shared components/);
const apiAt = find(/^# Backend API reference/);
const modelAt = find(/^# Data model/);
const clientAt = find(/^# Client query field-sets/);

const splitDot = (s: string) => s.split(" · ").map((x) => x.trim()).filter(Boolean);

// ---------------------------------------------------------------- sidebar
interface SideItem { label: string; route: string; url: string; visible: string }
interface SideGroup { group: string; items: SideItem[] }
function parseSidebar() {
  const groups: SideGroup[] = [];
  const admin: SideItem[] = [];
  let cur: SideGroup | null = null;
  let inAdmin = false;
  for (let i = sidebarAt; i < routesAt; i++) {
    const l = lines[i];
    if (l.startsWith("## Admin menu")) { inAdmin = true; continue; }
    if (l.startsWith("## All routes")) break;
    const g = l.match(/^\*\*(.+)\*\*$/);
    if (g) { cur = { group: g[1], items: [] }; groups.push(cur); continue; }
    const it = l.match(/^- \[(.+?)\]\(#route-(.+?)\) → `(.+?)`(?:\s+— visible: (.*))?/);
    if (it) {
      const item = { label: it[1], route: it[2], url: it[3], visible: (it[4] ?? "").replace(/`$/, "") };
      if (inAdmin) admin.push(item); else cur?.items.push(item);
    }
  }
  return { groups, admin };
}

// ----------------------------------------------------------------- routes
interface Col { label: string; field: string | null }
interface Comp {
  tag: string; file: string; tabs: string[]; headings: string[]; formFields: string[]; gridColumns: Col[];
  buttons: string[]; dropdowns: string[]; libs: string[]; state: string[];
}
interface Api { action: string; fn: string; service: string; op: string; kind: string; returns: string }
interface Route {
  key: string; url: string; title: string; menu: string; gate: string; entry: string; serves: string; opsCount: number;
  components: Comp[]; apis: Api[]; shapes: Record<string, string>;
}

function parseCols(raw: string): Col[] {
  return splitDot(raw).map((p) => {
    const m = p.match(/^(.*?)\s*\(`(.*)`\)$/);
    return m ? { label: m[1].trim(), field: m[2] } : { label: p, field: null };
  });
}

function parseRoutes(): Route[] {
  const out: Route[] = [];
  const end = sharedAt;
  let i = routesAt;
  while (i < end) {
    const m = lines[i].match(/^<a id="route-(.+?)"><\/a>$/);
    if (!m) { i++; continue; }
    const route: Route = { key: m[1], url: "", title: "", menu: "", gate: "", entry: "", serves: "", opsCount: 0, components: [], apis: [], shapes: {} };
    i++;
    let comp: Comp | null = null;
    let mode: "meta" | "screen" | "api" | "shapes" = "meta";
    for (; i < end && !lines[i].startsWith('<a id="route-'); i++) {
      const l = lines[i];
      if (l.startsWith("## ")) { const h = l.match(/^## (.*?)\s+—\s+`(.+)`$/); if (h) { route.title = h[1].trim(); route.url = h[2]; } continue; }
      if (l.startsWith("### Screen composition")) { mode = "screen"; continue; }
      if (l.startsWith("### Backend API calls")) { mode = "api"; continue; }
      if (l.startsWith("### Data shapes")) { mode = "shapes"; continue; }
      const kv = l.match(/^\| \*\*(.+?)\*\* \| (.*) \|$/);
      if (kv && mode === "meta") {
        const v = kv[2].replace(/^`|`$/g, "");
        if (kv[1] === "Page title") route.title = route.title || v;
        if (kv[1] === "Menu location") route.menu = v.replace(/^_|_$/g, "");
        if (kv[1] === "Permission gate") route.gate = v;
        if (kv[1] === "Entry module") route.entry = v;
        if (kv[1] === "Same component also serves") route.serves = v;
        if (kv[1] === "Backend ops") route.opsCount = Number(v) || 0;
        continue;
      }
      if (mode === "screen") {
        const c = l.match(/^##### `<(.+?)>` — `(.+?)`/);
        if (c) {
          comp = { tag: c[1], file: c[2], tabs: [], headings: [], formFields: [], gridColumns: [], buttons: [], dropdowns: [], libs: [], state: [] };
          route.components.push(comp);
          continue;
        }
        if (!comp) continue;
        const f = l.match(/^- \*\*(.+?):\*\*\s?(.*)$/);
        if (!f) continue;
        const [, k, v] = f;
        if (k.startsWith("Tabs")) comp.tabs = splitDot(v);
        else if (k.startsWith("Headings")) comp.headings = splitDot(v);
        else if (k.startsWith("Form fields")) comp.formFields = splitDot(v);
        else if (k.startsWith("Grid columns")) comp.gridColumns = parseCols(v);
        else if (k.startsWith("Buttons")) comp.buttons = splitDot(v);
        else if (k.startsWith("Dropdown")) comp.dropdowns = splitDot(v);
        else if (k.startsWith("Libraries")) comp.libs = v.split(",").map((x) => x.trim()).filter(Boolean);
        else if (k.startsWith("State")) comp.state = [...v.matchAll(/`(.+?)`/g)].map((x) => x[1]);
      } else if (mode === "api") {
        const r = l.match(/^\| ([^|]+?) \| `(.+?)` \| `(.+?)` \| `(.+?)` \| (\w+) \| (.*) \|$/);
        if (r && r[1] !== "Action (redux thunk)") route.apis.push({ action: r[1].trim(), fn: r[2], service: r[3], op: r[4], kind: r[5], returns: r[6].replace(/`/g, "").trim() });
      } else if (mode === "shapes") {
        const s = l.match(/^- \*\*`(.+?)`\*\*: (.*)$/);
        if (s) route.shapes[s[1]] = s[2];
      }
    }
    out.push(route);
  }
  return out;
}

// ----------------------------------------------------------------- entities
interface Field { name: string; type: string; required: boolean; list: boolean; args: string | null }
interface Entity { name: string; services: string[]; fields: Field[] }

function parseEntities(): Entity[] {
  const out: Entity[] = [];
  let cur: Entity | null = null;
  for (let i = modelAt; i < clientAt; i++) {
    const l = lines[i];
    const h = l.match(/^#### `(.+?)`\s+_\(services: (.*)\)_$/);
    if (h) { cur = { name: h[1], services: h[2].split(",").map((s) => s.trim()), fields: [] }; out.push(cur); continue; }
    const f = l.match(/^\| (.+?) \| `(.+)` \|$/);
    if (f && cur && f[1] !== "Field") {
      const nameArgs = f[1].match(/^([A-Za-z0-9_]+)(?:\((.*)\))?$/);
      if (!nameArgs) continue;
      const t = f[2];
      cur.fields.push({ name: nameArgs[1], type: t.replace(/[\[\]!]/g, ""), required: t.endsWith("!") && !t.startsWith("["), list: t.startsWith("["), args: nameArgs[2] ?? null });
    }
  }
  return out;
}

// ----------------------------------------------------------------- run
mkdirSync(OUT, { recursive: true });
const sidebar = parseSidebar();
const routes = parseRoutes();
const entities = parseEntities();
writeFileSync(join(OUT, "sidebar.json"), JSON.stringify(sidebar, null, 1));
writeFileSync(join(OUT, "routes.json"), JSON.stringify(routes, null, 1));
writeFileSync(join(OUT, "entities.json"), JSON.stringify(entities, null, 1));
const cols = routes.reduce((n, r) => n + r.components.reduce((m, c) => m + c.gridColumns.length, 0), 0);
console.log(`sidebar: ${sidebar.groups.length} groups, ${sidebar.groups.reduce((n, g) => n + g.items.length, 0)} items, ${sidebar.admin.length} admin`);
console.log(`routes: ${routes.length} (${routes.filter((r) => r.components.length).length} with components), ${cols} grid columns, ${routes.reduce((n, r) => n + r.apis.length, 0)} api rows`);
console.log(`entities: ${entities.length}, ${entities.reduce((n, e) => n + e.fields.length, 0)} fields, ${entities.filter((e) => e.fields.some((f) => f.name === "uid")).length} with uid`);
// compact list for access control and the sidebar (the full routes.json is too big for client code)
const groupOf = new Map<string, string>();
for (const g of sidebar.groups) for (const it of g.items) if (!groupOf.has(it.route)) groupOf.set(it.route, g.group);
for (const it of sidebar.admin) if (!groupOf.has(it.route)) groupOf.set(it.route, "Admin");
const resources = routes.map((r) => ({ key: "fp." + r.key, label: r.title || r.key, group: groupOf.get(r.key) ?? "Other screens", slug: r.url.replace(/^\//, "") }));
writeFileSync(join(OUT, "resources.json"), JSON.stringify(resources));
console.log(`resources: ${resources.length}`);
void apiAt;
