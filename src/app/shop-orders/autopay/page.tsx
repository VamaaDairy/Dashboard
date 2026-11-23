import Link from "next/link";
import { Repeat } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { allMandates, MAX_ATTEMPTS, recentCharges, required } from "@/lib/shop/autopay";
import { autocollectReady, isLive } from "@/lib/payments/autocollect";
import { packCustomers, periodLabel } from "@/lib/shop/packs";

export const dynamic = "force-dynamic";

const when = (d: Date | null) => (d ? new Date(d).toLocaleString("en-GB", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }) : "-");
const money = (n: number) => `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

const MANDATE: Record<string, string> = {
  authorized: "Active", requested: "Not approved yet", initiated: "Waiting for approval", failed: "Failed", rejected: "Rejected",
  bounced: "Not opened", dropped: "Abandoned", user_cancelled: "Cancelled at setup", cancelled: "Cancelled by customer",
  revoking: "Cancelling", revoked: "Cancelled by us", expired: "Expired", completed: "Ended",
};
const CHARGE: Record<string, string> = {
  pending: "To notify", notifying: "Notifying bank", notified: "Notified · debit due", presenting: "Debiting",
  paid: "Paid", failed: "Failed", unpaid: "Unpaid · customer to pay", cancelled: "Cancelled",
};
const tone = (s: string) =>
  s === "paid" || s === "authorized" ? "text-green-700" : s === "unpaid" || ["failed", "rejected", "cancelled", "revoked", "expired"].includes(s) ? "text-red-700" : "text-amber-700";

/** Autopay (UPI Autopay or eNACH) for subscriptions: who has it set up, and how each delivery's debit is going (issue #65). */
export default async function AutopayPage() {
  const [mandates, charges, payers] = await Promise.all([allMandates(), recentCharges(), packCustomers()]);
  const active = mandates.filter((m) => m.status === "authorized").length;
  const unpaid = charges.filter((c) => c.status === "unpaid").reduce((n, c) => n + c.amount, 0);
  const th = "whitespace-nowrap px-3 py-2 font-semibold";
  const card = "rounded-lg border border-border p-4";

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader
          icon={Repeat}
          title="Autopay"
          subtitle={`Subscriptions are paid for a period the customer picks (4 weeks, a month, or up to a date of their own) - all the deliveries in it at once - by UPI Autopay or eNACH (bank account). A day's order is made only while paid days are left; skipped and paused days use none. The next pack is debited a few days before they run out (UPI: bank told 24 h ahead; eNACH: settled in 24-48 h). A failed debit is tried ${MAX_ATTEMPTS} times, then the customer is asked to try again in the app. A cancelled subscription is delivered until its paid days are used, then ends - no refund.`}
          actions={<Link href="/shop-orders/subscriptions" className="inline-flex h-8 items-center rounded-lg border border-input px-3 text-sm font-medium hover:bg-muted">Subscriptions</Link>}
        />
        <div className="grid gap-3 md:grid-cols-3">
          <div className={card}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Easebuzz Autocollect</div>
            <div className="mt-1 text-lg font-bold">{autocollectReady() ? (isLive() ? "Live" : "Sandbox (test money)") : "Not configured"}</div>
            <div className="text-sm text-muted-foreground">{required() ? "Every subscription is paid by autopay" : autocollectReady() ? "New subscriptions start with autopay; older ones paying cash keep going" : "Autopay is off"}</div>
          </div>
          <div className={card}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Customers with autopay</div>
            <div className="mt-1 text-2xl font-bold">{active}</div>
          </div>
          <div className={card}>
            <div className="text-xs font-semibold uppercase text-muted-foreground">Unpaid after retries</div>
            <div className={`mt-1 text-2xl font-bold ${unpaid ? "text-red-700" : ""}`}>{money(unpaid)}</div>
          </div>
        </div>

        <h2 className="pt-2 text-sm font-semibold">Subscription packs</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Customer", "Pays for", "Paid deliveries left", "Used / paid", "Balance", "Next pack", "Renews"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {payers.map((p) => (
                <tr key={p.customer_id} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{p.customer}</div><div className="font-mono text-xs text-muted-foreground">{p.phone}</div></td>
                  <td className="whitespace-nowrap px-3 py-2">{periodLabel({ unit: p.pack_unit, len: p.pack_len })}</td>
                  <td className={`num px-3 py-2 font-semibold ${p.paid_days - p.used_days <= 0 ? "text-red-700" : ""}`}>{Math.max(0, p.paid_days - p.used_days)}</td>
                  <td className="num px-3 py-2">{p.used_days} / {p.paid_days}</td>
                  <td className="num px-3 py-2">{money(p.balance)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 ${p.open_status ? tone(p.open_status) : p.last_status === "unpaid" ? "text-red-700" : "text-muted-foreground"}`}>
                    {p.open_status ? `${money(p.open_amount ?? 0)} · ${CHARGE[p.open_status] ?? p.open_status}` : p.last_status === "unpaid" ? "Last one not collected" : "-"}
                  </td>
                  <td className="px-3 py-2">{p.renewing ? "Yes" : "No"}</td>
                </tr>
              ))}
              {payers.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No customer pays by packs yet.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <h2 className="pt-2 text-sm font-semibold">Charges</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["For", "Customer", "Delivery day", "Amount", "Status", "Tries", "Bank notified", "Paid", "Last problem"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id} className="border-t border-border">
                  <td className="px-3 py-2 font-mono text-xs">{c.order_no}</td>
                  <td className="px-3 py-2">{c.customer}</td>
                  <td className="whitespace-nowrap px-3 py-2">{c.day ?? "-"}</td>
                  <td className="num px-3 py-2">{money(c.amount)}</td>
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${tone(c.status)}`}>{CHARGE[c.status] ?? c.status}</td>
                  <td className="num px-3 py-2">{c.attempts}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(c.notified_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(c.paid_at)}</td>
                  <td className="max-w-xs truncate px-3 py-2 text-muted-foreground" title={c.failure ?? ""}>{c.failure ?? ""}</td>
                </tr>
              ))}
              {charges.length === 0 ? <tr><td colSpan={9} className="px-3 py-10 text-center text-muted-foreground">No autopay charges yet. A subscription pack appears here once a customer on autopay subscribes.</td></tr> : null}
            </tbody>
          </table>
        </div>

        <h2 className="pt-2 text-sm font-semibold">Mandates</h2>
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full text-sm">
            <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
              <tr>{["Customer", "Status", "Limit / day", "Type", "UPI ID / account", "Approved", "Started"].map((h) => <th key={h} className={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {mandates.map((m) => (
                <tr key={m.id} className="border-t border-border">
                  <td className="px-3 py-2"><div className="font-medium">{m.customer}</div><div className="font-mono text-xs text-muted-foreground">{m.phone}</div></td>
                  <td className={`whitespace-nowrap px-3 py-2 font-medium ${tone(m.status)}`}>{MANDATE[m.status] ?? m.status}</td>
                  <td className="num px-3 py-2">{money(m.max_amount)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{m.kind === "enach" ? "eNACH" : m.kind === "upi" ? "UPI" : "-"}</td>
                  <td className="px-3 py-2 font-mono text-xs">{(m.kind === "enach" ? m.bank_account : m.upi_handle) ?? "-"}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(m.authorized_at)}</td>
                  <td className="whitespace-nowrap px-3 py-2">{when(m.created_at)}</td>
                </tr>
              ))}
              {mandates.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">No customer has set up autopay yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
