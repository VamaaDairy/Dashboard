"use client";

import { useState } from "react";
import Link from "next/link";
import {
  CalendarHeatmap, ColumnChart, DivergingColumns, GAIA, MatrixHeatmap, SplitBar, StackedColumns, TrendChart, shortDate,
} from "@/components/farmers/charts";
import { Panel, PeriodBar, Tiles, dayList } from "@/components/dash/Dash";
import { THead, Th } from "@/components/tanks/ui";
import { formatNumber } from "@/lib/format";
import type { FarmerTransportDay, MilkInDay, MilkQuality, PlantFuelUse, TankFlowDay, TankLevel, TransportDay } from "@/lib/dash/data";
import { COST } from "@/lib/costing/colors";

const rs = (v: number, d = 0) => `₹${formatNumber(v, d)}`;
const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((t, x) => t + f(x), 0);
const pct = (kg: number, litres: number) => (litres > 0 ? (kg / (litres * 1.03)) * 100 : null);
const td = "num px-3 py-1.5 text-right";

function byDay<T extends { day: string }>(rows: T[]) {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(r.day, [...(m.get(r.day) ?? []), r]);
  return m;
}

// ================================================================ tanks

/** One tank drawn as a vessel, filled to its level. */
function TankGauge({ t }: { t: TankLevel }) {
  const cap = t.capacity ? Number(t.capacity) : null;
  const fill = cap ? Math.min(1, Number(t.litres) / cap) : 0;
  const empty = Number(t.litres) <= 0.5;
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg bg-muted/40 px-3 py-3">
      <div className="relative h-28 w-16 overflow-hidden rounded-b-xl rounded-t-md border-2 border-foreground/20 bg-white">
        <div className="absolute inset-x-0 bottom-0" style={{ height: `${fill * 100}%`, background: GAIA.blue, opacity: 0.85 }} />
        {[0.25, 0.5, 0.75].map((m) => <div key={m} className="absolute inset-x-0 border-t border-dashed border-foreground/15" style={{ bottom: `${m * 100}%` }} />)}
        <div className="absolute inset-x-0 top-1 text-center text-[11px] font-bold text-foreground">{cap ? `${formatNumber(fill * 100, 0)}%` : ""}</div>
      </div>
      <div className="text-center">
        <div className="text-[12px] font-semibold text-foreground">{t.name}</div>
        <div className="num text-[11px] text-muted-foreground">{formatNumber(Number(t.litres), 0)} / {cap ? formatNumber(cap, 0) : "—"} L</div>
        <div className="num text-[11px] text-muted-foreground">
          {empty ? "empty" : `${formatNumber(Number(t.fat_pct ?? 0), 2)} fat · ${formatNumber(Number(t.snf_pct ?? 0), 2)} SNF`}
        </div>
        {!empty && t.cost_per_litre ? <div className="num text-[11px] text-muted-foreground">{rs(Number(t.cost_per_litre), 2)} / L</div> : null}
      </div>
    </div>
  );
}

