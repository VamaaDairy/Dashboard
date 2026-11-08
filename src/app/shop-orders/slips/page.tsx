import { cookies } from "next/headers";
import { userFromToken } from "@/lib/access-server";
import { atLeast, levelFor } from "@/lib/access";
import { slipOrders } from "@/lib/shop/order-board";
import { labelOf, productLabels } from "@/lib/products/names";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

const inr = (n: number) => `₹${Number(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (d: Date) => new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Delivery slips for the orders ticked on the D2C orders page, two to an A4 page, for the rider to carry. */
export default async function SlipsPage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const me = await userFromToken((await cookies()).get("session")?.value);
  if (!me || !atLeast(levelFor(me, "shop"), "view")) return <p className="p-8 text-foreground">You do not have access to D2C orders.</p>;
  const list = (ids ?? "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 200);
  const [orders, labels] = await Promise.all([slipOrders(list), productLabels()]);

  return (
    <div className="flex-1 bg-background p-6">
      <style>{`@media print { body * { visibility: hidden; } .slips, .slips * { visibility: visible; } .slips { position: absolute; inset: 0; } .slip { break-inside: avoid; } }`}</style>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-[20px] font-semibold text-foreground">Delivery slips</h1>
          <p className="text-[13px] text-foreground/75">{orders.length} order{orders.length === 1 ? "" : "s"}</p>
        </div>
        <PrintButton />
      </div>
      <div className="slips grid gap-4 md:grid-cols-2 print:grid-cols-2 print:gap-3">
        {orders.map((o) => (
          <section key={o.id} className="slip rounded-lg border border-foreground/25 bg-white p-4 text-[13px] text-black">
            <div className="flex items-start justify-between border-b border-black/20 pb-2">
              <div>
                <div className="text-[16px] font-bold">{o.order_no}</div>
                <div>{o.subscription_day ? `Subscription · ${new Date(o.subscription_day).toLocaleDateString("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" })}` : `Placed ${when(o.created_at)}`}</div>
              </div>
              <div className="text-right">
                <div className="text-[15px] font-bold">{inr(o.total)}</div>
                <div className="font-semibold">{o.payment_method === "cod" ? (o.payment_status === "paid" ? "Cash collected" : "COLLECT CASH") : o.payment_status === "paid" ? "Paid" : o.payment_method === "autopay" ? "Autopay, charged on delivery" : "Payment pending"}</div>
              </div>
            </div>
            <div className="py-2">
              <div className="font-semibold">{o.name} · {o.phone}</div>
              <div>{o.address}{o.pincode ? ` - ${o.pincode}` : ""}</div>
              {o.notes ? <div className="mt-1 italic">Note: {o.notes}</div> : null}
            </div>
            <table className="w-full border-t border-black/20">
              <tbody>
                {o.items.map((i) => {
                  const l = labelOf(labels, i.sku_code, i.name);
                  return (
                    <tr key={i.sku_code} className="border-b border-black/10">
                      <td className="w-10 py-1 font-semibold tabular-nums">{i.qty} ×</td>
                      <td className="py-1">{l.name}{l.qty || l.unit ? ` · ${[l.qty, l.unit].filter(Boolean).join(" ")}` : ""}</td>
                      <td className="py-1 text-right tabular-nums">{inr(i.line_total)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="mt-2 flex justify-between">
              <span>Rider: {o.rider?.name ?? "—"}{o.delivery_seq ? ` · stop ${o.delivery_seq}` : ""}</span>
              <span>Signature: ____________</span>
            </div>
          </section>
        ))}
        {orders.length === 0 ? <p className="text-foreground/75">No orders picked.</p> : null}
      </div>
    </div>
  );
}
