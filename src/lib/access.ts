/**
 * What there is to give access to, and how a path maps onto it. Pure - the
 * proxy, the sidebar and the user-management page all share it.
 *
 * Owners can do everything. Everyone else has, per resource, no access (the
 * default), "view" (pages open, nothing can be changed) or "edit".
 */
import ordersResources from "./orders/resources.json";

export type Level = "none" | "view" | "edit";
export type AccessMap = Record<string, Level>;

export interface Resource {
  key: string;
  label: string;
  group: string;
  /** Path prefix; the longest matching one wins, so /daily/sku is not covered by /daily. */
  path: string;
}

export const RESOURCES: Resource[] = [
  { key: "today", label: "Today", group: "Everyday", path: "/" },
  { key: "procurement", label: "Milk in - overview", group: "Milk in", path: "/procurement" },
  { key: "procurement.collections", label: "Collections", group: "Milk in", path: "/procurement/vamaa" },
  { key: "procurement.rates", label: "Rate chart", group: "Milk in", path: "/procurement/rate-chart" },
  { key: "procurement.dashboard", label: "Dashboard", group: "Milk in", path: "/procurement/dashboard" },
  { key: "farmers", label: "Farmers", group: "Everyday", path: "/farmers" },
  { key: "tanks", label: "Tanks - daily", group: "Tanks", path: "/tanks" },
  { key: "tanks.dashboard", label: "Dashboard", group: "Tanks", path: "/tanks/dashboard" },
  { key: "production", label: "Daily batches", group: "Production", path: "/daily" },
  { key: "production.sku", label: "SKU packing", group: "Production", path: "/daily/sku" },
  { key: "production.products", label: "Products & ingredients", group: "Production", path: "/daily/products" },
  { key: "production.dashboard", label: "Dashboard", group: "Production", path: "/daily/dashboard" },
  { key: "fuel", label: "Fuel - overview", group: "Fuel", path: "/fuel" },
  { key: "fuel.milk", label: "Milk to plant", group: "Fuel", path: "/fuel/milk-to-plant" },
  { key: "fuel.delivery", label: "Delivery outside plant", group: "Fuel", path: "/fuel/delivery" },
  { key: "fuel.production", label: "Production in plant", group: "Fuel", path: "/fuel/production" },
  { key: "fuel.dashboard", label: "Dashboard", group: "Fuel", path: "/fuel/dashboard" },
  { key: "transport", label: "Transport - overview", group: "Transport", path: "/transport" },
  { key: "transport.milk", label: "Milk to plant", group: "Transport", path: "/transport/milk-to-plant" },
  { key: "transport.delivery", label: "Delivery outside plant", group: "Transport", path: "/transport/delivery" },
  { key: "labour", label: "Labour", group: "Everyday", path: "/labour" },
  { key: "electricity", label: "Electricity", group: "Everyday", path: "/electricity" },
  { key: "creditnote", label: "Credit notes", group: "Credit notes", path: "/credit-note" },
  { key: "creditnote.dashboard", label: "Dashboard", group: "Credit notes", path: "/credit-note/dashboard" },
  { key: "cn", label: "Complaints & CN", group: "CN Management", path: "/cn" },
  { key: "cn.approve", label: "Approvals (needs Complaints & CN too)", group: "CN Management", path: "/cn/approvals" },
  { key: "cn.finance", label: "Finance posting (needs Complaints & CN too)", group: "CN Management", path: "/cn/finance" },
  { key: "cn.dashboard", label: "Dashboard", group: "CN Management", path: "/cn/dashboard" },
  { key: "orders", label: "Orders - overview", group: "Orders", path: "/orders" },
  { key: "whatsapp", label: "WhatsApp shop", group: "Everyday", path: "/whatsapp" },
  { key: "shop", label: "Online shop orders", group: "Everyday", path: "/shop-orders" },
  { key: "apporders", label: "App orders (D2C, retailers, distributors)", group: "Everyday", path: "/app-orders" },
  { key: "pricelist", label: "Price list (customer prices)", group: "Everyday", path: "/price-list" },
  { key: "outstandings", label: "Outstandings", group: "Everyday", path: "/outstandings" },
  { key: "grn", label: "POD", group: "Everyday", path: "/pod" },
  // every Orders screen is its own resource
  ...(ordersResources as Array<{ key: string; label: string; group: string; slug: string }>).map((r) => ({
    key: r.key, label: r.label, group: `Orders - ${r.group}`, path: `/orders/${r.slug}`,
  })),
  { key: "masters", label: "Ingredients, packaging & other masters", group: "Rates & masters", path: "/c" },
  { key: "reports", label: "Reports", group: "Setup", path: "/reports" },
  { key: "audit", label: "Change log", group: "Setup", path: "/audit" },
];

export const GROUPS = [...new Set(RESOURCES.map((r) => r.group))];

/** Pages only owners may open. */
const OWNER_ONLY = ["/users"];
/** Pages any signed-in user may open. */
const OPEN = ["/no-access", "/profile"];

const under = (path: string, prefix: string) =>
  prefix === "/" ? path === "/" : path === prefix || path.startsWith(prefix + "/");

export type Match = { kind: "open" } | { kind: "owner" } | { kind: "resource"; key: string };

/** Which resource a request path belongs to. Paths that match nothing are owner-only. */
export function matchPath(pathname: string): Match {
  if (OPEN.some((p) => under(pathname, p))) return { kind: "open" };
  if (OWNER_ONLY.some((p) => under(pathname, p))) return { kind: "owner" };
  let best: Resource | null = null;
  for (const r of RESOURCES) {
    if (under(pathname, r.path) && (!best || r.path.length > best.path.length)) best = r;
  }
  return best ? { kind: "resource", key: best.key } : { kind: "owner" };
}

const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };
export const atLeast = (have: Level, need: Level) => RANK[have] >= RANK[need];

export function levelFor(user: { role: string; access: AccessMap }, key: string): Level {
  if (user.role === "owner") return "edit";
  const l = user.access[key];
  return l === "view" || l === "edit" ? l : "none";
}

/** Every resource's effective level - what the sidebar needs to decide what to show. */
export function levelsFor(user: { role: string; access: AccessMap }): AccessMap {
  return Object.fromEntries(RESOURCES.map((r) => [r.key, levelFor(user, r.key)]));
}

/** Keeps only known resources with a real level; drops "none". Untrusted input goes through this. */
export function cleanAccess(raw: unknown): AccessMap {
  const out: AccessMap = {};
  if (!raw || typeof raw !== "object") return out;
  const known = new Set(RESOURCES.map((r) => r.key));
  for (const [k, v] of Object.entries(raw)) {
    if (known.has(k) && (v === "view" || v === "edit")) out[k] = v;
  }
  return out;
}

/** Where to send someone who can't open the page they asked for. */
export function firstAllowedPath(user: { role: string; access: AccessMap }): string {
  const hit = RESOURCES.find((r) => levelFor(user, r.key) !== "none");
  return hit ? hit.path : "/no-access";
}
