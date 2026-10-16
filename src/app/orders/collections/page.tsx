import { HandCoins } from "lucide-react";
import { EntityPanel } from "@/components/orders/EntityPanel";
import { inr, Panel, Stat, TD, TH } from "@/components/orders/common";
import { SectionShell } from "@/components/orders/SectionShell";
import { pickTab, SectionTabs, type TabDef } from "@/components/orders/SectionTabs";
import { query } from "@/lib/db";
import { params, type SP } from "@/lib/orders/session";

export const dynamic = "force-dynamic";

const TABS: TabDef[] = [
  { key: "invoice", label: "Bills / outstanding" },
  { key: "payment", label: "Payments" },
  { key: "credit_note", label: "Credit notes" },
];

const OUT = `i.amount - coalesce((select sum(p.amount) from ord_payment p where p.invoice_id = i.id and p.status = 'cleared'),0)
  - coalesce((select sum(n.amount) from ord_credit_note n where n.invoice_id = i.id and n.status = 'approved'),0)`;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const sp = await params(searchParams);
  const tab = pickTab(TABS, sp.t);
  const [age] = await query<{ total: number; b0: number; b30: number; b60: number; b90: number; pending: number }>(
    `with x as (select greatest(0, current_date - i.due_date) as od, ${OUT} as out from ord_invoice i)
     select coalesce(sum(out) filter (where out > 0),0) as total,
            coalesce(sum(out) filter (where out > 0 and od = 0),0) as b0,
            coalesce(sum(out) filter (where out > 0 and od between 1 and 30),0) as b30,
            coalesce(sum(out) filter (where out > 0 and od between 31 and 60),0) as b60,
            coalesce(sum(out) filter (where out > 0 and od > 60),0) as b90,
            (select coalesce(sum(amount),0) from ord_payment where status = 'pending') as pending
       from x`);
  const top = await query<{ name: string; out: number }>(
    `select c.name, sum(${OUT}) as out from ord_invoice i join ord_customer c on c.id = i.customer_id
      group by c.name having sum(${OUT}) > 0 order by 2 desc limit 6`);

  return (
    <SectionShell icon={HandCoins} title="Collections" subtitle="Bills raised when an order is invoiced, payments received against them, and credit notes.">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat title="Total outstanding" value={inr(age.total)} />
        <Stat title="Not yet due" value={inr(age.b0)} />
        <Stat title="1–30 days over" value={inr(age.b30)} />
        <Stat title="31–60 days over" value={inr(age.b60)} />
        <Stat title="60+ days over" value={inr(age.b90)} hint={`${inr(age.pending)} payments not cleared`} />
      </div>
      {tab === "invoice" && top.length > 0 && (
        <Panel title="Biggest outstanding">
          <table className="w-full text-[13px]">
            <thead className="border-b border-border bg-muted/40"><tr><th className={TH}>Customer</th><th className={`${TH} text-right`}>Outstanding</th></tr></thead>
            <tbody>
              {top.map((t) => (
                <tr key={t.name} className="border-b border-border/70">
                  <td className={`${TD} font-medium text-foreground`}>{t.name}</td>
                  <td className={`${TD} text-right tabular-nums`}>{inr(t.out)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <SectionTabs path="/orders/collections" tabs={TABS} active={tab} />
      <EntityPanel entity={tab} path="/orders/collections" tab={tab} access="orders.collections" sp={sp}
        filterBy={tab === "payment" ? ["status", "mode"] : tab === "credit_note" ? ["status"] : undefined} />
    </SectionShell>
  );
}
