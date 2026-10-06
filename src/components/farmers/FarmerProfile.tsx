"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Contact, Phone } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Section } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import { addDays } from "@/lib/dates";
import { perLitreToPerKg } from "@/lib/units";
import {
  CalendarHeatmap, ColumnChart, Donut, GAIA, SplitBar, TrendChart, shortDate,
  type BarDatum, type HeatDay, type TipRow,
} from "./charts";
import { TransporterPicker } from "./TransporterPicker";
import type { FarmerDay } from "@/lib/farmers/data";

export type RangeKey = "30d" | "90d" | "6m" | "1y" | "all" | "custom";

const RANGES: { key: Exclude<RangeKey, "custom">; label: string }[] = [
  { key: "30d", label: "30 days" },
  { key: "90d", label: "90 days" },
  { key: "6m", label: "6 months" },
  { key: "1y", label: "1 year" },
  { key: "all", label: "All time" },
];

type Metric = "litres" | "fat" | "snf" | "kgfat";
const METRICS: { key: Metric; label: string; unit: string; decimals: number }[] = [
  { key: "litres", label: "Litres", unit: "L", decimals: 1 },
  { key: "fat", label: "Fat %", unit: "% fat", decimals: 2 },
  { key: "snf", label: "SNF %", unit: "% SNF", decimals: 2 },
  { key: "kgfat", label: "Kg fat", unit: "kg fat", decimals: 2 },
];

