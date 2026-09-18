import Link from "next/link";
import { Droplets } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Empty, Num, Section, Stat, THead, Th } from "@/components/procurement/ui";
import { formatOrDash } from "@/lib/format";
import { getDays, getProcurementTotals, kgPerLitre } from "@/lib/procurement/data";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  const [totals, days, k] = await Promise.all([
    getProcurementTotals(),
    getDays(),
    kgPerLitre(),
  ]);

  const farmer = totals?.farmer_amount ?? 0;
  const commission = totals?.commission_amount ?? 0;
  const transport = totals?.transport_amount ?? 0;
  const total = totals?.total_cost ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-white p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Droplets}
          title="Milk procurement"
          subtitle={`What a litre costs standing in our silo — farmer price, sachiv commission and tanker cost. 1 litre = ${formatOrDash(k, 2)} kg throughout.`}
        />


        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Landed cost per litre"
            value={totals?.landed_per_litre}
            prefix="₹"
            tone="accent"
            hint={`₹${formatOrDash(totals?.landed_per_kg ?? null, 2)} per kg · ₹${formatOrDash(
              totals?.landed_per_kg_solids ?? null, 2)} per kg solids`}
          />
          <Stat
            label="Milk landed"
            value={totals?.landed_litre}
            decimals={0}
            suffix="L"
            hint={`${formatOrDash(totals?.landed_kg ?? null, 0)} kg weighed in · ${formatOrDash(
              totals?.kg_solids ?? null, 0)} kg solids`}
          />
          <Stat
            label="Average test"
            value={totals?.fat_pct}
            suffix="% fat"
            hint={`${formatOrDash(totals?.snf_pct ?? null, 2)}% SNF · what we actually pay for`}
          />
          <Stat
            label="Total procurement spend"
            value={total}
            prefix="₹"
            decimals={0}
            hint={`${totals?.batch_count ?? 0} collections from ${totals?.center_count ?? 0} centres`}
          />
        </div>

        <Section
          title="Where the money goes"
          description="The three blocks that make up the landed cost of milk, each one its own module."
        >
          <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
            <Block
              href="/procurement/farmer"
              label="Price to the farmer"
              amount={farmer}
              total={total}
              perUnit={totals?.landed_litre ? farmer / totals.landed_litre : null}
              note="Paid on the kilograms of fat and SNF in the weight taken"
            />
            <Block
              href="/procurement/commission"
              label="Sachiv commission"
              amount={commission}
              total={total}
              perUnit={totals?.landed_litre ? commission / totals.landed_litre : null}
              note="What the societies earn for collecting on our behalf"
            />
            <Block
              href="/procurement/transport"
              label="Tanker to plant"
              amount={transport}
              total={total}
              perUnit={totals?.landed_litre ? transport / totals.landed_litre : null}
              note="Hire and shortage, spread over the milk each tanker carried"
            />
          </div>
        </Section>

        <Section
          title="Day by day"
          description="Every collection day, its average test, and the landed rate that day's milk costs downstream."
        >
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <THead>
                <Th align="left">Date</Th>
                <Th>Centres</Th>
                <Th>Weight kg</Th>
                <Th>Litres</Th>
                <Th>Fat %</Th>
                <Th>SNF %</Th>
                <Th>Total ₹</Th>
                <Th>₹/litre</Th>
              </THead>
              <tbody>
                {days.map((d) => (
                  <tr key={d.collected_on} className="border-b border-slate-100 hover:bg-blue-50/40">
                    <td className="px-3 py-1.5 font-semibold text-[#2B4C86]">{d.collected_on}</td>
                    <Num value={d.center_count} decimals={0} dim />
                    <Num value={d.qty_kg} decimals={0} />
                    <Num value={d.qty_litre} decimals={0} dim />
                    <Num value={d.fat_pct} />
                    <Num value={d.snf_pct} />
                    <Num value={d.total_cost} decimals={0} className="font-semibold" />
                    <Num value={d.landed_per_litre} className="font-black text-[#2B4C86]" />
                  </tr>
                ))}
                {days.length === 0 ? (
                  <Empty colSpan={8}>
                    Nothing procured yet. Start with a{" "}
                    <Link href="/procurement/farmer" className="font-semibold text-[#2B4C86] underline">
                      rate chart
                    </Link>{" "}
                    and a{" "}
                    <Link href="/procurement/commission" className="font-semibold text-[#2B4C86] underline">
                      collection centre
                    </Link>
                    .
                  </Empty>
                ) : null}
              </tbody>
            </table>
          </div>
        </Section>

        <p className="px-1 text-[11px] text-slate-500">
          Weight is the honest quantity — we take delivery of what the container weighs, and pay for
          the solids inside it. Litres everywhere on this page are derived at{" "}
          <span className="num font-semibold text-slate-700">{formatOrDash(k, 2)} kg per litre</span>
          , editable as the <code className="rounded bg-slate-100 px-1">milk_kg_per_litre</code>{" "}
          parameter.
        </p>
      </div>
    </div>
  );
}

function Block({
  href, label, amount, total, perUnit, note,
}: {
  href: string;
  label: string;
  amount: number;
  total: number;
  perUnit: number | null;
  note: string;
}) {
  const share = total > 0 ? (amount / total) * 100 : 0;

  return (
    <Link href={href} className="group bg-white p-4 hover:bg-blue-50/40">
      <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
      <div className="num mt-1 text-xl font-black text-slate-800">
        ₹{formatOrDash(amount, 2)}
      </div>
      <div className="num mt-0.5 text-[12px] font-semibold text-[#3E5FA0]">
        ₹{formatOrDash(perUnit, 3)} per litre · {formatOrDash(share, 1)}% of landed cost
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#4A6FA5]" style={{ width: `${share}%` }} />
      </div>
      <p className="mt-2 text-[11px] text-slate-500">{note}</p>
    </Link>
  );
}
