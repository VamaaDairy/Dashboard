import Link from "next/link";
import { ArrowRight, Smartphone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Panel } from "@/components/cn/ui";
import { latestOrders, summaries } from "@/lib/app-orders";
import { rupees } from "@/lib/shop/pricing";
import { D2cStatus, KINDS, KindTabs, Stat, TradeStatus, when } from "./parts";

export const dynamic = "force-dynamic";

/** App orders: D2C, retailer and distributor orders from the Gaia app, side by side. */
export default async function AppOrdersPage() {
  const [sum, latest] = await Promise.all([summaries(), latestOrders(15)]);
  const label = Object.fromEntries(KINDS.map((k) => [k.key, k.label])) as Record<string, string>;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-4">
        <PageHeader icon={Smartphone} title="App orders" subtitle="Every order placed from the Gaia app: customers (D2C), retailers and distributors." />
        <KindTabs active="overview" counts={{ d2c: sum.d2c.open, retailers: sum.retailers.open, distributors: sum.distributors.open }} />

        <div className="grid gap-4 md:grid-cols-3">
          {KINDS.map((k) => {
            const s = sum[k.key];
            return (
              <Panel
                key={k.key}
                title={k.long}
                actions={
                  <Link href={k.href} className="inline-flex items-center gap-1 text-[12px] font-medium text-primary hover:underline">
                    Open <ArrowRight className="size-3.5" />
                  </Link>
                }
              >
                <div className="grid grid-cols-3 gap-3">
                  <Stat label="Today" value={s.today} />
                  <Stat label={k.key === "d2c" ? "In progress" : "Waiting"} value={<span className={s.open ? "text-amber-700" : undefined}>{s.open}</span>} sub={k.key === "d2c" ? "not delivered yet" : "to confirm"} />
                  <Stat label="This month" value={s.monthCount} sub={rupees(s.monthValue)} />
                </div>
              </Panel>
            );
          })}
        </div>

        <Panel title="Latest orders" description="The newest orders of all three kinds together." flush>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/60 text-left text-xs text-muted-foreground">
                <tr>
                  {["Kind", "Order", "Placed", "From", "Total", "Status"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-2 font-semibold">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {latest.map((o) => (
                  <tr key={`${o.kind}-${o.id}`} className="border-t border-border hover:bg-muted/40">
                    <td className="px-4 py-2 text-xs font-semibold text-muted-foreground">{label[o.kind]}</td>
                    <td className="whitespace-nowrap px-4 py-2">
                      <Link href={`/app-orders/${o.kind}/${o.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {o.kind === "d2c" ? o.no : `#${o.no}`}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2 text-muted-foreground">{when(o.placedAt)}</td>
                    <td className="px-4 py-2 font-medium">{o.who}</td>
                    <td className="num whitespace-nowrap px-4 py-2 text-right">{rupees(o.total)}</td>
                    <td className="px-4 py-2">{o.kind === "d2c" ? <D2cStatus status={o.status} /> : <TradeStatus status={o.status} />}</td>
                  </tr>
                ))}
                {latest.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">No orders from the app yet.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
