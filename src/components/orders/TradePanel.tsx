import { query } from "@/lib/db";
import { refOptions } from "@/lib/orders/crud";
import { ORDER_FLOW, PO_FLOW } from "@/lib/orders/flow";
import { canEdit } from "@/lib/orders/session";
import { linesFor, listOrders, listPurchases, type OrderKind } from "@/lib/orders/trade";
import { Pager, Panel, SearchBox } from "./common";
import { TradeManager, type DocKind, type DocRow, type ProductOpt } from "./TradeManager";

const ACCESS: Record<DocKind, string> = {
  primary: "orders.primary", secondary: "orders.secondary", counter: "orders.counter", purchase: "orders.purchase",
};
const TITLE: Record<DocKind, string> = {
  primary: "Primary orders", secondary: "Secondary orders", counter: "Counter sales", purchase: "Purchase orders",
};

/** A list of orders / counter sales / purchase orders with search, status filter, paging and the create-edit dialog. */
export async function TradePanel({ kind, path, sp }: { kind: DocKind; path: string; sp: Record<string, string> }) {
  const page = Math.max(1, Number(sp.page) || 1);
  const q = sp.q ?? "";
  const status = sp.status ?? "";
  const statuses = Object.keys(kind === "purchase" ? PO_FLOW : ORDER_FLOW);

  const [list, editable, products, staff, parties] = await Promise.all([
    kind === "purchase" ? listPurchases({ q, status, page }) : listOrders(kind as OrderKind, { q, status, page }),
    canEdit(ACCESS[kind]),
    query<ProductOpt>(`select id, sku, name, rate from ord_product where is_active order by name`),
    refOptions("staff"),
    kind === "primary" ? refOptions("distributor") : kind === "purchase" ? Promise.resolve([]) : retailers(kind),
  ]);

  const rows: DocRow[] = kind === "purchase"
    ? (list.rows as Awaited<ReturnType<typeof listPurchases>>["rows"]).map((r) => ({
        id: r.id, no: r.po_no, date: r.po_date, status: r.status, lines: r.lines, total: r.total, notes: r.notes,
        customer_id: null, customer_name: null, party: r.supplier, staff_id: null, staff: null,
      }))
    : (list.rows as Awaited<ReturnType<typeof listOrders>>["rows"]).map((r) => ({
        id: r.id, no: r.order_no, date: r.order_date, status: r.status, lines: r.lines, total: r.total, notes: r.notes,
        customer_id: r.customer_id, customer_name: r.customer_name, party: r.customer, staff_id: r.staff_id, staff: r.staff,
      }));
  const lineMap = await linesFor(kind === "purchase" ? "purchase" : "order", rows.map((r) => r.id));

  return (
    <Panel
      title={`${TITLE[kind]} (${list.total})`}
      actions={
        <SearchBox path={path} params={{}} q={q} placeholder={kind === "purchase" ? "PO no or supplier" : "Order no or customer"}>
          <select name="status" defaultValue={status} aria-label="Status" className="h-8 rounded-lg border border-border bg-background px-2 text-[12px]">
            <option value="">All statuses</option>
            {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </SearchBox>
      }
    >
      <TradeManager kind={kind} rows={rows} lineMap={lineMap} parties={parties} staff={staff} products={products} canEdit={editable} />
      <Pager path={path} params={{ q, status }} page={list.page} pageSize={list.pageSize} total={list.total} />
    </Panel>
  );
}

/** Retailers for secondary orders; every customer for a counter sale. */
async function retailers(kind: DocKind) {
  const all = await refOptions("customer");
  if (kind === "counter") return all;
  const rows = await query<{ id: string }>(`select id from ord_customer where type = 'retailer' and status <> 'inactive'`);
  const ok = new Set(rows.map((r) => r.id));
  return all.filter((o) => ok.has(o.id));
}