export function TanksDashboard({ from, to, today, flows, stock, levels }: {
  from: string; to: string; today: string; flows: TankFlowDay[]; stock: number; levels: TankLevel[];
}) {
  const dates = dayList(from, to);
  const days = byDay(flows);
  const inF = sum(flows, (f) => f.in_farmers), inO = sum(flows, (f) => f.in_other);
  const inAll = inF + inO;
  const outP = sum(flows, (f) => f.out_production);
  const cost = sum(flows, (f) => f.in_cost);
  const capacity = sum(levels, (t) => Number(t.capacity ?? 0));
  const tanks = [...new Map(flows.map((f) => [f.tank_id, f.tank])).entries()];
  // each tank keeps its last balance until it moves again, so a day's closing counts every tank
  const last = new Map<string, number>();
  const daily = dates.map((d) => {
    const fs = days.get(d) ?? [];
    for (const f of fs) if (f.close !== null) last.set(f.tank_id, Number(f.close));
    const i = sum(fs, (f) => f.in_farmers + f.in_other);
    return {
      day: d, in: i, farmers: sum(fs, (f) => f.in_farmers), other: sum(fs, (f) => f.in_other),
      out: sum(fs, (f) => f.out_production + f.out_other), fat: pct(sum(fs, (f) => f.in_fat_kg), i),
      snf: pct(sum(fs, (f) => f.in_snf_kg), i), rate: i > 0 ? sum(fs, (f) => f.in_cost) / i : null,
      close: last.size ? [...last.values()].reduce((t, v) => t + v, 0) : null,
    };
  });
  const dmap = new Map(daily.map((d) => [d.day, d]));
  const fatAll = pct(sum(flows, (f) => f.in_fat_kg), inAll);
  const snfAll = pct(sum(flows, (f) => f.in_snf_kg), inAll);

  return (
    <div className="space-y-5">
      <PeriodBar from={from} to={to} today={today} />

      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">The tanks at the end of {shortDate(to)}</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Level, blend and cost of the milk in each tank.</p>
          </div>
          <div className="num text-[13px] text-muted-foreground">
            <span className="text-[22px] font-bold text-foreground">{formatNumber(stock, 0)}</span> L of {formatNumber(capacity, 0)} L capacity
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5 xl:grid-cols-10">
          {levels.map((t) => <TankGauge key={t.tank_id} t={t} />)}
        </div>
      </section>

      <Tiles items={[
        { label: "Milk into tanks", value: formatNumber(inAll, 0), unit: "L", note: `${formatNumber(inAll / Math.max(1, daily.filter((d) => d.in > 0).length), 0)} L a day` },
        { label: "Drawn for batches", value: formatNumber(outP, 0), unit: "L", note: inAll ? `${formatNumber((outP / inAll) * 100, 1)}% of what came in` : undefined },
        { label: "Fat in", value: fatAll === null ? "—" : formatNumber(fatAll, 2), unit: "%", note: `${formatNumber(sum(flows, (f) => f.in_fat_kg), 0)} kg fat` },
        { label: "SNF in", value: snfAll === null ? "—" : formatNumber(snfAll, 2), unit: "%", note: `${formatNumber(sum(flows, (f) => f.in_snf_kg), 0)} kg SNF` },
        { label: "Cost of milk in", value: rs(cost), note: inAll ? `${rs(cost / inAll, 2)} per litre` : undefined },
        { label: "Farmers' share", value: inAll ? formatNumber((inF / inAll) * 100, 0) : "—", unit: "%", note: `${formatNumber(inF, 0)} L from farmers` },
      ]} />

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel title="In and out, every day" description="Milk put into the tanks above the line, milk drawn for production below it. A day that drew more than came in ran the tanks down.">
          <DivergingColumns days={dates} unit="L" upLabel="In" downLabel="Drawn"
            up={Object.fromEntries(daily.map((d) => [d.day, d.in]))} down={Object.fromEntries(daily.map((d) => [d.day, d.out]))} />
        </Panel>
        <Panel title="Where the milk came from" description="Litres in over the period.">
          <SplitBar parts={[
            { label: "Farmers", value: inF, color: GAIA.blue },
            { label: "Tankers", value: inO, color: GAIA.orange },
          ]} />
          <div className="mt-5 space-y-2 border-t border-border pt-3 text-[12px]">
            <div className="flex justify-between"><span className="text-muted-foreground">Average blend in (fat · SNF)</span><span className="num font-semibold text-foreground">{formatNumber(fatAll ?? 0, 2)} · {formatNumber(snfAll ?? 0, 2)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Days with milk in</span><span className="num font-semibold text-foreground">{daily.filter((d) => d.in > 0).length}</span></div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Fat % of milk in" description="Weighted by litres.">
          <TrendChart color={GAIA.blue} unit="fat %" decimals={2} zeroBased={false} emptyLabel="nothing in"
            points={dates.map((d) => ({ day: d, value: dmap.get(d)?.fat ?? null }))}
            extraTip={(d) => [{ label: "SNF %", value: dmap.get(d)?.snf == null ? "—" : formatNumber(dmap.get(d)!.snf!, 2) }]} />
        </Panel>
        <Panel title="What a litre in cost" description="Farmers at the rate chart / app price, tankers at their load price - weighted.">
          <TrendChart color={GAIA.orange} unit="₹ / L" decimals={2} zeroBased={false} emptyLabel="nothing in"
            points={dates.map((d) => ({ day: d, value: dmap.get(d)?.rate ?? null }))} />
        </Panel>
      </div>

      <Panel title="How milk moved through each tank" description="Over the period: milk received from farmers and tankers, moved in from another tank, moved on, and drawn for production.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Tank</Th><Th>Received L</Th><Th>Moved in L</Th><Th>Moved on L</Th><Th>Drawn for batches L</Th><Th>Days used</Th></THead>
            <tbody>
              {tanks.map(([id, name]) => {
                const fs = flows.filter((f) => f.tank_id === id);
                return (
                  <tr key={id} className="border-b border-border/70 hover:bg-muted/60">
                    <td className="px-3 py-1.5 font-semibold text-foreground">{name}</td>
                    <td className={td}>{formatNumber(sum(fs, (f) => f.in_farmers + f.in_other), 0)}</td>
                    <td className={td}>{formatNumber(sum(fs, (f) => f.in_transfer), 0)}</td>
                    <td className={td}>{formatNumber(sum(fs, (f) => f.out_transfer), 0)}</td>
                    <td className={`${td} font-semibold text-foreground`}>{formatNumber(sum(fs, (f) => f.out_production), 0)}</td>
                    <td className={`${td} text-muted-foreground`}>{fs.length}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Litres in each tank at the end of the day" description="Only days a tank moved. Darker = fuller.">
        <MatrixHeatmap days={dates} unit="L" emptyLabel="no movement" showTotal={false}
          rows={tanks.map(([id, name]) => ({ key: id, label: name, cells: Object.fromEntries(flows.filter((f) => f.tank_id === id).map((f) => [f.day, f.close === null ? null : Number(f.close)])) }))} />
      </Panel>

      <Panel title="Day by day">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Date</Th><Th>Farmers L</Th><Th>Tankers L</Th><Th>Drawn L</Th><Th>Fat %</Th><Th>SNF %</Th><Th>₹ / L in</Th><Th>Closing L</Th></THead>
            <tbody>
              {[...daily].reverse().filter((d) => d.in > 0 || d.out > 0).map((d) => (
                <tr key={d.day} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-3 py-1.5"><Link href={`/tanks?date=${d.day}`} className="font-semibold text-foreground hover:underline">{shortDate(d.day)}</Link></td>
                  <td className={td}>{formatNumber(d.farmers, 0)}</td>
                  <td className={td}>{formatNumber(d.other, 0)}</td>
                  <td className={td}>{formatNumber(d.out, 0)}</td>
                  <td className={td}>{d.fat === null ? "—" : formatNumber(d.fat, 2)}</td>
                  <td className={td}>{d.snf === null ? "—" : formatNumber(d.snf, 2)}</td>
                  <td className={td}>{d.rate === null ? "—" : formatNumber(d.rate, 2)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{d.close === null ? "—" : formatNumber(d.close, 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ================================================================ fuel & transport

const SECTION = { milk_to_plant: "Milk to plant", delivery: "Delivery" } as const;

export function FuelDashboard({ from, to, today, runs, plant, milk }: {
  from: string; to: string; today: string; runs: TransportDay[]; plant: PlantFuelUse[]; milk: Record<string, number>;
}) {
  const dates = dayList(from, to);
  const runDays = byDay(runs), plantDays = byDay(plant);
  const mtp = sum(runs.filter((r) => r.section === "milk_to_plant"), (r) => r.cost);
  const del = sum(runs.filter((r) => r.section === "delivery"), (r) => r.cost);
  const pf = sum(plant, (p) => p.cost);
  const total = mtp + del + pf;
  const milkTotal = Object.values(milk).reduce((t, v) => t + v, 0);
  const daily = dates.map((d) => {
    const rs_ = runDays.get(d) ?? [];
    const ps = plantDays.get(d) ?? [];
    const m = sum(rs_.filter((r) => r.section === "milk_to_plant"), (r) => r.cost);
    const dl = sum(rs_.filter((r) => r.section === "delivery"), (r) => r.cost);
    const p = sum(ps, (x) => x.cost);
    return { day: d, mtp: m, del: dl, plant: p, total: m + dl + p, milk: milk[d] ?? 0, coal: sum(ps, (x) => Number(x.qty)) };
  });
  const dmap = new Map(daily.map((d) => [d.day, d]));

  // one card per transporter (each section separately), largest cost first
  const who = new Map<string, { name: string; section: keyof typeof SECTION; cost: number; km: number; trips: number; diesel: number; days: number; cells: Record<string, number> }>();
  for (const r of runs) {
    const k = `${r.transporter}|${r.section}`;
    const w = who.get(k) ?? { name: r.transporter, section: r.section, cost: 0, km: 0, trips: 0, diesel: 0, days: 0, cells: {} };
    w.cost += r.cost; w.km += Number(r.km ?? 0); w.trips += Number(r.trips ?? 0); w.diesel += Number(r.diesel ?? 0); w.days += 1;
    w.cells[r.day] = (w.cells[r.day] ?? 0) + r.cost;
    who.set(k, w);
  }
  const ranked = [...who.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const top = ranked[0]?.[1].cost ?? 1;

  return (
    <div className="space-y-5">
      <PeriodBar from={from} to={to} today={today} />

      <section className="rounded-lg border border-border bg-card p-4 shadow-xs">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h3 className="text-[13px] font-semibold text-foreground">Who cost what</h3>
            <p className="mt-0.5 text-[12px] text-muted-foreground">Every transporter in both sections, largest first - what they ran and what it came to per km, trip or day.</p>
          </div>
          <div className="num text-[13px] text-muted-foreground"><span className="text-[22px] font-bold text-foreground">{rs(total)}</span> fuel & transport</div>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {ranked.map(([k, w], i) => (
            <li key={k} className="rounded-lg bg-muted/50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground"><span className="inline-block h-2 w-2 rounded-sm" style={{ background: w.section === "delivery" ? COST.fuel_delivery.color : COST.fuel_procurement.color }} />#{i + 1} · {SECTION[w.section]}</div>
                  <div className="text-[14px] font-semibold text-foreground">{w.name}</div>
                </div>
                <div className="num text-right text-[16px] font-bold text-foreground">{rs(w.cost)}</div>
              </div>
              <div className="mt-2 h-1.5 w-full rounded-full bg-white">
                <div className="h-1.5 rounded-full" style={{ width: `${(w.cost / top) * 100}%`, background: w.section === "delivery" ? COST.fuel_delivery.color : COST.fuel_procurement.color }} />
              </div>
              <div className="num mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {w.km ? <span>{formatNumber(w.km, 0)} km · {rs(w.cost / w.km, 2)}/km</span> : null}
                {w.trips ? <span>{formatNumber(w.trips, 0)} trips · {rs(w.cost / w.trips, 0)}/trip</span> : null}
                {w.diesel ? <span>{formatNumber(w.diesel, 0)} L diesel</span> : null}
                <span>{w.days} days · {rs(w.cost / w.days, 0)}/day</span>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <Panel title="Fuel & transport, day by day" description="Each day's three costs stacked. Delivery goes onto the SKUs; the other two are spread over the litres of milk processed.">
        <StackedColumns days={dates} unit="₹"
          series={[{ label: "Coal & plant fuel", color: COST.fuel_production.color }, { label: "Delivery", color: COST.fuel_delivery.color }, { label: "Milk to plant", color: COST.fuel_procurement.color }]}
          values={Object.fromEntries(daily.map((d) => [d.day, [d.plant, d.del, d.mtp]]))} />
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Per litre of milk processed" description="Milk to plant + plant fuel ÷ the day's milk into batches.">
          <TrendChart color={GAIA.blue} unit="₹ / L" decimals={2} emptyLabel="no batches"
            points={dates.map((d) => {
              const x = dmap.get(d)!;
              return { day: d, value: x.milk > 0 ? (x.mtp + x.plant) / x.milk : null };
            })} />
          <div className="mt-2 text-[12px] text-muted-foreground">
            Period: <span className="num font-semibold text-foreground">{milkTotal ? rs((mtp + pf) / milkTotal, 2) : "—"}</span> per litre ·
            delivery <span className="num font-semibold text-foreground">{rs(del)}</span> onto SKUs
          </div>
        </Panel>
        <Panel title="Coal burned" description="Kg a day - it follows the milk processed.">
          <ColumnChart color={COST.fuel_production.color} unit="kg"
            data={dates.map((d) => ({
              key: d, label: shortDate(d).replace(/ \d+$/, ""), value: dmap.get(d)!.coal,
              tip: [{ label: "kg coal", value: formatNumber(dmap.get(d)!.coal, 0) }, { label: "₹", value: formatNumber(dmap.get(d)!.plant, 0) }],
            }))} />
        </Panel>
      </div>

      <Panel title="Each transporter, day by day" description="₹ per run. Darker = more.">
        <MatrixHeatmap days={dates} unit="₹" emptyLabel="no run"
          rows={ranked.map(([k, w]) => ({ key: k, label: `${w.name} · ${SECTION[w.section]}`, cells: w.cells }))} />
      </Panel>
    </div>
  );
}

// ================================================================ milk in

export function MilkInDashboard({ from, to, today, rows, quality }: {
  from: string; to: string; today: string; rows: MilkInDay[]; quality: MilkQuality;
}) {
  const dates = dayList(from, to);
  const days = byDay(rows);
  const litres = sum(rows, (r) => Number(r.litres));
  const priced = rows.filter((r) => r.amount !== null);
  const pricedL = sum(priced, (r) => Number(r.litres));
  const amount = sum(priced, (r) => Number(r.amount));
  const fatKg = sum(rows, (r) => Number(r.fat_kg)), snfKg = sum(rows, (r) => Number(r.snf_kg));
  const centres = [...new Map(rows.map((r) => [r.center, r.centre])).entries()];
  const daily = dates.map((d) => {
    const rs_ = days.get(d) ?? [];
    const l = sum(rs_, (r) => Number(r.litres));
    const pr = rs_.filter((r) => r.amount !== null);
    const pl = sum(pr, (r) => Number(r.litres));
    return {
      day: d, litres: l, farmers: sum(rs_.filter((r) => r.kind !== "tanker"), (r) => r.farmers),
      fat: pct(sum(rs_, (r) => Number(r.fat_kg)), l), snf: pct(sum(rs_, (r) => Number(r.snf_kg)), l),
      rate: pl > 0 ? sum(pr, (r) => Number(r.amount)) / pl : null,
    };
  });
  const dmap = new Map(daily.map((d) => [d.day, d]));
  const active = daily.filter((d) => d.litres > 0);
  const best = [...active].sort((a, b) => b.litres - a.litres)[0];
  const bandTotal = sum(quality.bands, (x) => x.litres);

  return (
    <div className="space-y-5">
      <PeriodBar from={from} to={to} today={today} />

      <section className="grid gap-5 rounded-lg border border-border bg-card p-4 shadow-xs lg:grid-cols-[1fr_2fr]">
        <div className="flex flex-col justify-between gap-4">
          <div>
            <div className="text-[12px] text-muted-foreground">Milk collected, {shortDate(from)} – {shortDate(to)}</div>
            <div className="num mt-1 text-[40px] font-bold leading-none text-foreground">{formatNumber(litres, 0)} <span className="text-[16px] font-semibold text-muted-foreground">L</span></div>
            <div className="num mt-2 text-[13px] text-muted-foreground">
              {formatNumber(litres / Math.max(1, active.length), 0)} L a day · best {best ? `${formatNumber(best.litres, 0)} L on ${shortDate(best.day)}` : "—"}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-[12px]">
            <div><dt className="text-muted-foreground">Fat · SNF</dt><dd className="num text-[15px] font-semibold text-foreground">{formatNumber(pct(fatKg, litres) ?? 0, 2)} · {formatNumber(pct(snfKg, litres) ?? 0, 2)}</dd></div>
            <div><dt className="text-muted-foreground">Kg fat · kg SNF</dt><dd className="num text-[15px] font-semibold text-foreground">{formatNumber(fatKg, 0)} · {formatNumber(snfKg, 0)}</dd></div>
            <div><dt className="text-muted-foreground">Paid to farmers</dt><dd className="num text-[15px] font-semibold text-foreground">{rs(amount)}</dd></div>
            <div><dt className="text-muted-foreground">Average price</dt><dd className="num text-[15px] font-semibold text-foreground">{pricedL ? `${rs(amount / pricedL, 2)} / L` : "—"}</dd></div>
          </dl>
        </div>
        <div>
          <div className="mb-2 text-[12px] font-semibold text-foreground">Every day of collection</div>
          <CalendarHeatmap from={from} to={to} unit="L"
            days={active.map((d) => ({
              day: d.day, value: d.litres,
              tip: [
                { label: "farmers", value: String(d.farmers) },
                { label: "fat %", value: d.fat === null ? "—" : formatNumber(d.fat, 2) },
                { label: "₹ / L", value: d.rate === null ? "—" : formatNumber(d.rate, 2) },
              ],
            }))} />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <Panel title="How rich the milk was" description="Litres of farmers' milk in each fat band. Further right = richer milk, a better price on the chart.">
          <ColumnChart color={GAIA.blue} unit="L"
            data={quality.bands.map((b) => ({
              key: b.band, label: b.band, value: b.litres,
              tip: [
                { label: "L", value: formatNumber(b.litres, 0) },
                { label: "farmers", value: String(b.farmers) },
                { label: "of all milk", value: `${formatNumber((b.litres / Math.max(1, bandTotal)) * 100, 0)}%` },
              ],
            }))} />
        </Panel>
        <Panel title="Morning or evening" description="Farmers' litres by shift.">
          <SplitBar parts={quality.shifts.map((s, i) => ({ label: s.shift, value: s.litres, color: i === 0 ? GAIA.blue : GAIA.orange }))} />
          <div className="mt-5 border-t border-border pt-3">
            <div className="text-[12px] text-muted-foreground">By centre</div>
            <ul className="mt-2 space-y-1 text-[12px]">
              {centres.map(([c, name]) => (
                <li key={c} className="flex justify-between gap-3">
                  <span className="text-muted-foreground">{name} ({c})</span>
                  <span className="num font-semibold text-foreground">{formatNumber(sum(rows.filter((r) => r.center === c), (r) => Number(r.litres)), 0)} L</span>
                </li>
              ))}
            </ul>
          </div>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel title="Fat % collected" description="Weighted by litres, day by day.">
          <TrendChart color={GAIA.blue} unit="fat %" decimals={2} zeroBased={false}
            points={dates.map((d) => ({ day: d, value: dmap.get(d)?.fat ?? null }))}
            extraTip={(d) => [{ label: "SNF %", value: dmap.get(d)?.snf == null ? "—" : formatNumber(dmap.get(d)!.snf!, 2) }]} />
        </Panel>
        <Panel title="Price paid per litre" description="Rate chart from 1 Oct 2026, the app's price before.">
          <TrendChart color={GAIA.orange} unit="₹ / L" decimals={2} zeroBased={false}
            points={dates.map((d) => ({ day: d, value: dmap.get(d)?.rate ?? null }))} />
        </Panel>
      </div>

      {centres.length > 1 ? (
        <Panel title="Each centre, day by day" description="Litres collected. Darker = more.">
          <MatrixHeatmap days={dates} unit="L" emptyLabel="no milk"
            rows={centres.map(([c, name]) => ({ key: c, label: `${name} (${c})`, cells: Object.fromEntries(rows.filter((r) => r.center === c).map((r) => [r.day, Number(r.litres)])) }))} />
        </Panel>
      ) : null}
    </div>
  );
}

// ================================================================ milk to plant transport, shared equally per farmer

/**
 * Milk-to-plant transport for the period: each transporter's day cost is split
 * equally among the farmers it carried that day (5 farmers -> cost / 5 each).
 * Shows the rule for one day, each transporter, the cost per litre over time,
 * and every farmer's share next to what their milk cost.
 */
export function MilkTransport({ from, to, rows, runs }: {
  from: string; to: string; rows: FarmerTransportDay[]; runs: TransportDay[];
}) {
  const dates = dayList(from, to);
  const mtp = runs.filter((r) => r.section === "milk_to_plant");
  const total = sum(mtp, (r) => r.cost);
  const shared = sum(rows, (r) => Number(r.cost ?? 0));
  const litres = sum(rows, (r) => Number(r.litres));
  const farmerDays = rows.length;
  const days = [...new Set(rows.map((r) => r.day))].sort();
  const [day, setDay] = useState(days[days.length - 1] ?? "");

  // per transporter
  type T = { name: string; cost: number; runDays: number; shared: number; litres: number; farmerDays: number; days: Set<string> };
  const blank = (name: string): T => ({ name, cost: 0, runDays: 0, shared: 0, litres: 0, farmerDays: 0, days: new Set<string>() });
  const byT = new Map<string, T>();
  for (const r of mtp) {
    const t = byT.get(r.transporter) ?? blank(r.transporter);
    t.cost += r.cost; t.runDays += 1;
    byT.set(r.transporter, t);
  }
  for (const r of rows) {
    const t = byT.get(r.transporter) ?? blank(r.transporter);
    t.shared += Number(r.cost ?? 0); t.litres += Number(r.litres); t.farmerDays += 1; t.days.add(r.day);
    byT.set(r.transporter, t);
  }

  // per farmer
  const byF = new Map<string, { code: string; center: string; name: string; transporter: string; days: number; litres: number; cost: number; milk: number }>();
  for (const r of rows) {
    const k = `${r.center}|${r.code}`;
    const f = byF.get(k) ?? { code: r.code, center: r.center, name: r.name ?? "", transporter: r.transporter, days: 0, litres: 0, cost: 0, milk: 0 };
    f.days += 1; f.litres += Number(r.litres); f.cost += Number(r.cost ?? 0); f.milk += Number(r.milk_amount ?? 0);
    byF.set(k, f);
  }
  const farmers = [...byF.entries()].sort((a, b) => (b[1].cost / Math.max(1, b[1].litres)) - (a[1].cost / Math.max(1, a[1].litres)));

  // per day: shared cost / litres of the farmers carried
  const perDay = new Map<string, { cost: number; litres: number }>();
  for (const r of rows) {
    const d = perDay.get(r.day) ?? { cost: 0, litres: 0 };
    d.cost += Number(r.cost ?? 0); d.litres += Number(r.litres);
    perDay.set(r.day, d);
  }

  // the rule, for the day picked
  const routes = new Map<string, { transporter: string; cost: number; farmers: FarmerTransportDay[] }>();
  for (const r of rows.filter((x) => x.day === day)) {
    const g = routes.get(r.transporter_id) ?? { transporter: r.transporter, cost: 0, farmers: [] };
    g.farmers.push(r);
    g.cost = Number(r.cost ?? 0) * r.farmers;
    routes.set(r.transporter_id, g);
  }
  const color = COST.fuel_procurement.color;

  return (
    <section className="space-y-5">
      <h2 className="pt-2 text-[15px] font-semibold text-foreground">Milk to plant transport - shared equally per farmer</h2>

      <Tiles items={[
        { label: "Transport cost", value: rs(total), note: `${mtp.length} runs, milk to plant` },
        { label: "Shared among farmers", value: rs(shared), note: `${farmerDays} farmer-days` },
        { label: "Not shared", value: rs(Math.max(0, total - shared)), note: "runs with no assigned farmer's milk that day (e.g. tankers)" },
        { label: "Per litre of farmers' milk", value: litres ? rs(shared / litres, 2) : "—", note: `${formatNumber(litres, 0)} L carried` },
        { label: "Per farmer per day", value: farmerDays ? rs(shared / farmerDays, 0) : "—", note: "average share" },
      ]} />

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="min-w-0 rounded-lg border-2 border-foreground/15 bg-card p-4 shadow-xs">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-semibold text-foreground">How a day is split</h3>
              <p className="mt-0.5 text-[12px] text-muted-foreground">Each transporter&apos;s cost that day ÷ the farmers whose milk it brought - the same share for each, whatever their litres.</p>
            </div>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="h-8 rounded-lg border border-border bg-white px-2 text-[13px] font-semibold" aria-label="Day">
              {[...days].reverse().map((d) => <option key={d} value={d}>{shortDate(d)}</option>)}
            </select>
          </div>
          <div className="mt-3 space-y-3">
            {[...routes.values()].map((g) => (
              <div key={g.transporter} className="rounded-lg bg-muted/60 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2 text-[13px]">
                  <span className="font-semibold text-foreground">{g.transporter}</span>
                  <span className="num text-muted-foreground">
                    {rs(g.cost)} ÷ {g.farmers.length} farmer{g.farmers.length > 1 ? "s" : ""} = <span className="font-bold" style={{ color }}>{rs(g.cost / g.farmers.length, 2)} each</span>
                  </span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                  {g.farmers.map((f) => (
                    <span key={`${f.center}|${f.code}`} className="num rounded-full bg-white px-2 py-0.5 text-muted-foreground">
                      {f.code}{f.name ? ` · ${f.name}` : ""} · {formatNumber(Number(f.litres), 0)} L · {Number(f.litres) ? rs(Number(f.cost ?? 0) / Number(f.litres), 2) : "—"}/L
                    </span>
                  ))}
                </div>
              </div>
            ))}
            {routes.size === 0 ? <p className="text-[12px] text-muted-foreground">No assigned farmer supplied milk this day.</p> : null}
          </div>
        </section>

        <Panel title="Transport per litre of farmers' milk" description="Shared cost ÷ litres of the farmers carried, day by day.">
          <TrendChart color={color} unit="₹ / L" decimals={2} emptyLabel="no runs" zeroBased={false}
            points={dates.map((d) => { const x = perDay.get(d); return { day: d, value: x && x.litres ? x.cost / x.litres : null }; })}
            extraTip={(d) => [{ label: "shared ₹", value: formatNumber(perDay.get(d)?.cost ?? 0, 0) }, { label: "L", value: formatNumber(perDay.get(d)?.litres ?? 0, 0) }]} />
        </Panel>
      </div>

      <Panel title="Each transporter" description="Its cost, how much of it was shared among farmers, and what a farmer carried on average.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Transporter</Th><Th>Days run</Th><Th>Cost ₹</Th><Th>Shared ₹</Th><Th>Farmers a day</Th><Th>₹ / farmer / day</Th><Th>Litres</Th><Th>₹ / L</Th></THead>
            <tbody>
              {[...byT.values()].sort((a, b) => b.cost - a.cost).map((t) => (
                <tr key={t.name} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="px-3 py-1.5 font-semibold text-foreground"><span className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{t.name}</td>
                  <td className={td}>{t.runDays}</td>
                  <td className={td}>{formatNumber(t.cost, 0)}</td>
                  <td className={td}>{formatNumber(t.shared, 0)}</td>
                  <td className={td}>{t.days.size ? formatNumber(t.farmerDays / t.days.size, 1) : "—"}</td>
                  <td className={`${td} font-semibold text-foreground`}>{t.farmerDays ? formatNumber(t.shared / t.farmerDays, 0) : "—"}</td>
                  <td className={td}>{formatNumber(t.litres, 0)}</td>
                  <td className={`${td} font-semibold text-foreground`}>{t.litres ? formatNumber(t.shared / t.litres, 2) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel title="Each farmer's transport" description="Their equal share of their transporter's cost over the period, next to what their milk cost - highest transport per litre first. Small suppliers carry more per litre, since every farmer on a route pays the same.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead><Th align="left">Code</Th><Th align="left">Farmer</Th><Th align="left">Transporter</Th><Th>Days</Th><Th>Litres</Th><Th>Milk ₹ / L</Th><Th>Transport ₹</Th><Th>Transport ₹ / L</Th><Th>Landed ₹ / L</Th></THead>
            <tbody>
              {farmers.map(([k, f]) => (
                <tr key={k} className="border-b border-border/70 hover:bg-muted/60">
                  <td className="num px-3 py-1.5 text-[12px]">{f.center} · {f.code}</td>
                  <td className="max-w-56 truncate px-3 py-1.5 font-semibold text-foreground">
                    <Link href={`/farmers/${f.code}?center=${f.center}`} className="hover:underline">{f.name || "—"}</Link>
                  </td>
                  <td className="px-3 py-1.5 text-[12px] text-muted-foreground">{f.transporter}</td>
                  <td className={td}>{f.days}</td>
                  <td className={td}>{formatNumber(f.litres, 0)}</td>
                  <td className={td}>{f.litres && f.milk ? formatNumber(f.milk / f.litres, 2) : "—"}</td>
                  <td className={td}>{formatNumber(f.cost, 0)}</td>
                  <td className={`${td} font-semibold`} style={{ color }}>{f.litres ? formatNumber(f.cost / f.litres, 2) : "—"}</td>
                  <td className={`${td} font-bold text-foreground`}>{f.litres && f.milk ? formatNumber((f.milk + f.cost) / f.litres, 2) : "—"}</td>
                </tr>
              ))}
              {farmers.length === 0 ? <tr><td colSpan={9} className="px-3 py-6 text-center text-[12px] text-muted-foreground">No farmer has a transporter assigned yet - set one on each farmer&apos;s page.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </Panel>
    </section>
  );
}
