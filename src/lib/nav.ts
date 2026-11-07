/**
 * The sidebar, split into sections (Plant, Logistics, D2C, Distributor & Retail, MIS, Admin).
 * Only one section shows at a time; the switcher at the top of the sidebar changes it.
 *
 * Orders pages that are still empty placeholders never show in a working section: they are
 * listed under "Not in use" (owner only), together with any built Orders page that no section
 * links to. Which pages are placeholders comes from src/lib/nav-unbuilt.json - after building
 * one, run `node scripts/nav-audit.mjs` and add it to the section where it belongs.
 */
import {
  Archive, BarChart3, Beaker, Bike, Boxes, CalendarDays, ClipboardCheck, Contact, Cylinder, Database, Droplets, Factory,
  FileClock, Fuel, Gift, Home, MapPin, MapPinned, MessageCircle, Network, Package, PackageCheck, PackageSearch,
  ReceiptText, Route, Scale, Settings2, ShoppingBag, Smartphone, Store, Tags, Target, Truck, UserPlus, Users, Warehouse, Zap,
} from "lucide-react";
import ordersSidebar from "@/lib/orders/sidebar.json";
import unbuilt from "@/lib/nav-unbuilt.json";

export interface NavLeaf { href: string; key: string; label: string; exact?: boolean }
export interface NavItem {
  href: string; key: string; label: string; icon: React.ElementType; exact?: boolean;
  /** shown only to the owner, whatever the access levels say */
  ownerOnly?: boolean;
  children?: NavLeaf[];
}
export interface NavGroup { label: string; items: NavItem[]; /** rate & master classes from the model go here */ classes?: boolean }
export interface NavSection { id: string; label: string; icon: React.ElementType; groups: NavGroup[]; ownerOnly?: boolean }

export const CLASS_ICONS: Record<string, React.ElementType> = {
  milk_batch: Droplets, ingredient: Beaker, packaging: Boxes, recipe: Package, product: Package,
};

/* ---------- Orders module pages ---------- */
type OrdersGroup = { group: string; items: Array<{ label: string; route: string; url: string }> };
const ORDERS_GROUPS = (ordersSidebar as { groups: OrdersGroup[] }).groups;
const ORDERS_LABEL = new Map<string, string>();
for (const g of ORDERS_GROUPS) for (const i of g.items) {
  const slug = i.url.slice(1);
  if (!ORDERS_LABEL.has(slug)) ORDERS_LABEL.set(slug, i.label);
}
const STUBS = new Set<string>(unbuilt.stubs);
const humanize = (slug: string) =>
  slug.replace(/^fp|^tc/, (m) => m.toUpperCase() + " ").replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()).trim();
const ordersLeaf = (slug: string, label?: string): NavLeaf =>
  ({ href: `/orders/${slug}`, key: `fp.${slug}`, label: label ?? ORDERS_LABEL.get(slug) ?? humanize(slug) });
/** An Orders sub-menu; placeholder pages are dropped (they live under "Not in use"). */
const orders = (label: string, icon: React.ElementType, slugs: Array<string | [string, string]>): NavItem | null => {
  const children = slugs
    .map((s) => (typeof s === "string" ? ordersLeaf(s) : ordersLeaf(s[0], s[1])))
    .filter((l) => !STUBS.has(l.href.slice("/orders/".length)));
  return children.length ? { href: children[0].href, key: `orders.${label}`, label, icon, children } : null;
};
const items = (...list: Array<NavItem | null>) => list.filter((i): i is NavItem => !!i);