/** Fat bands for the donut - ordered, so they take the ordinal green ramp. */
const FAT_BANDS = [
  { label: "Below 3.5%", test: (f: number) => f < 3.5 },
  { label: "3.5 – 4.0%", test: (f: number) => f >= 3.5 && f < 4 },
  { label: "4.0 – 4.5%", test: (f: number) => f >= 4 && f < 4.5 },
  { label: "4.5% and up", test: (f: number) => f >= 4.5 },
];

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
      <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
      <div className="mt-1 text-[22px] font-bold leading-tight text-foreground">{value}</div>
      {sub ? <div className="mt-0.5 text-[11px] text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

/** Last four characters only - bank details don't need to sit fully on screen. */
const masked = (s: string | null | undefined) => (s ? `•••• ${s.slice(-4)}` : "—");

export function FarmerProfile({
  farmer, days, transport, range, from, to, today, kgPerLitre, notice,
}: {
  farmer: {
    center: string; centerName: string; isTanker: boolean;
    code: string; name: string; mobile: string | null; milkType: string | null;
    bank: string | null; branch: string | null; account: string | null; ifsc: string | null; joined: string | null;
  };
  days: FarmerDay[];
  /** Their milk-to-plant transporter and their share of its cost, by day. */
  transport: { current: string | undefined; options: { id: string; name: string }[]; byDay: Record<string, number> };
  range: RangeKey;
  from: string;
  to: string;
  today: string;
  kgPerLitre: number;
  notice: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [metric, setMetric] = useState<Metric>("litres");
  const [custom, setCustom] = useState({ from, to });
  const [showTable, setShowTable] = useState(false);

  const go = (qs: string) => start(() => router.push(`/farmers/${encodeURIComponent(farmer.code)}?center=${encodeURIComponent(farmer.center)}&${qs}`));

  const byDay = useMemo(() => new Map(days.map((d) => [d.day, d])), [days]);
  const allDays = useMemo(() => {
    const out: string[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [from, to]);

  const t = useMemo(() => {
    const litres = days.reduce((s, d) => s + d.litres, 0);
    const kgFat = days.reduce((s, d) => s + d.kg_fat, 0);
    const kgSnf = days.reduce((s, d) => s + d.kg_snf, 0);
    const amount = days.reduce((s, d) => s + d.amount, 0);
    const kgMilk = litres * kgPerLitre;
    return {
      litres, kgFat, kgSnf, amount,
      fat: kgMilk ? (kgFat / kgMilk) * 100 : null,
      snf: kgMilk ? (kgSnf / kgMilk) * 100 : null,
      // ₹ per litre over only the litres that had a price (off-chart readings have none)
      rate: (() => {
        const priced = days.reduce((s, d) => s + (d.price ? d.amount / d.price : 0), 0);
        return priced ? amount / priced : null;
      })(),
      morning: days.reduce((s, d) => s + d.morning_litres, 0),
      evening: days.reduce((s, d) => s + d.evening_litres, 0),
      perDay: days.length ? litres / days.length : 0,
      // transport: only days the transporter has a cost for count towards ₹/L
      transportCost: Object.values(transport.byDay).reduce((s, c) => s + c, 0),
      transportLitres: days.filter((d) => transport.byDay[d.day] !== undefined).reduce((s, d) => s + d.litres, 0),
    };
  }, [days, kgPerLitre, transport.byDay]);

  const tipFor = (d: FarmerDay): TipRow[] => [
    { label: "litres", value: formatNumber(d.litres, 1) },
    { label: "fat", value: `${formatNumber(d.fat_pct, 2)}%` },
    { label: "SNF", value: `${formatNumber(d.snf_pct, 2)}%` },
    { label: "kg fat · kg SNF", value: `${formatNumber(d.kg_fat, 1)} · ${formatNumber(d.kg_snf, 1)}` },
  ];

  const heat: HeatDay[] = days.map((d) => ({
    day: d.day,
    value: metric === "litres" ? d.litres : metric === "fat" ? d.fat_pct : metric === "snf" ? d.snf_pct : d.kg_fat,
    tip: tipFor(d),
  }));
  const m = METRICS.find((x) => x.key === metric)!;

  const months: BarDatum[] = useMemo(() => {
    const map = new Map<string, { litres: number; kgFat: number; kgSnf: number; days: number; amount: number; priced: number }>();
    for (const d of days) {
      const key = d.day.slice(0, 7);
      const e = map.get(key) ?? { litres: 0, kgFat: 0, kgSnf: 0, days: 0, amount: 0, priced: 0 };
      e.litres += d.litres; e.kgFat += d.kg_fat; e.kgSnf += d.kg_snf; e.days += 1;
      e.amount += d.amount; e.priced += d.price ? d.amount / d.price : 0;
      map.set(key, e);
    }
    const keys: string[] = [];
    for (let d = from.slice(0, 7); d <= to.slice(0, 7);) {
      keys.push(d);
      const [y, mo] = d.split("-").map(Number);
      d = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
    }
    return keys.map((key) => {
      const e = map.get(key) ?? { litres: 0, kgFat: 0, kgSnf: 0, days: 0, amount: 0, priced: 0 };
      const kg = e.litres * kgPerLitre;
      const [y, mo] = key.split("-").map(Number);
      return {
        key,
        label: `${MONTH[mo - 1]} ${String(y).slice(2)}`,
        value: e.litres,
        tip: [
          { label: "litres", value: formatNumber(e.litres, 0), color: GAIA.blue },
          { label: "fat", value: kg ? `${formatNumber((e.kgFat / kg) * 100, 2)}%` : "—" },
          { label: "SNF", value: kg ? `${formatNumber((e.kgSnf / kg) * 100, 2)}%` : "—" },
          { label: "₹ / L", value: e.priced ? formatNumber(e.amount / e.priced, 2) : "—" },
          { label: "₹ / kg", value: e.priced ? formatNumber(perLitreToPerKg(e.amount / e.priced, kgPerLitre), 2) : "—" },
          { label: "₹ paid", value: formatNumber(e.amount, 0) },
          { label: "days supplied", value: String(e.days) },
        ],
      };
    });
  }, [days, from, to, kgPerLitre]);

  const bands = FAT_BANDS.map((b, i) => {
    const litres = days.filter((d) => d.fat_pct !== null && b.test(d.fat_pct)).reduce((s, d) => s + d.litres, 0);
    return { label: b.label, value: litres, color: GAIA.ordinalGreen[i], note: `${formatNumber(litres, 0)} L` };
  });

  const litresPoints = allDays.map((day) => ({ day, value: byDay.get(day)?.litres ?? 0 }));
  const fatPoints = allDays.map((day) => ({ day, value: byDay.get(day)?.fat_pct ?? null }));
  const snfPoints = allDays.map((day) => ({ day, value: byDay.get(day)?.snf_pct ?? null }));
  const pricePoints = allDays.map((day) => ({ day, value: byDay.get(day)?.price ?? null }));
  const extraTip = (day: string): TipRow[] => {
    const d = byDay.get(day);
    return d ? [{ label: "fat", value: `${formatNumber(d.fat_pct, 2)}%` }, { label: "SNF", value: `${formatNumber(d.snf_pct, 2)}%` }] : [];
  };
  // the price curve's hover: the same price per kg, then the quality behind it
  const priceTip = (day: string): TipRow[] => {
    const d = byDay.get(day);
    return d?.price ? [{ label: "₹ / kg", value: formatNumber(perLitreToPerKg(d.price, kgPerLitre), 2) }, ...extraTip(day)] : extraTip(day);
  };

  const rangeText = `${shortDate(from)} – ${shortDate(to)}`;

  return (
    <div className="flex flex-1 flex-col bg-background p-4 md:p-6">
      <div className="w-full space-y-5">
        <PageHeader
          icon={Contact}
          title={farmer.name || `Farmer ${farmer.code}`}
          subtitle={`${farmer.centerName} · code ${farmer.code}${farmer.milkType ? ` · ${farmer.milkType} milk` : ""}${farmer.joined ? ` · registered ${farmer.joined}` : ""}`}
          actions={<Link href="/farmers" className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">← All farmers</Link>}
        />

        {notice ? <div className="rounded-lg border border-border bg-muted/50 px-4 py-3 text-[13px] font-semibold">{notice}</div> : null}

        {/* one filter row, above everything it scopes */}
        <div className={`flex flex-wrap items-center gap-3 ${pending ? "opacity-60" : ""}`}>
          <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
            {RANGES.map((r) => (
              <button
                key={r.key}
                onClick={() => go(`range=${r.key}`)}
                className={`rounded-md px-3 py-1.5 text-[12px] font-semibold ${range === r.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => { e.preventDefault(); go(`range=custom&from=${custom.from}&to=${custom.to}`); }}
          >
            <Input type="date" value={custom.from} max={today} onChange={(e) => setCustom((c) => ({ ...c, from: e.target.value }))} className="h-8 w-36" />
            <span className="text-[12px] text-muted-foreground">to</span>
            <Input type="date" value={custom.to} max={today} onChange={(e) => setCustom((c) => ({ ...c, to: e.target.value }))} className="h-8 w-36" />
            <Button type="submit" variant={range === "custom" ? "default" : "outline"} className={range === "custom" ? "bg-foreground text-background hover:bg-foreground/85" : ""}>
              Show
            </Button>
          </form>
          <span className="text-[12px] text-muted-foreground">{rangeText} · {allDays.length} days</span>
          {farmer.isTanker ? (
            <span className="ml-auto rounded-md bg-muted px-2.5 py-1 text-[12px] font-semibold text-foreground">
              Tanker supplier · tanker price not set yet
            </span>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[12px] font-semibold text-muted-foreground">Transporter</span>
              <TransporterPicker center={farmer.center} code={farmer.code} current={transport.current} transporters={transport.options} className="w-48" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Milk" value={`${formatNumber(t.litres, 0)} L`} sub={`${formatNumber(t.perDay, 1)} L a day on days supplied`} />
          <Stat label="Kg fat" value={formatNumber(t.kgFat, 1)} sub={t.fat !== null ? `avg ${formatNumber(t.fat, 2)}% fat` : "—"} />
          <Stat label="Kg SNF" value={formatNumber(t.kgSnf, 1)} sub={t.snf !== null ? `avg ${formatNumber(t.snf, 2)}% SNF` : "—"} />
          <Stat label="Paid" value={`₹${formatNumber(t.amount, 0)}`} sub={t.rate !== null ? `avg ₹${formatNumber(t.rate, 2)} / L · ₹${formatNumber(perLitreToPerKg(t.rate, kgPerLitre), 2)} / kg` : "—"} />
          <Stat label="Days supplied" value={`${days.length}`} sub={`of ${allDays.length} days (${formatNumber(allDays.length ? (days.length / allDays.length) * 100 : 0, 0)}%)`} />
          <Stat
            label="Average fat · SNF"
            value={t.fat !== null ? `${formatNumber(t.fat, 2)}% · ${formatNumber(t.snf, 2)}%` : "—"}
            sub="weighted by litres"
          />
          <Stat
            label="Transport cost"
            value={t.transportCost ? `₹${formatNumber(t.transportCost, 0)}` : "—"}
            sub={
              !transport.current ? "choose a transporter above"
              : t.transportLitres ? `₹${formatNumber(t.transportCost / t.transportLitres, 2)} / L · share of ${transport.options.find((o) => o.id === transport.current)?.name ?? "transporter"}`
              : "no transport cost entered for these days"
            }
          />
          <Stat label="Last supplied" value={days.length ? shortDate(days[days.length - 1].day) : "—"} sub={days.length ? `first in range ${shortDate(days[0].day)}` : "nothing in this period"} />
        </div>

        <Section
          title="Every day"
          description={`Darker = more ${m.label.toLowerCase()}. Grey = no milk that day. Hover a day for its litres, fat and SNF.`}
          actions={
            <div className="inline-flex rounded-lg border border-border bg-white p-0.5">
              {METRICS.map((x) => (
                <button key={x.key} onClick={() => setMetric(x.key)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-semibold ${metric === x.key ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  {x.label}
                </button>
              ))}
            </div>
          }
        >
          <div className="px-4 py-4">
            <CalendarHeatmap from={from} to={to} days={heat} unit={m.unit} decimals={m.decimals} />
          </div>
        </Section>

        <Section title="Milk each day" description="Litres per day, both shifts together. Hover for the day's fat and SNF.">
          <div className="px-2 py-3">
            <TrendChart points={litresPoints} color={GAIA.blue} unit="litres" decimals={1} extraTip={extraTip} />
          </div>
        </Section>

        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Fat % each day" description="Gaps are days with no milk.">
            <div className="px-2 py-3"><TrendChart points={fatPoints} color={GAIA.green} unit="% fat" decimals={2} zeroBased={false} height={180} /></div>
          </Section>
          <Section title="SNF % each day" description="Gaps are days with no milk.">
            <div className="px-2 py-3"><TrendChart points={snfPoints} color={GAIA.green} unit="% SNF" decimals={2} zeroBased={false} height={180} /></div>
          </Section>
        </div>

        <Section
          title="Price ₹ / L each day"
          description="What this farmer was paid per litre (hover for ₹ per kg). From 1 Oct 2026 it's calculated from the rate chart (fat and CLR); before that it's the price the Vamaa app sent. Gaps are days with no milk or no price."
        >
          <div className="px-2 py-3">
            <TrendChart points={pricePoints} color={GAIA.blue} unit="₹ / L" decimals={2} zeroBased={false} height={180} extraTip={priceTip} />
          </div>
        </Section>

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Section title="Milk by month" description="Litres per month. Hover a month for its fat, SNF and days supplied.">
              <div className="px-2 py-3"><ColumnChart data={months} color={GAIA.blue} unit="litres" /></div>
            </Section>
          </div>
          <div className="space-y-5">
            <Section title="Milk by fat band" description="Share of litres at each fat level.">
              <div className="px-4 py-4">
                <Donut slices={bands} centre={`${formatNumber(t.fat, 2)}%`} centreLabel="avg fat" />
              </div>
            </Section>
            <Section title="Morning and evening">
              <div className="px-4 py-4">
                <SplitBar parts={[
                  { label: "Morning", value: t.morning, color: GAIA.blue },
                  { label: "Evening", value: t.evening, color: GAIA.green },
                ]} />
              </div>
            </Section>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-3">
          <Section title="Contact & bank">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 px-4 py-4 text-[13px]">
              <dt className="text-muted-foreground">Mobile</dt>
              <dd className="num flex items-center gap-1.5 text-foreground">
                {farmer.mobile ? <><Phone className="h-3.5 w-3.5 text-muted-foreground" /><a href={`tel:${farmer.mobile}`} className="hover:underline">{farmer.mobile}</a></> : "—"}
              </dd>
              <dt className="text-muted-foreground">Bank</dt>
              <dd className="text-foreground">{farmer.bank || "—"}{farmer.branch ? `, ${farmer.branch}` : ""}</dd>
              <dt className="text-muted-foreground">Account</dt>
              <dd className="num text-foreground">{masked(farmer.account)}</dd>
              <dt className="text-muted-foreground">IFSC</dt>
              <dd className="num text-foreground">{farmer.ifsc || "—"}</dd>
            </dl>
          </Section>
          <div className="lg:col-span-2">
            <Section
              title="Daily data"
              description="Every day in the period as numbers - the same figures the charts show."
              actions={
                <button onClick={() => setShowTable((v) => !v)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">
                  {showTable ? "Hide" : `Show ${days.length} days`}
                </button>
              }
            >
              {showTable ? (
                <div className="max-h-96 overflow-auto">
                  <table className="w-full whitespace-nowrap text-[12px]">
                    <thead className="sticky top-0 bg-secondary text-[10px] uppercase tracking-wide text-tertiary-foreground">
                      <tr>
                        {["Date", "Litres", "Morning", "Evening", "Fat %", "SNF %", "Kg fat", "Kg SNF", "₹ / L", "₹ / kg", "Paid ₹", "Transport ₹"].map((h, i) => (
                          <th key={h} className={`px-3 py-2 font-medium ${i ? "text-right" : "text-left"}`}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="num">
                      {[...days].reverse().map((d) => (
                        <tr key={d.day} className="border-b border-border/60">
                          <td className="px-3 py-1.5 text-foreground">{shortDate(d.day)}</td>
                          <td className="px-3 py-1.5 text-right font-semibold text-foreground">{formatNumber(d.litres, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.morning_litres, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.evening_litres, 1)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.fat_pct, 2)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.snf_pct, 2)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.kg_fat, 2)}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.kg_snf, 2)}</td>
                          <td className="px-3 py-1.5 text-right">{d.price ? formatNumber(d.price, 2) : "—"}</td>
                          <td className="px-3 py-1.5 text-right">{d.price ? formatNumber(perLitreToPerKg(d.price, kgPerLitre), 2) : "—"}</td>
                          <td className="px-3 py-1.5 text-right">{formatNumber(d.amount, 0)}</td>
                          <td className="px-3 py-1.5 text-right">
                            {transport.byDay[d.day] !== undefined ? formatNumber(transport.byDay[d.day], 2) : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : null}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
