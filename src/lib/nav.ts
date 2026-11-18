/**
 * The sidebar, split into sections (Plant, Logistics, D2C, WhatsApp, Distributor & Retail, Pricing,
 * Accounts, HR, Masters, MIS, Admin). All sections show one under the other, each opening and closing on its own,
 * with a search box above them. A page can sit in more than one section (Labour in Plant and HR; every dashboard under
 * the page it belongs to and again in MIS); the section that opens by itself is then the one you used last.
 *
 * Orders pages that are still empty placeholders never show in a working section: they are
 * listed under "Not in use" (owner only), together with any built Orders page that no section
 * links to. Which pages are placeholders comes from src/lib/nav-unbuilt.json - after building
 * one, run `node scripts/nav-audit.mjs` and add it to the section where it belongs.
 */
import {
  Archive, BadgePercent, BarChart3, Beaker, Bike, Boxes, CalendarDays, ClipboardCheck, Contact, Cylinder, Database, Droplets, Factory,
  Briefcase, FileClock, Fuel, Gift, HardHat, Home, IndianRupee, MapPin, MapPinned, MessageCircle, Network, Package, PackageCheck, PackageSearch,
  ReceiptText, Route, Scale, Settings2, ShoppingBag, Smartphone, Star, Store, Tags, Target, Truck, UserPlus, Users, Wallet, Warehouse, Zap,
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

/* ---------- building blocks; some appear in more than one section ---------- */
// Plant
const milkIn: NavItem = {
  href: "/procurement/vamaa", key: "procurement", label: "Milk in", icon: Droplets,
  children: [
    { href: "/procurement/vamaa", key: "procurement.collections", label: "Collections" },
    { href: "/procurement/rate-chart", key: "procurement.rates", label: "Rate chart" },
  ],
};
const labour: NavItem = { href: "/labour", key: "labour", label: "Labour", icon: HardHat };
// Logistics
const pod: NavItem = { href: "/pod", key: "grn", label: "POD", icon: PackageCheck };
// Distributor & Retail
const distAppOrders: NavItem = {
  href: "/app-orders/distributors", key: "apporders", label: "App orders", icon: Smartphone,
  children: [
    { href: "/app-orders/distributors", key: "apporders", label: "Distributors" },
    { href: "/app-orders/retailers", key: "apporders", label: "Retailers" },
    { href: "/app-orders/dispatch", key: "apporders", label: "Dispatch" },
    { href: "/app-orders/new-customers", key: "apporders", label: "New customers" },
    { href: "/app-orders/notifications", key: "apporders", label: "Notifications" },
  ],
};
// The old ERP order lists (Primary: portal / my booking orders; Secondary: customer booking orders) are gone from the
// sidebar: App orders classifies every order as distributor or retailer. What else they held stays here.
const salesStock = orders("Sales & stock", Truck, ["fpsalesview", "fpsecondarysalesview", "stockView", "fpsalesreturnview", "collections", "task"]);
const distCustomers = orders("Customers", Contact, ["distribution", "customerTarget", "customerTypeMaster", "customerRouteMapping"]);
const distProducts = orders("Product Management", Package, ["fpproducts", "fpfocusproduct", "fpproductinventory", "displayPlanogram", "greenCallTargets"]);
const salesTeam = orders("Sales team", Users, ["staffs", "employeecustomermaster", "employeefaceregistration", "attendance", "leave", "employeeTarget", "catalogue", "lms"]);
const salesMasters = orders("Masters", Database, ["designationMaster", "channelMaster", "categoryMaster", "taxMaster", "stateMaster", "cityMaster", "divisionMaster", ["communicationCredit", "CRM credits"]]);
// Pricing
const priceList: NavItem = { href: "/price-list", key: "pricelist", label: "Prices", icon: Tags };
const appProductPrices: NavItem = {
  href: "/product-master/d2c", key: "productmaster", label: "App product prices", icon: PackageSearch,
  children: [
    { href: "/product-master/d2c", key: "productmaster.d2c", label: "D2C app" },
    { href: "/product-master/retail", key: "productmaster.retail", label: "Retailer app" },
    { href: "/product-master/distributor", key: "productmaster.distributor", label: "Wholesale app" },
  ],
};
const marginsSlabs = orders("Margins & slabs", IndianRupee, ["fpchannelrates", "priceSlabs"]);
const schemes = orders("Schemes", Gift, ["schemes", "schemesQPS"]);
// Accounts
const outstandings: NavItem = {
  href: "/outstandings", key: "outstandings", label: "Outstandings", icon: Scale,
  children: [
    { href: "/outstandings", key: "outstandings", label: "Outstandings", exact: true },
    { href: "/outstandings/statements", key: "outstandings", label: "Statements" },
  ],
};
const creditNotes: NavItem = { href: "/credit-note", key: "creditnote", label: "Credit notes", icon: ReceiptText };
const cnManagement: NavItem = {
  href: "/cn", key: "cn", label: "CN Management", icon: ClipboardCheck,
  children: [
    { href: "/cn", key: "cn", label: "All complaints", exact: true },
    { href: "/cn/approvals", key: "cn.approve", label: "Approvals" },
    { href: "/cn/finance", key: "cn.finance", label: "Finance posting" },
  ],
};
// Dashboards: each sits in its own section and again in MIS
const dash = {
  milkIn: { href: "/procurement/dashboard", key: "procurement.dashboard", label: "Milk in", icon: Droplets } as NavItem,
  tanks: { href: "/tanks/dashboard", key: "tanks.dashboard", label: "Tanks", icon: Cylinder } as NavItem,
  production: { href: "/daily/dashboard", key: "production.dashboard", label: "Production", icon: CalendarDays } as NavItem,
  byProduct: { href: "/reports", key: "reports", label: "Production by product", icon: Factory } as NavItem,
  fuel: { href: "/fuel/dashboard", key: "fuel.dashboard", label: "Fuel", icon: Fuel } as NavItem,
  d2cSales: {
    href: "/d2c/sales", key: "d2c", label: "D2C sales", icon: ShoppingBag,
    children: [
      { href: "/d2c/sales", key: "d2c.sales", label: "Sales dashboard" },
      { href: "/d2c/reports", key: "d2c.reports", label: "Sales reports" },
    ],
  } as NavItem,
  distSales: orders("Distributor sales", BarChart3, ["primarySalesReport", "secondarySalesReport", ["orderBookingReport", "Secondary order booking"]]),
  fieldActivity: orders("Field activity", MapPinned, ["activity", "customerActivity", "customerLocation"]),
  kpi: orders("KPI", Target, ["kpiTargets"]),
  creditNotes: { href: "/credit-note/dashboard", key: "creditnote.dashboard", label: "Credit notes", icon: ReceiptText } as NavItem,
  cn: { href: "/cn/dashboard", key: "cn.dashboard", label: "Complaints & CN", icon: ClipboardCheck } as NavItem,
};

/** A dashboard as a sub-page right under the data-entry page it belongs to. */
const dashLeaf = (d: NavItem, label = "Dashboard"): NavLeaf => ({ href: d.href, key: d.key, label });

/* ---------- the sections ---------- */
const WORKING: NavSection[] = [
  {
    id: "plant", label: "Plant & Production", icon: Factory,
    groups: [
      { label: "Overview", items: [{ href: "/", key: "today", label: "Today", icon: Home, exact: true }] },
      {
        label: "Milk procurement",
        items: [
          { ...milkIn, children: [...milkIn.children!, dashLeaf(dash.milkIn)] },
          { href: "/farmers", key: "farmers", label: "Farmers", icon: Contact },
          {
            href: "/tanks", key: "tanks", label: "Tanks", icon: Cylinder,
            children: [{ href: "/tanks", key: "tanks", label: "Daily", exact: true }, dashLeaf(dash.tanks)],
          },
        ],
      },
      {
        label: "Store",
        items: [
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
        label: "Production",
        items: [
          {
            href: "/daily", key: "production", label: "Production", icon: CalendarDays,
            children: [
              { href: "/daily", key: "production", label: "Daily batches", exact: true },
              { href: "/daily/products", key: "production.products", label: "Products & ingredients" },
              dashLeaf(dash.production),
            ],
          },
        ],
      },
      {
        label: "Packaging",
        items: [
          {
            href: "/daily/sku", key: "production.sku", label: "Packaging", icon: Boxes,
            children: [
              { href: "/daily/sku", key: "production.sku", label: "SKU packing" },
              { href: "/c/packaging", key: "masters", label: "Packing material" },
              dashLeaf(dash.byProduct, "Dashboard (per SKU)"),
            ],
          },
        ],
      },
      {
        label: "Fuel",
        items: [
          {
            href: "/fuel/production", key: "fuel", label: "Fuel", icon: Fuel,
            children: [
              { href: "/fuel/production", key: "fuel.production", label: "Production in plant" },
              { href: "/fuel/milk-to-plant", key: "fuel.milk", label: "Milk to plant" },
              { href: "/fuel/delivery", key: "fuel.delivery", label: "Delivery outside plant" },
              dashLeaf(dash.fuel),
            ],
          },
        ],
      },
      {
        label: "Others",
        items: [
          labour,
          { href: "/electricity", key: "electricity", label: "Electricity", icon: Zap },
        ],
      },
      { label: "Rates & masters", items: [], classes: true },
    ],
  },
  {
    id: "logistics", label: "Logistics", icon: Truck,
    groups: [
      {
        label: "Transport & fuel",
        items: [
          {
            href: "/transport/milk-to-plant", key: "transport", label: "Transport", icon: Truck,
            children: [
              { href: "/transport/milk-to-plant", key: "transport.milk", label: "Milk to plant" },
              { href: "/transport/delivery", key: "transport.delivery", label: "Delivery outside plant" },
            ],
          },
          {
            href: "/fuel/milk-to-plant", key: "fuel", label: "Fuel", icon: Fuel,
            children: [
              { href: "/fuel/milk-to-plant", key: "fuel.milk", label: "Milk to plant" },
              { href: "/fuel/delivery", key: "fuel.delivery", label: "Delivery outside plant" },
              dashLeaf(dash.fuel),
            ],
          },
        ],
      },
      {
        label: "Delivery",
        items: [
          {
            href: "/route-orders", key: "routeorders", label: "Route orders", icon: Route,
            children: [
              { href: "/route-orders", key: "routeorders", label: "Route sheet", exact: true },
              { href: "/route-orders/products", key: "routeorders", label: "Product totals" },
              { href: "/route-orders/billing", key: "routeorders.billing", label: "Billing" },
              { href: "/route-orders/masters", key: "routeorders.masters", label: "Customers & products" },
            ],
          },
          pod,
        ],
      },
      { label: "Van sales", items: items(orders("Van & dispatch", MapPin, ["delivery", "loadSheet", "stockTransferView", "vanMaster"])) },
    ],
  },
  {
    id: "d2c", label: "D2C", icon: ShoppingBag,
    groups: [
      {
        label: "Orders",
        items: [
          {
            href: "/shop-orders", key: "shop", label: "D2C orders", icon: Store,
            children: [
              { href: "/shop-orders", key: "shop", label: "Orders", exact: true },
              { href: "/shop-orders/subscriptions", key: "shop", label: "Subscriptions" },
              { href: "/shop-orders/autopay", key: "shop", label: "Autopay" },
              { href: "/shop-orders/notifications", key: "shop", label: "Notifications" },
            ],
          },
          dash.d2cSales,
        ],
      },
      {
        label: "Delivery",
        items: [
          {
            href: "/shop-orders/riders", key: "shop", label: "Riders", icon: Bike,
            children: [
              { href: "/shop-orders/riders", key: "shop", label: "Riders" },
              { href: "/shop-orders/live", key: "shop", label: "Live map" },
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
            ],
          },
          {
            href: "/shop-orders/offers", key: "shop", label: "Marketing", icon: BadgePercent,
            children: [
              { href: "/shop-orders/offers", key: "shop", label: "Offers" },
              { href: "/shop-orders/banners", key: "shop", label: "Banners" },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "whatsapp", label: "WhatsApp", icon: MessageCircle,
    groups: [
      {
        label: "WhatsApp shop",
        items: [
          { href: "/whatsapp/chats", key: "whatsapp", label: "Chats", icon: MessageCircle },
          { href: "/whatsapp/orders", key: "whatsapp", label: "Orders", icon: ShoppingBag },
          { href: "/whatsapp/reviews", key: "whatsapp", label: "Reviews", icon: Star },
        ],
      },
      {
        label: "Setup",
        items: [
          { href: "/whatsapp/products", key: "whatsapp", label: "Catalog & setup", icon: PackageSearch },
        ],
      },
    ],
  },
  {
    id: "distributor", label: "Distributor & Retail", icon: Network,
    groups: [
      { label: "Orders", items: items(distAppOrders, salesStock, dash.distSales) },
      {
        label: "Customers & products",
        items: items(
          distCustomers,
          {
            href: "/product-master/distributor", key: "productmaster", label: "App products", icon: PackageSearch,
            children: [
              { href: "/product-master/distributor", key: "productmaster.distributor", label: "Distributor app" },
              { href: "/product-master/retail", key: "productmaster.retail", label: "Retail app" },
            ],
          },
          distProducts,
          schemes,
        ),
      },
      {
        label: "Field sales",
        items: items(
          salesTeam,
          dash.kpi,
          orders("Field Force Management", MapPinned, ["beat", "cityCategory", "displayAudit"]),
          dash.fieldActivity,
          orders("Promoters", Users, ["firmPromoter", "firmPromoterReport", "serviceManagementView"]),
        ),
      },
    ],
  },
  {
    id: "pricing", label: "Pricing", icon: Tags,
    groups: [
      { label: "Prices", items: [priceList] },
      { label: "App products", items: [appProductPrices] },
      { label: "Names", items: [{ href: "/product-names", key: "productnames", label: "Product names check", icon: ClipboardCheck }] },
      { label: "Distributor & retail", items: items(marginsSlabs, schemes) },
      {
        label: "Milk purchase",
        items: [{ href: "/procurement/rate-chart", key: "procurement.rates", label: "Milk rate chart", icon: Droplets }],
      },
    ],
  },
  {
    id: "accounts", label: "Accounts", icon: Wallet,
    groups: [
      {
        label: "Accounts",
        items: [
          outstandings,
          pod,
          { ...creditNotes, children: [{ href: "/credit-note", key: "creditnote", label: "All credit notes", exact: true }, dashLeaf(dash.creditNotes)] },
          { ...cnManagement, children: [...cnManagement.children!, dashLeaf(dash.cn)] },
        ],
      },
    ],
  },
  {
    id: "hr", label: "HR", icon: Briefcase,
    groups: [
      {
        label: "Employees",
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
          labour,
        ],
      },
      { label: "Field sales team", items: items(salesTeam) },
    ],
  },
  {
    // the masters in one place; the same pages also sit in the sections that use them
    id: "masters", label: "Masters", icon: Database,
    groups: [
      {
        label: "Employee Master",
        items: items(
          { href: "/employees/salesforce", key: "employees", label: "Salesforce", icon: MapPinned },
          { href: "/employees/plant", key: "employees", label: "Plant", icon: Factory },
          { href: "/employees/office", key: "employees", label: "Office", icon: Briefcase },
          { href: "/employees/unset", key: "employees", label: "Not placed yet", icon: Users },
          { href: "/employees/departments", key: "employees", label: "Departments", icon: Network },
          salesTeam && { ...salesTeam, label: "Field staff setup (all fields)" },
          { href: "/employee-app/accounts", key: "emp.accounts", label: "Employee app accounts", icon: Smartphone },
          { href: "/users", key: "", label: "Dashboard users", icon: UserPlus, ownerOnly: true },
        ),
      },
      {
        label: "Customer Master",
        items: items(
          { href: "/customers/distributors", key: "customers", label: "Distributors", icon: Network },
          { href: "/customers/retailers", key: "customers", label: "Retailers", icon: Store },
          { href: "/customers/d2c", key: "customers", label: "D2C customers", icon: Contact },
          { href: "/customers/duplicates", key: "customers", label: "Same mobile twice", icon: ClipboardCheck },
          distCustomers && { ...distCustomers, label: "Customer setup (all fields)" },
          { href: "/route-orders/masters", key: "routeorders.masters", label: "Route customers & products", icon: Route },
        ),
      },
      {
        label: "Product Master",
        items: items(
          {
            href: "/product-master/d2c", key: "productmaster", label: "App product lists", icon: PackageSearch,
            children: [
              { href: "/product-master/d2c", key: "productmaster.d2c", label: "D2C" },
              { href: "/product-master/retail", key: "productmaster.retail", label: "Retailer" },
              { href: "/product-master/distributor", key: "productmaster.distributor", label: "Wholesale (Distributors)" },
            ],
          },
          orders("All products", Package, [["fpproducts", "Product Master (all SKUs)"], "categoryMaster", "taxMaster"]),
          { href: "/product-names", key: "productnames", label: "Product names check", icon: ClipboardCheck },
        ),
      },
    ],
  },
  {
    id: "mis", label: "MIS", icon: BarChart3,
    groups: [
      { label: "Plant", items: [dash.milkIn, dash.tanks, dash.production, dash.byProduct, dash.fuel] },
      { label: "Sales", items: items(dash.d2cSales, dash.distSales, dash.fieldActivity, dash.kpi) },
      { label: "Accounts", items: [dash.creditNotes, dash.cn] },
      { label: "Distributor & retail orders", items: items(distAppOrders, salesStock) },
      { label: "Distributor & retail masters", items: items(distCustomers, distProducts, salesMasters) },
      { label: "Distributor & retail prices", items: items(appProductPrices, marginsSlabs, schemes, priceList) },
    ],
  },
  {
    id: "admin", label: "Admin", icon: Settings2,
    groups: [
      {
        label: "Sales masters",
        items: items(
          salesMasters,
          orders("Integration status", Network, ["firmsStatus", "productsStatus", "productInventoryStatus", "stockTransferStatus", "billsStatus", "transactionStatus", "preSaleSRSync", "vansalestockreq", "bookorderstatus", "intgBookingOrderStatus"]),
        ),
      },
      {
        label: "System",
        items: [
          { href: "/product-names", key: "productnames", label: "Product names check", icon: Tags },
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

/**
 * The section a path belongs to, else null. A page linked from several sections stays in
 * `current` when that is one of them; otherwise the first section with the closest link wins.
 */
export function sectionFor(pathname: string, current?: string | null, classesHref = "/c/"): string | null {
  if (pathname.startsWith(classesHref)) return "plant";
  const hits = new Map<string, number>();
  for (const s of SECTIONS) for (const g of s.groups) for (const i of g.items) {
    for (const h of [i.href, ...(i.children ?? []).map((c) => c.href)]) {
      const hit = h === "/" ? pathname === "/" : pathname === h || pathname.startsWith(h + "/");
      if (hit && h.length > (hits.get(s.id) ?? -1)) hits.set(s.id, h.length);
    }
  }
  if (!hits.size) return null;
  const longest = Math.max(...hits.values());
  if (current && hits.get(current) === longest) return current;
  return [...hits].find(([, len]) => len === longest)![0];
}
