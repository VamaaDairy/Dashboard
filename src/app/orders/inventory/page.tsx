import { Boxes } from "lucide-react";
import { Panel, SearchBox, Stat, TD, TH, StatusChip, inr, label } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { StockAdjust } from "@/components/orders/StockAdjust";
import { query } from "@/lib/db";
import { canEdit, params, type SP } from "@/lib/orders/session";
import { recentMoves, stockView } from "@/lib/orders/trade";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const low = sp.low === "1";
  const [stock, moves, editable, products] = await Promise.all([
    stockView({ q: sp.q, low }),
    recentMoves(),
    canEdit("orders.inventory"),
    query<{ id: string; label: string }>(`select id, sku || ' — ' || name as label from ord_product where is_active order by name`),
  ]);
  const value = stock.reduce((s, r) => s + Math.max(0, r.stock_value), 0);

  return (
    <SectionShell icon={Boxes} title="Inventory" subtitle="Stock on hand, built from the ledger: purchases in, deliveries out, plus adjustments."
      actions={editable ? <StockAdjust products={products} /> : undefined}>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Stat title="Products" value={String(stock.length)} />
        <Stat title="Stock value (trade rate)" value={inr(value)} />
        <Stat title="Out of stock" value={String(stock.filter((r) => r.on_hand <= 0).length)} />
      </div>
      <Panel
        title="Stock on hand"
        actions={
          <SearchBox path="/orders/inventory" params={{}} q={sp.q ?? ""} placeholder="SKU or product">
            <label className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
              <input type="checkbox" name="low" value="1" defaultChecked={low} /> Out of stock only
            </label>
          </SearchBox>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/40">
              <tr><th className={TH}>SKU</th><th className={TH}>Product</th><th className={TH}>Category</th><th className={`${TH} text-right`}>On hand</th><th className={`${TH} text-right`}>Value</th></tr>
            </thead>
            <tbody>
              {stock.map((r) => (
                <tr key={r.id} className="border-b border-border/70 hover:bg-muted/50">
                  <td className={`${TD} font-medium text-foreground`}>{r.sku}</td>
                  <td className={`${TD} text-foreground`}>{r.name}</td>
                  <td className={`${TD} text-muted-foreground`}>{r.category ?? "—"}</td>
                  <td className={`${TD} text-right tabular-nums ${r.on_hand <= 0 ? "font-semibold text-destructive" : "text-foreground"}`}>{r.on_hand}</td>
                  <td className={`${TD} text-right tabular-nums text-muted-foreground`}>{inr(r.stock_value)}</td>
                </tr>
              ))}
              {stock.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">No products.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title="Recent stock movements">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/40">
              <tr><th className={TH}>Date</th><th className={TH}>Product</th><th className={TH}>Reason</th><th className={`${TH} text-right`}>Qty</th><th className={TH}>Note</th></tr>
            </thead>
            <tbody>
              {moves.map((m) => (
                <tr key={m.id} className="border-b border-border/70">
                  <td className={`${TD} text-muted-foreground`}>{m.moved_on}</td>
                  <td className={`${TD} text-foreground`}>{m.name}</td>
                  <td className={TD}><StatusChip value={m.reason === "sale" ? "invoiced" : m.reason === "purchase" ? "received" : "draft"} />
                    <span className="ml-1.5 text-[12px] text-muted-foreground">{label(m.reason)}</span></td>
                  <td className={`${TD} text-right tabular-nums ${m.qty < 0 ? "text-destructive" : "text-emerald-700"}`}>{m.qty > 0 ? "+" : ""}{m.qty}</td>
                  <td className={`${TD} text-muted-foreground`}>{m.note ?? ""}</td>
                </tr>
              ))}
              {moves.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No movements yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </Panel>
    </SectionShell>
  );
}
