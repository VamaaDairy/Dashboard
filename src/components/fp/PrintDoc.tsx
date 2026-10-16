import { notFound } from "next/navigation";
import { PrintButton } from "@/components/orders/PrintButton";
import { one, query } from "@/lib/db";

const inr = (n: number) => "₹" + Number(n).toLocaleString("en-IN", { maximumFractionDigits: 2, minimumFractionDigits: 2 });
const sheet = "mx-auto my-6 w-full max-w-3xl rounded-lg border border-border bg-white p-8 text-[13px] text-black print:my-0 print:max-w-none print:border-0 print:p-0";
const fmt = (v: unknown) => (v ? new Date(String(v)).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—");
const KINDS: Record<number, string> = { 1: "Tax invoice", 2: "Purchase entry", 3: "Sales return", 4: "Purchase return", 5: "Stock transfer", 6: "Cash memo" };

/** An invoice / return / counter-sale printed from its transaction. */
export async function PrintTransaction({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await one<{
    voucher_number: string; voucher_type: number; voucher_time: string; reference: string | null; total_cost: number; status: string; return_reason: string | null;
    from_name: string | null; from_address: string | null; from_gstin: string | null; from_city: string | null; to_name: string | null; to_address: string | null; to_gstin: string | null; to_city: string | null; to_phone: string | null;
  }>(
    `select t.voucher_number, t.voucher_type, t.voucher_time, t.reference, t.total_cost, t.status, t.return_reason,
            f.name as from_name, f.address as from_address, f.gstin as from_gstin, f.city as from_city,
            o.name as to_name, o.address as to_address, o.gstin as to_gstin, o.city as to_city, o.phone as to_phone
       from fp_transaction t left join fp_firm f on f.uid = t.from_firm_uid left join fp_firm o on o.uid = t.to_firm_uid where t.uid = $1`, [id]);
  if (!t) notFound();
  const lines = await query<{ sku: string; name: string; qty: number; mrp: number; dp: number; total: number; gst: number }>(
    `select p.sku_code as sku, p.sku_name as name, i.quantity as qty, i.mrp, i.dp, i.total_cost as total,
            coalesce((select sum((x->>'rate')::numeric) from jsonb_array_elements(coalesce(tc.applicable_taxes, '[]'::jsonb)) x), 0) as gst
       from fp_transaction_item i join fp_product p on p.uid = i.product_uid left join fp_tax_configuration tc on tc.uid = p.tax_configuration_uid
      where i.transaction_uid = $1 order by p.sku_name`, [id]);
  const taxByRate = new Map<number, number>();
  for (const l of lines) taxByRate.set(Number(l.gst), (taxByRate.get(Number(l.gst)) ?? 0) + (Number(l.total) * Number(l.gst)) / 100);
  const tax = [...taxByRate.values()].reduce((a, b) => a + b, 0);
  const sub = Number(t.total_cost);

  return (
    <div className="flex-1 bg-muted/40 p-4 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl justify-end print:hidden"><PrintButton /></div>
      <div className={sheet}>
        <div className="flex items-start justify-between border-b border-black/20 pb-4">
          <div>
            <h1 className="text-xl font-bold">{KINDS[t.voucher_type] ?? "Document"}</h1>
            <p className="text-black/60">{t.voucher_number}</p>
            {t.status === "Cancelled" && <p className="mt-1 font-semibold text-red-600">CANCELLED</p>}
          </div>
          <div className="text-right"><p>Date {fmt(t.voucher_time)}</p>{t.reference && <p>Ref {t.reference}</p>}</div>
        </div>
        <div className="grid grid-cols-2 gap-6 py-4">
          <div><p className="text-[11px] font-semibold uppercase text-black/50">From</p><p className="font-semibold">{t.from_name ?? "—"}</p>{t.from_address && <p>{t.from_address}</p>}{t.from_city && <p>{t.from_city}</p>}{t.from_gstin && <p>GSTIN {t.from_gstin}</p>}</div>
          <div><p className="text-[11px] font-semibold uppercase text-black/50">To</p><p className="font-semibold">{t.to_name ?? "Walk-in customer"}</p>{t.to_address && <p>{t.to_address}</p>}{t.to_city && <p>{t.to_city}</p>}{t.to_gstin && <p>GSTIN {t.to_gstin}</p>}{t.to_phone && <p>{t.to_phone}</p>}</div>
        </div>
        <table className="w-full">
          <thead><tr className="border-y border-black/30 text-left text-[11px] uppercase"><th className="py-1.5">SKU</th><th>Product</th><th className="text-right">Qty</th><th className="text-right">MRP</th><th className="text-right">Rate</th><th className="text-right">GST</th><th className="text-right">Amount</th></tr></thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.sku} className="border-b border-black/10">
                <td className="py-1.5">{l.sku}</td><td>{l.name}</td><td className="text-right">{l.qty}</td><td className="text-right">{inr(l.mrp)}</td><td className="text-right">{inr(l.dp)}</td><td className="text-right">{Number(l.gst)}%</td><td className="text-right">{inr(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="ml-auto mt-4 w-64 space-y-1">
          <div className="flex justify-between"><span>Subtotal</span><span>{inr(sub)}</span></div>
          {[...taxByRate.entries()].filter(([, v]) => v > 0).map(([rate, v]) => <div key={rate} className="flex justify-between text-black/70"><span>GST {rate}%</span><span>{inr(v)}</span></div>)}
          <div className="flex justify-between border-t border-black/30 pt-1 text-base font-bold"><span>Total</span><span>{inr(sub + tax)}</span></div>
        </div>
        {t.return_reason && <p className="mt-4">Return reason: {t.return_reason}</p>}
        <div className="mt-10 border-t border-black/10 pt-3 text-black/60">
          <p className="font-semibold">Terms &amp; Conditions</p>
          <p>* This is computer generated invoice. No signature is required.</p>
        </div>
      </div>
    </div>
  );
}

export async function PrintStockTransfer({ id }: { id: string }) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const t = await one<{ voucher_number: string; voucher_time: string; status: string; total_cost: number; from_name: string | null; to_name: string | null }>(
    `select t.voucher_number, t.voucher_time, t.status, t.total_cost, f.name as from_name, s.first_name as to_name
       from fp_stock_transfer t left join fp_firm f on f.uid = t.from_firm_uid left join fp_staff s on s.uid = t.to_staff_uid where t.uid = $1`, [id]);
  if (!t) notFound();
  const lines = await query<{ sku: string; name: string; qty: number; billed: number; dp: number; total: number }>(
    `select p.sku_code as sku, p.sku_name as name, i.quantity as qty, i.billed_quantity as billed, i.dp, i.total_cost as total
       from fp_stock_transfer_item i join fp_product p on p.uid = i.product_uid where i.stock_transfer_uid = $1 order by p.sku_name`, [id]);
  return (
    <div className="flex-1 bg-muted/40 p-4 print:bg-white print:p-0">
      <div className="mx-auto flex max-w-3xl justify-end print:hidden"><PrintButton /></div>
      <div className={sheet}>
        <h1 className="text-xl font-bold">Stock transfer</h1>
        <p className="text-black/60">{t.voucher_number} · {fmt(t.voucher_time)} · {t.status}</p>
        <p className="my-3">From <b>{t.from_name ?? "—"}</b> to <b>{t.to_name ?? "—"}</b></p>
        <table className="w-full">
          <thead><tr className="border-y border-black/30 text-left text-[11px] uppercase"><th className="py-1.5">SKU</th><th>Product</th><th className="text-right">Transferred</th><th className="text-right">Billed</th><th className="text-right">DP</th><th className="text-right">Value</th></tr></thead>
          <tbody>{lines.map((l) => <tr key={l.sku} className="border-b border-black/10"><td className="py-1.5">{l.sku}</td><td>{l.name}</td><td className="text-right">{l.qty}</td><td className="text-right">{l.billed}</td><td className="text-right">{inr(l.dp)}</td><td className="text-right">{inr(l.total)}</td></tr>)}</tbody>
        </table>
        <p className="mt-3 text-right font-bold">Total {inr(t.total_cost)}</p>
        <p className="mt-8 border-t border-black/10 pt-3 text-black/60">* This is computer generated document. No signature is required.</p>
      </div>
    </div>
  );
}
