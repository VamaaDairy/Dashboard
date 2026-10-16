import modelJson from "./spec/model.json";
import routesJson from "./spec/routes.json";
import sidebarJson from "./spec/sidebar.json";
import entitiesJson from "./spec/entities.json";

/** The portal's data model, resolved to tables: src/lib/fp/spec/model.json (built by tools/fp/gen-schema.ts). */
export interface ModelCol { field: string; col: string; sql: string; required: boolean; fk?: string }
export interface ModelTable {
  entity: string; table: string; pk: string; columns: ModelCol[];
  relations: Record<string, { fk: string; target: string }>;
}
export interface SpecCol { label: string; field: string | null }
export interface SpecComp {
  tag: string; file: string; tabs: string[]; headings: string[]; formFields: string[]; gridColumns: SpecCol[];
  buttons: string[]; dropdowns: string[]; libs: string[]; state: string[];
}
export interface SpecApi { action: string; fn: string; service: string; op: string; kind: string; returns: string }
export interface SpecRoute {
  key: string; url: string; title: string; menu: string; gate: string; entry: string; serves: string; opsCount: number;
  components: SpecComp[]; apis: SpecApi[]; shapes: Record<string, string>;
}
export interface SideItem { label: string; route: string; url: string; visible: string }
export interface SideGroup { group: string; items: SideItem[] }
export interface SpecEntity { name: string; services: string[]; fields: Array<{ name: string; type: string; required: boolean; list: boolean; args: string | null }> }

export const MODEL = modelJson as unknown as Record<string, ModelTable>;
export const ROUTES = routesJson as unknown as SpecRoute[];
export const SIDEBAR = sidebarJson as unknown as { groups: SideGroup[]; admin: SideItem[] };
export const ENTITIES = entitiesJson as unknown as SpecEntity[];

export const routeByKey = (key: string) => ROUTES.find((r) => r.key === key);
/** /fp/<this> for a route; kpi-dashboard style keys keep their dash. */
export const routeSlug = (r: { url: string }) => r.url.replace(/^\//, "");
export const routeBySlug = (slug: string) => ROUTES.find((r) => routeSlug(r) === slug);
export const fpHref = (r: { url: string }) => `/fp/${routeSlug(r)}`;

export const q = (s: string) => `"${s}"`;

/** Table name for an entity (case-insensitive: the schemas spell firm / Firm both ways). */
const lower = new Map(Object.keys(MODEL).map((k) => [k.toLowerCase(), k]));
export const tableFor = (entity: string): ModelTable | undefined => MODEL[entity] ?? MODEL[lower.get(entity.toLowerCase()) ?? ""];