/* ---------- the sections ---------- */
const WORKING: NavSection[] = [
  {
    id: "plant", label: "Plant & Production", icon: Factory,
    groups: [
      {
        label: "Every day",
        items: [
          { href: "/", key: "today", label: "Today", icon: Home, exact: true },
          {
            href: "/procurement/vamaa", key: "procurement", label: "Milk in", icon: Droplets,
            children: [
              { href: "/procurement/vamaa", key: "procurement.collections", label: "Collections" },
              { href: "/procurement/rate-chart", key: "procurement.rates", label: "Rate chart" },
            ],
          },
          { href: "/farmers", key: "farmers", label: "Farmers", icon: Contact },
          { href: "/tanks", key: "tanks", label: "Tanks", icon: Cylinder },
        ],
      },
      {
        label: "Production",
        items: [
          {
            href: "/daily", key: "production", label: "Production", icon: CalendarDays,
            children: [
              { href: "/daily", key: "production", label: "Daily batches", exact: true },
              { href: "/daily/sku", key: "production.sku", label: "SKU packing" },
              { href: "/daily/products", key: "production.products", label: "Products & ingredients" },
            ],
          },
          {
            href: "/store", key: "store", label: "Store", icon: Warehouse,
            children: [
              { href: "/store", key: "store", label: "Stock", exact: true },
              { href: "/store/items", key: "store.items", label: "Categories & items" },
              { href: "/store/in", key: "store.in", label: "Stock in" },
              { href: "/store/out", key: "store.out", label: "Stock out" },
              { href: "/store/ledger", key: "store.ledger", label: "Ledger" },
            ],
          },
        ],
      },
      {
        label: "Plant costs",
        items: [
          { href: "/labour", key: "labour", label: "Labour", icon: Users },
          { href: "/electricity", key: "electricity", label: "Electricity", icon: Zap },
          { href: "/fuel/production", key: "fuel.production", label: "Fuel in plant", icon: Fuel },
        ],
      },
      { label: "Rates & masters", items: [], classes: true },
    ],
  },
  {
    id: "logistics", label: "Logistics", icon: Truck,
    groups: [
      {
        label: "Milk to plant",
        items: [
          { href: "/transport/milk-to-plant", key: "transport.milk", label: "Transport", icon: Truck },
          { href: "/fuel/milk-to-plant", key: "fuel.milk", label: "Fuel", icon: Fuel },
        ],
      },
      {
        label: "Delivery",
        items: items(
          {
            href: "/route-orders", key: "routeorders", label: "Route orders", icon: Route,
            children: [
              { href: "/route-orders", key: "routeorders", label: "Route sheet", exact: true },
              { href: "/route-orders/products", key: "routeorders", label: "Product totals" },
              { href: "/route-orders/billing", key: "routeorders.billing", label: "Billing" },
              { href: "/route-orders/masters", key: "routeorders.masters", label: "Customers & products" },
            ],
          },
          { href: "/transport/delivery", key: "transport.delivery", label: "Delivery transport", icon: Truck },
          { href: "/fuel/delivery", key: "fuel.delivery", label: "Delivery fuel", icon: Fuel },
          { href: "/pod", key: "grn", label: "POD", icon: PackageCheck },
          {
            href: "/shop-orders/riders", key: "shop", label: "Riders", icon: Bike,
            children: [
              { href: "/shop-orders/riders", key: "shop", label: "Riders" },
              { href: "/shop-orders/live", key: "shop", label: "Live map" },
            ],
          },
        ),
      },
      {
        label: "Van sales",
        items: items(
          orders("Van & dispatch", MapPin, ["delivery", "loadSheet", "stockTransferView", "vanMaster"]),
        ),
      },
    ],
  },
  {
    id: "d2c", label: "D2C", icon: ShoppingBag,
    groups: [
      {
        label: "Orders",
        items: [
          {
            href: "/shop-orders", key: "shop", label: "Shop orders", icon: Store,
            children: [
              { href: "/shop-orders", key: "shop", label: "Orders", exact: true },
              { href: "/shop-orders/subscriptions", key: "shop", label: "Subscriptions" },
              { href: "/shop-orders/autopay", key: "shop", label: "Autopay" },
              { href: "/shop-orders/notifications", key: "shop", label: "Notifications" },
            ],
          },
          { href: "/app-orders/d2c", key: "apporders", label: "App orders", icon: Smartphone },
          {
            href: "/whatsapp/chats", key: "whatsapp", label: "WhatsApp shop", icon: MessageCircle,
            children: [
              { href: "/whatsapp/chats", key: "whatsapp", label: "Chats" },
              { href: "/whatsapp/orders", key: "whatsapp", label: "Orders" },
              { href: "/whatsapp/reviews", key: "whatsapp", label: "Reviews" },
            ],
          },
        ],
      },
      {
        label: "Customers & catalogue",
        items: [
          {
            href: "/d2c/customers", key: "d2c.customers", label: "Customers", icon: Contact,
            children: [
              { href: "/d2c/customers", key: "d2c.customers", label: "Customer Master" },
              { href: "/shop-orders/deletion-requests", key: "shop", label: "Deletion requests" },
            ],
          },
          {
            href: "/product-master/d2c", key: "productmaster.d2c", label: "Catalogue", icon: PackageSearch,
            children: [
              { href: "/product-master/d2c", key: "productmaster.d2c", label: "App products" },
              { href: "/whatsapp/products", key: "whatsapp", label: "WhatsApp catalog & setup" },
              { href: "/shop-orders/banners", key: "shop", label: "Banners" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "distributor", label: "Distributor & Retail", icon: Network,
    groups: [
      {
        label: "Orders",
        items: items(
          {
            href: "/app-orders/distributors", key: "apporders", label: "App orders", icon: Smartphone,
            children: [
              { href: "/app-orders/distributors", key: "apporders", label: "Distributors" },
              { href: "/app-orders/retailers", key: "apporders", label: "Retailers" },
            ],
          },
          orders("Primary", Truck, ["portalOrder", "fpsalesview", "stockView", "fpmybookingorders"]),
          orders("Secondary", ShoppingBag, ["fpcustbookingorders", "fpsecondarysalesview", "fpsalesreturnview", "collections", "task"]),
        ),
      },
      {
        label: "Customers & pricing",
        items: items(
          orders("Customers", Contact, ["distribution", "customerTarget", "customerTypeMaster", "customerRouteMapping"]),
          {
            href: "/product-master/distributor", key: "productmaster", label: "Products & prices", icon: Tags,
            children: [
              { href: "/product-master/distributor", key: "productmaster.distributor", label: "Distributor app products" },
              { href: "/product-master/retail", key: "productmaster.retail", label: "Retail app products" },
              { href: "/price-list", key: "pricelist", label: "Price list" },
            ],
          },
          orders("Product Management", Package, ["fpproducts", "fpchannelrates", "priceSlabs", "fpfocusproduct", "fpproductinventory", "displayPlanogram", "greenCallTargets"]),
          orders("Schemes", Gift, ["schemes", "schemesQPS"]),
        ),
      },
      {
        label: "Field sales",
        items: items(
          orders("Sales team", Users, ["staffs", "employeecustomermaster", "employeefaceregistration", "attendance", "leave", "employeeTarget", "catalogue", "lms"]),
          orders("Field Force Management", MapPinned, ["beat", "cityCategory", "displayAudit"]),
          orders("Promoters", Users, ["firmPromoter", "firmPromoterReport", "serviceManagementView"]),
        ),
      },
      {
        label: "Credit & collections",
        items: [
          { href: "/credit-note", key: "creditnote", label: "Credit notes", icon: ReceiptText },
          {
            href: "/cn", key: "cn", label: "CN Management", icon: ClipboardCheck,
            children: [
              { href: "/cn", key: "cn", label: "All complaints", exact: true },
              { href: "/cn/approvals", key: "cn.approve", label: "Approvals" },
              { href: "/cn/finance", key: "cn.finance", label: "Finance posting" },
            ],
          },
          {
            href: "/outstandings", key: "outstandings", label: "Outstandings", icon: Scale,
            children: [
              { href: "/outstandings", key: "outstandings", label: "Outstandings", exact: true },
              { href: "/outstandings/statements", key: "outstandings", label: "Statements" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "mis", label: "MIS", icon: BarChart3,
    groups: [
      {
        label: "Plant",
        items: [
          { href: "/procurement/dashboard", key: "procurement.dashboard", label: "Milk in", icon: Droplets },
          { href: "/tanks/dashboard", key: "tanks.dashboard", label: "Tanks", icon: Cylinder },
          { href: "/daily/dashboard", key: "production.dashboard", label: "Production", icon: CalendarDays },
          { href: "/reports", key: "reports", label: "Production by product", icon: Factory },
          { href: "/fuel/dashboard", key: "fuel.dashboard", label: "Fuel", icon: Fuel },
        ],
      },
      {
        label: "Sales",
        items: items(
          {
            href: "/d2c/sales", key: "d2c", label: "D2C sales", icon: ShoppingBag,
            children: [
              { href: "/d2c/sales", key: "d2c.sales", label: "Sales dashboard" },
              { href: "/d2c/reports", key: "d2c.reports", label: "Sales reports" },
            ],
          },
          orders("Distributor sales", BarChart3, ["primarySalesReport", "secondarySalesReport", ["orderBookingReport", "Secondary order booking"]]),
          orders("Field activity", MapPinned, ["activity", "customerActivity", "customerLocation"]),
          { href: "/credit-note/dashboard", key: "creditnote.dashboard", label: "Credit notes", icon: ReceiptText },
          { href: "/cn/dashboard", key: "cn.dashboard", label: "Complaints & CN", icon: ClipboardCheck },
        ),
      },
      { label: "Targets", items: items(orders("KPI", Target, ["kpiTargets"])) },
    ],
  },
  {
    id: "admin", label: "Admin", icon: Settings2,
    groups: [
      {
        label: "People",
        items: [
          {
            href: "/employee-app", key: "emp", label: "Employee app", icon: Users,
            children: [
              { href: "/employee-app", key: "emp", label: "Overview", exact: true },
              { href: "/employee-app/live", key: "emp.live", label: "Live team" },
              { href: "/employee-app/attendance", key: "emp.attendance", label: "Attendance" },
              { href: "/employee-app/leaves", key: "emp.leaves", label: "Leave" },
              { href: "/employee-app/claims", key: "emp.claims", label: "Reimbursements" },
              { href: "/employee-app/notices", key: "emp.notices", label: "Notices" },
              { href: "/employee-app/payslips", key: "emp.payslips", label: "Salary slips" },
              { href: "/employee-app/requests", key: "emp.requests", label: "Requests" },
              { href: "/employee-app/accounts", key: "emp.accounts", label: "Accounts & sites" },
            ],
          },
        ],
      },
      {
        label: "Sales masters",
        items: items(
          orders("Masters", Database, ["designationMaster", "channelMaster", "categoryMaster", "taxMaster", "stateMaster", "cityMaster", "divisionMaster", ["communicationCredit", "CRM credits"]]),
          orders("Integration status", Network, ["firmsStatus", "productsStatus", "productInventoryStatus", "stockTransferStatus", "billsStatus", "transactionStatus", "preSaleSRSync", "vansalestockreq", "bookorderstatus", "intgBookingOrderStatus"]),
        ),
      },
      {
        label: "System",
        items: [
          { href: "/audit", key: "audit", label: "Change log", icon: FileClock },
          { href: "/users", key: "", label: "Users", icon: UserPlus, ownerOnly: true },
        ],
      },
    ],
  },
];

/* ---------- "Not in use": placeholders and pages nothing links to ---------- */
const linked = new Set(
  WORKING.flatMap((s) => s.groups.flatMap((g) => g.items.flatMap((i) => [i.href, ...(i.children ?? []).map((c) => c.href)]))),
);
const leafGroup = (label: string, icon: React.ElementType, leaves: NavLeaf[]): NavItem | null =>
  leaves.length ? { href: leaves[0].href, key: `unused.${label}`, label: `${label} (${leaves.length})`, icon, ownerOnly: true, children: leaves } : null;

/** Placeholders that the old Orders sidebar used to show, kept under their old heading. */
const shownBefore = new Set<string>();
const placeholdersByOldGroup = ORDERS_GROUPS.flatMap((g) => {
  const leaves = g.items
    .map((i) => (i.route === "homeDashboard" ? "companyDashboard" : i.url.slice(1)))
    .filter((slug) => STUBS.has(slug) && !shownBefore.has(slug) && (shownBefore.add(slug), true))
    .map((slug) => ordersLeaf(slug));
  return leafGroup(g.group === "(top)" ? "Dashboard" : g.group, Archive, leaves) ?? [];
});
const neverLinked = unbuilt.stubs.filter((s) => !shownBefore.has(s)).map((s) => ordersLeaf(s, humanize(s)));
const builtNotLinked = unbuilt.all
  .filter((s) => !STUBS.has(s) && !linked.has(`/orders/${s}`) && s !== "companyDashboard")
  .map((s) => ordersLeaf(s));

const UNUSED: NavSection = {
  id: "unused", label: "Not in use", icon: Archive, ownerOnly: true,
  groups: [
    { label: "Built, but not in any section", items: items(leafGroup("Orders pages", Package, builtNotLinked)) },
    { label: "Empty pages - were in the sidebar", items: placeholdersByOldGroup },
    { label: "Empty pages - never linked", items: items(leafGroup("Orders pages", Archive, neverLinked)) },
  ],
};

export const SECTIONS: NavSection[] = [...WORKING, UNUSED];

/** The section a path belongs to (the first one that links to it), else null. */
export function sectionFor(pathname: string, classesHref = "/c/"): string | null {
  if (pathname.startsWith(classesHref)) return "plant";
  let best: { id: string; len: number } | null = null;
  for (const s of SECTIONS) for (const g of s.groups) for (const i of g.items) {
    for (const h of [i.href, ...(i.children ?? []).map((c) => c.href)]) {
      const hit = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/");
      if (hit && (!best || h.length > best.len)) best = { id: s.id, len: h.length };
    }
  }
  return best?.id ?? null;
}
