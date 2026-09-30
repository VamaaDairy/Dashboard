"use client";

import { useState } from "react";
import Link from "next/link";
import { Empty, Num, Section, THead, Th } from "./ui";
import { ArrowUpFromLine } from "lucide-react";
import { DateBar, FillBar } from "./TankDayBoard";
import { TakeOutDialog } from "./TakeOutDialog";
import { Button } from "@/components/ui/button";
import { TankEditForm } from "./TankList";
import { formatNumber } from "@/lib/format";
import { kgOfSolid } from "@/lib/units";
import type { TankDay, TankRow } from "@/lib/tanks/data";

const blend = (qty: number, v: number | null) => (qty > 0.005 ? v : null);

/** One tank's page: take milk out on a date, then its day-by-day history. */
export function TankDays({
  tank, date, today, onDate, days, kgPerLitre,
}: {
  tank: TankRow;
  date: string;
  today: string;
  onDate: TankDay | undefined;   // this tank on `date`
  days: TankDay[];
  kgPerLitre: number;
}) {
  const [editing, setEditing] = useState(false);
  const [takingOut, setTakingOut] = useState(false);
  const kg = (l: number, pct: number | null) => blend(l, kgOfSolid(l, pct, kgPerLitre));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath={`/tanks/${tank.code}`} />
        <div className="flex items-center gap-4">
          <button
            onClick={() => setEditing((v) => !v)}
            className="text-[12px] font-semibold text-muted-foreground hover:text-foreground"
          >
            {editing ? "Cancel" : "Edit tank"}
          </button>
          <Button
            onClick={() => setTakingOut(true)}
            disabled={!onDate || onDate.close_litre <= 0.005}
            title={onDate && onDate.close_litre > 0.005 ? undefined : `${tank.name} is empty on ${date}`}
            className="bg-foreground text-background hover:bg-foreground/85"
          >
            <ArrowUpFromLine /> Take milk out
          </Button>
        </div>
      </div>

      {editing ? (
        <Section title="Edit tank">
          <TankEditForm tank={tank} onDone={() => setEditing(false)} />
        </Section>
      ) : null}

      <TakeOutDialog
        tank={takingOut && onDate ? onDate : null}
        date={date}
        kgPerLitre={kgPerLitre}
        onClose={() => setTakingOut(false)}
      />

      <Section title="Day by day">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Date</Th>
              <Th>Added</Th>
              <Th>Taken</Th>
              <Th align="left">In tank at close</Th>
              <Th>Fat %</Th>
              <Th>SNF %</Th>
              <Th>Kg fat</Th>
              <Th>Kg SNF</Th>
              <Th>Rate ₹ / L</Th>
              <Th>Cost ₹</Th>
            </THead>
            <tbody>
              {days.map((d) => (
                <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-accent/60" : ""}`}>
                  <td className="px-3 py-2.5">
                    <Link href={`/tanks/${tank.code}?date=${d.day}`} className="font-semibold text-foreground hover:underline">
                      {d.day}
                    </Link>
                  </td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-foreground">
                    {d.in_litre ? `+${formatNumber(d.in_litre, 0)}` : <span className="font-normal text-tertiary-foreground">—</span>}
                  </td>
                  <td className="num px-3 py-2.5 text-right font-semibold text-foreground">
                    {d.out_litre ? `−${formatNumber(d.out_litre, 0)}` : <span className="font-normal text-tertiary-foreground">—</span>}
                  </td>
                  <td className="px-3 py-2.5"><FillBar litres={d.close_litre} capacity={d.capacity_litre} /></td>
                  <Num value={blend(d.close_litre, d.close_fat_pct)} />
                  <Num value={blend(d.close_litre, d.close_snf_pct)} />
                  <Num value={kg(d.close_litre, d.close_fat_pct)} decimals={1} className="font-semibold text-foreground" />
                  <Num value={kg(d.close_litre, d.close_snf_pct)} decimals={1} className="font-semibold text-foreground" />
                  <Num value={blend(d.close_litre, d.close_cost_per_litre)} decimals={2} className="text-foreground" />
                  <Num value={blend(d.close_litre, d.close_litre * (d.close_cost_per_litre ?? 0))} decimals={0} className="font-semibold text-foreground" />
                </tr>
              ))}
              {days.length === 0 ? <Empty colSpan={10}>No milk added or taken yet.</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}
