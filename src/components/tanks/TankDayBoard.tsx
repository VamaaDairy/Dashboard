"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, ArrowUpFromLine, ChevronLeft, ChevronRight } from "lucide-react";
import { deleteMovement } from "@/app/tanks/actions";
import {
  DeleteButton, Empty, Num, Section, THead, Th,
} from "./ui";
import { TankForm } from "./TankList";
import { TakeOutDialog } from "./TakeOutDialog";
import { formatNumber } from "@/lib/format";
import { addDays } from "@/lib/dates";
import { kgOfSolid } from "@/lib/units";
import type { DayMovementRow, MovementRow, TankDay } from "@/lib/tanks/data";

/** A blend figure only means something while there is milk in the tank. */
const blend = (qty: number, v: number | null) => (qty > 0.005 ? v : null);

/** "6.00% · 9.00% · ₹35.00 · 61.8 kg fat · 92.7 kg SNF" - what one addition (or a day's additions) brought in. */
export function AddedDetail({
  litres, fat, snf, cost, kgPerLitre,
}: {
  litres: number; fat: number | null; snf: number | null; cost: number | null; kgPerLitre: number;
}) {
  return (
    <div className="text-[10px] text-muted-foreground">
      {formatNumber(fat, 2)}% · {formatNumber(snf, 2)}% · ₹{formatNumber(cost, 2)}
      <br />
      {formatNumber(kgOfSolid(litres, fat, kgPerLitre), 1)} kg fat · {formatNumber(kgOfSolid(litres, snf, kgPerLitre), 1)} kg SNF
    </div>
  );
}

export function DirectionBadge({ direction }: { direction: "in" | "out" }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
        "bg-muted text-foreground"
      }`}
    >
      {direction === "in" ? <ArrowDownToLine className="h-3 w-3" /> : <ArrowUpFromLine className="h-3 w-3" />}
      {direction === "in" ? "Added" : "Taken"}
    </span>
  );
}

export function DateBar({ date, today, basePath }: { date: string; today: string; basePath: string }) {
  const router = useRouter();
  const go = (d: string) => router.push(`${basePath}?date=${d}`);
  const btn = "rounded-lg border border-border bg-white p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button onClick={() => go(addDays(date, -1))} className={btn} title="Previous day"><ChevronLeft className="h-4 w-4" /></button>
      <input
        type="date"
        value={date}
        onChange={(e) => e.target.value && go(e.target.value)}
        className="rounded-lg border border-border bg-input/30 px-2 py-1 text-[13px] font-semibold text-foreground"
      />
      <button onClick={() => go(addDays(date, 1))} className={btn} title="Next day"><ChevronRight className="h-4 w-4" /></button>
      {date !== today ? (
        <button onClick={() => go(today)} className="px-2 text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          Today
        </button>
      ) : (
        <span className="px-2 text-[12px] text-muted-foreground">Today</span>
      )}
    </div>
  );
}

/** How full a tank is: a bar plus "12,500 / 20,000 L". */
export function FillBar({ litres, capacity }: { litres: number; capacity: number | null }) {
  const pct = capacity ? Math.min(100, (litres / capacity) * 100) : null;
  return (
    <div className="min-w-44">
      <div className="flex items-baseline justify-between gap-2">
        <span className="num text-[14px] font-black text-foreground">{formatNumber(litres, 0)} L</span>
        <span className="num text-[11px] text-muted-foreground">
          {capacity ? `of ${formatNumber(capacity, 0)} · ${formatNumber(pct, 0)}%` : ""}
        </span>
      </div>
      {pct !== null ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/60"
            style={{ width: `${pct}%` }}
          />
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3 shadow-xs">
      <div className="font-mono text-[10px] uppercase tracking-wide text-tertiary-foreground">{label}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="num text-[22px] font-black text-foreground">{value}</span>
        <span className="text-[12px] text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

export function TankDayBoard({
  date, today, days, movements, kgPerLitre,
}: {
  date: string;
  today: string;
  days: TankDay[];
  movements: DayMovementRow[];
  kgPerLitre: number;
}) {
  const [adding, setAdding] = useState(false);
  const [takingFrom, setTakingFrom] = useState<string | null>(null);
  const kgFat = (d: TankDay) => kgOfSolid(d.close_litre, d.close_fat_pct, kgPerLitre) ?? 0;
  const kgSnf = (d: TankDay) => kgOfSolid(d.close_litre, d.close_snf_pct, kgPerLitre) ?? 0;
  const sum = (f: (d: TankDay) => number) => days.reduce((s, d) => s + f(d), 0);
  // cost = litres x the tank's weighted-average rate
  const cost = (d: TankDay) => d.close_litre * (d.close_cost_per_litre ?? 0);
  const litres = sum((d) => d.close_litre);
  const totalCost = sum(cost);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/tanks" />
        <button
          onClick={() => setAdding((v) => !v)}
          className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
        >
          {adding ? "Cancel" : "+ Add tank"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        <Stat label="Milk in tanks" value={formatNumber(litres, 0)} unit="L" />
        <Stat label="Kg fat" value={formatNumber(sum(kgFat), 1)} unit="kg" />
        <Stat label="Kg SNF" value={formatNumber(sum(kgSnf), 1)} unit="kg" />
        <Stat
          label="Cost of milk in tanks"
          value={`₹${formatNumber(totalCost, 0)}`}
          unit={litres > 0.005 ? `avg ₹${formatNumber(totalCost / litres, 2)} / L` : ""}
        />
        <Stat label="Taken out today" value={formatNumber(sum((d) => d.out_litre), 0)} unit="L" />
      </div>

      <Section
        title={`Tanks · ${date}`}
        description="Milk comes in from Milk in. Rate is the weighted average ₹/L of everything in the tank; cost = litres × rate. Use the icon at the end of a row to take milk out."
      >
        {adding ? <TankForm onDone={() => setAdding(false)} /> : null}
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Tank</Th>
              <Th align="left">In tank</Th>
              <Th>Fat %</Th>
              <Th>SNF %</Th>
              <Th>Kg fat</Th>
              <Th>Kg SNF</Th>
              <Th>Rate ₹ / L</Th>
              <Th>Cost ₹</Th>
              <Th>Today</Th>
              <Th className="w-14 text-center">Take out</Th>
            </THead>
            <tbody>
              {days.map((d) => {
                const empty = d.close_litre <= 0.005;
                return (
                    <tr key={d.tank_id} className={`border-b border-border/70 hover:bg-muted/60 ${d.is_active && !empty ? "" : "text-muted-foreground [&_a]:text-muted-foreground"}`}>
                      <td className="px-3 py-2.5">
                        <Link href={`/tanks/${d.code}?date=${date}`} className="font-semibold text-foreground hover:underline">
                          {d.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2.5"><FillBar litres={d.close_litre} capacity={d.capacity_litre} /></td>
                      <Num value={blend(d.close_litre, d.close_fat_pct)} />
                      <Num value={blend(d.close_litre, d.close_snf_pct)} />
                      <Num value={blend(d.close_litre, kgFat(d))} decimals={1} className="font-semibold text-foreground" />
                      <Num value={blend(d.close_litre, kgSnf(d))} decimals={1} className="font-semibold text-foreground" />
                      <Num value={blend(d.close_litre, d.close_cost_per_litre)} decimals={2} className="text-foreground" />
                      <Num value={blend(d.close_litre, cost(d))} decimals={0} className="font-semibold text-foreground" />
                      <td className="num px-3 py-2.5 text-right text-[12px]">
                        {d.in_litre ? <span className="font-semibold text-foreground">+{formatNumber(d.in_litre, 0)}</span> : null}
                        {d.in_litre && d.out_litre ? <span className="text-muted-foreground"> / </span> : null}
                        {d.out_litre ? <span className="font-semibold text-foreground">−{formatNumber(d.out_litre, 0)}</span> : null}
                        {!d.in_litre && !d.out_litre ? <span className="text-tertiary-foreground">—</span> : null}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <button
                          onClick={() => setTakingFrom(d.tank_id)}
                          disabled={empty}
                          title={empty ? `${d.name} is empty` : `Take milk out of ${d.name}`}
                          className={`rounded-md p-1.5 ${
                            empty ? "cursor-not-allowed text-tertiary-foreground/40" : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <ArrowUpFromLine className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                );
              })}
              {days.length === 0 ? <Empty colSpan={10}>No tanks yet.</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>

      <TakeOutDialog
        tank={days.find((d) => d.tank_id === takingFrom) ?? null}
        date={date}
        kgPerLitre={kgPerLitre}
        onClose={() => setTakingFrom(null)}
      />

      <Section title={`Added · ${date}`} description="Milk put into tanks from Milk in. To move or undo one, change its tank there.">
        <MovementTable
          kind="in"
          movements={movements}
          kgPerLitre={kgPerLitre}
          first={{ label: "Tank", cell: (m) => m.tank_name }}
          tankIdOf={(m) => m.tank_id}
          emptyText="Nothing added today."
        />
      </Section>

      <Section title={`Removed · ${date}`} description="Milk taken out of tanks. Delete a wrong one and take it out again.">
        <MovementTable
          kind="out"
          movements={movements}
          kgPerLitre={kgPerLitre}
          first={{ label: "Tank", cell: (m) => m.tank_name }}
          tankIdOf={(m) => m.tank_id}
          emptyText="Nothing removed today."
        />
      </Section>
    </>
  );
}

/**
 * Additions or removals, one line each, with a total. An addition shows the
 * fat, SNF and rate it came in at; a removal shows what it took at the tank's
 * weighted-average blend and rate when it left. Both show cost (litres x
 * rate) and what the tank held right after. The total's rate is the weighted
 * average of the lines. Milk from Milk in can't be deleted here - its tank is
 * changed there.
 */
export function MovementTable<M extends MovementRow>({
  kind, movements, kgPerLitre, first, tankIdOf, emptyText,
}: {
  kind: "in" | "out";
  movements: M[];
  kgPerLitre: number;
  first: { label: string; cell: (m: M) => React.ReactNode };
  tankIdOf: (m: M) => string;
  emptyText: string;
}) {
  const rows = movements.filter((m) => m.direction === kind);
  const kg = (litres: number, pct: number | null) => kgOfSolid(litres, pct, kgPerLitre) ?? 0;
  const total = (f: (m: M) => number) => rows.reduce((s, m) => s + f(m), 0);
  const added = kind === "in";

  const cost = (m: M) => m.qty_litre * (m.cost_per_litre ?? 0);
  const totalLitres = total((m) => m.qty_litre);
  const totalCost = total(cost);
  const pctOf = (kgOf: (m: M) => number) => (totalLitres > 0 ? (total(kgOf) / (totalLitres * kgPerLitre)) * 100 : null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full whitespace-nowrap text-[13px]">
        <THead>
          <Th align="left">{first.label}</Th>
          <Th>Litres</Th>
          <Th>Fat %</Th>
          <Th>SNF %</Th>
          <Th>Kg fat</Th>
          <Th>Kg SNF</Th>
          <Th>Rate ₹ / L</Th>
          <Th>Cost ₹</Th>
          <Th>Tank after</Th>
          <Th align="left">{added ? "From" : "Notes"}</Th>
          <Th />
        </THead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.id} className="border-b border-border/70 hover:bg-muted/60">
              <td className="px-3 py-2 font-semibold text-foreground">{first.cell(m)}</td>
              <Num value={m.qty_litre} decimals={1} className="font-semibold text-foreground" />
              <Num value={m.fat_pct} />
              <Num value={m.snf_pct} />
              <Num value={kg(m.qty_litre, m.fat_pct)} decimals={1} />
              <Num value={kg(m.qty_litre, m.snf_pct)} decimals={1} />
              <Num value={m.cost_per_litre} decimals={2} className="text-foreground" />
              <Num value={cost(m)} decimals={0} className="font-semibold text-foreground" />
              <Num value={m.balance_litre} decimals={0} dim />
              <td className="max-w-72 truncate px-3 py-2 text-[12px] text-muted-foreground">{m.notes ?? ""}</td>
              <td className="px-2 py-2 text-right">
                {m.source === "production" ? (
                  <Link href={`/daily?date=${m.movement_date}`} className="text-[10px] text-tertiary-foreground hover:underline" title="Change it on the Production page">Production</Link>
                ) : m.source ? (
                  <span className="text-[10px] text-tertiary-foreground" title="Change its tank on the Milk in page">Milk in</span>
                ) : (
                  <DeleteButton
                    onDelete={() => deleteMovement(m.id, tankIdOf(m))}
                    confirmLabel={`${added ? "adding" : "taking out"} ${formatNumber(m.qty_litre, 0)} L on ${m.movement_date}`}
                  />
                )}
              </td>
            </tr>
          ))}
          {rows.length === 0 ? <Empty colSpan={11}>{emptyText}</Empty> : null}
        </tbody>
        {rows.length > 1 ? (
          <tfoot>
            <tr className="bg-muted/50 font-semibold">
              <td className="px-3 py-2">Total</td>
              <Num value={totalLitres} decimals={1} className="text-foreground" />
              {/* weighted average of the lines: total kg ÷ total kg of milk */}
              <Num value={pctOf((m) => kg(m.qty_litre, m.fat_pct))} className="text-foreground" />
              <Num value={pctOf((m) => kg(m.qty_litre, m.snf_pct))} className="text-foreground" />
              <Num value={total((m) => kg(m.qty_litre, m.fat_pct))} decimals={1} className="text-foreground" />
              <Num value={total((m) => kg(m.qty_litre, m.snf_pct))} decimals={1} className="text-foreground" />
              <Num value={totalLitres > 0 ? totalCost / totalLitres : null} decimals={2} className="text-foreground" />
              <Num value={totalCost} decimals={0} className="text-foreground" />
              <td colSpan={3} />
            </tr>
          </tfoot>
        ) : null}
      </table>
    </div>
  );
}

