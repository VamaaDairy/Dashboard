"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { savePlantFuel, savePlantFuelDay, setPlantFuelRate } from "@/app/fuel/actions";
import { ActionForm, Empty, Field, Section, SubmitButton, Text, THead, Th } from "@/components/tanks/ui";
import { DateBar } from "@/components/tanks/TankDayBoard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatNumber } from "@/lib/format";
import type { PlantFuel, PlantFuelEntry, PlantFuelHistoryDay, PlantFuelRate } from "@/lib/fuel/plant";

const UNITS = ["kg", "tonne", "L", "pcs"];
const FROM_START = "2000-01-01";
const since = (d: string | null) => (!d ? "" : d === FROM_START ? "from the start" : `from ${d}`);
const val = (s: string) => {
  const v = Number(s.replace(/,/g, "").trim());
  return s.trim() === "" || !Number.isFinite(v) ? 0 : v;
};
const cell = "w-28 rounded-md border border-border bg-white px-2 py-1 text-right text-[13px] focus:border-foreground/40 focus:outline-none";

export function PlantFuelDay({
  date, today, entry, fuels, rates, history,
}: {
  date: string;
  today: string;
  entry: PlantFuelEntry[];
  fuels: PlantFuel[];
  rates: PlantFuelRate[];
  history: PlantFuelHistoryDay[];
}) {
  const router = useRouter();
  const [qty, setQty] = useState<Record<string, string>>(() =>
    Object.fromEntries(entry.map((e) => [e.fuel_id, String(Number(e.qty))])));
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const anySaved = entry.some((e) => e.saved);

  // a fuel added after the page opened has nothing typed yet - it starts at 0, like the rest
  const q = (id: string) => qty[id] ?? "0";
  const cost = (e: PlantFuelEntry) => (e.rate === null ? 0 : val(q(e.fuel_id)) * Number(e.rate));
  const total = entry.reduce((s, e) => s + cost(e), 0);

  function save() {
    start(async () => {
      const res = await savePlantFuelDay(date, entry.map((e) => ({ fuel_id: e.fuel_id, qty: q(e.fuel_id) })));
      if (!res.ok) { setError(res.error); return; }
      setError(null);
      setDirty(false);
      setStatus(`Saved at ${new Date().toLocaleTimeString("en-IN")}`);
      router.refresh();
    });
  }

  const shown = fuels.filter((f) => f.is_active || history.some((d) => d.by_fuel[f.id]));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <DateBar date={date} today={today} basePath="/fuel/production" />
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-muted-foreground">
            {error ? <span className="font-semibold text-destructive">{error}</span>
              : status ?? (dirty ? "Unsaved changes" : anySaved ? "Saved" : "Nothing entered for this day yet")}
          </span>
          <Button onClick={save} disabled={pending || !dirty} className="bg-foreground text-background hover:bg-foreground/85">
            {pending ? "Saving…" : "Save day"}
          </Button>
        </div>
      </div>

      <Section
        title={`Fuel used · ${date}`}
        description="Enter how much of each fuel the plant burned today. The price is the one in force on this day - change it under Fuels below. Leave a fuel at 0 if it wasn't used. The day's total goes into that day's production cost."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <THead>
              <Th align="left">Fuel</Th>
              <Th>Quantity used</Th>
              <Th>Price ₹</Th>
              <Th>Cost ₹</Th>
            </THead>
            <tbody>
              {entry.map((e) => (
                <tr key={e.fuel_id} className="border-b border-border/70">
                  <td className="px-3 py-2 font-semibold text-foreground">{e.name}</td>
                  <td className="px-3 py-1.5 text-right">
                    <input inputMode="decimal" value={q(e.fuel_id)} onFocus={(ev) => ev.target.select()}
                      onChange={(ev) => { setQty((r) => ({ ...r, [e.fuel_id]: ev.target.value })); setDirty(true); setStatus(null); }}
                      className={cell} aria-label={`${e.name} quantity`} />
                    <span className="ml-1.5 inline-block w-10 text-left text-[11px] text-muted-foreground">{e.unit}</span>
                  </td>
                  <td className="num px-3 py-2 text-right">
                    {e.rate === null ? <span className="text-[12px] font-semibold text-destructive">no price set</span> : (
                      <>
                        <span className="font-semibold text-foreground">{formatNumber(Number(e.rate), 2)}</span>
                        <span className="ml-1 text-[11px] text-muted-foreground">/ {e.unit} · {since(e.rate_from)}</span>
                      </>
                    )}
                  </td>
                  <td className="num px-3 py-2 text-right font-semibold text-foreground">{formatNumber(cost(e), 2)}</td>
                </tr>
              ))}
              {entry.length === 0 ? <Empty colSpan={4}>No fuels yet - add one below.</Empty> : null}
            </tbody>
            {entry.length ? (
              <tfoot>
                <tr className="bg-muted/50 font-semibold">
                  <td className="px-3 py-2" colSpan={3}>Total for {date}</td>
                  <td className="num px-3 py-2 text-right text-foreground">{formatNumber(total, 2)}</td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </Section>

      <FuelList fuels={fuels} rates={rates} today={today} />

      <Section title="Day by day" description="Every day fuel was entered, newest first, at the price in force that day. Click a date to open it above.">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-[13px]">
            <THead>
              <Th align="left">Date</Th>
              {shown.map((f) => <Th key={f.id}>{f.name}</Th>)}
              <Th>Total ₹</Th>
              <Th>Milk L</Th>
              <Th>₹ / L milk</Th>
            </THead>
            <tbody>
              {history.map((d) => (
                <tr key={d.day} className={`border-b border-border/70 hover:bg-muted/60 ${d.day === date ? "bg-muted/60" : ""}`}>
                  <td className="px-3 py-1.5">
                    <Link href={`/fuel/production?date=${d.day}`} className="font-semibold text-foreground hover:underline">{d.day}</Link>
                  </td>
                  {shown.map((f) => {
                    const x = d.by_fuel[f.id];
                    return (
                      <td key={f.id} className="num px-3 py-1.5 text-right">
                        {x ? (
                          <>
                            {x.cost === null ? "—" : formatNumber(x.cost, 2)}
                            <div className="text-[10px] text-muted-foreground">
                              {formatNumber(x.qty, 1)} {f.unit}{x.rate !== null ? ` × ₹${formatNumber(x.rate, 2)}` : ""}
                            </div>
                          </>
                        ) : <span className="text-tertiary-foreground">—</span>}
                      </td>
                    );
                  })}
                  <td className="num px-3 py-1.5 text-right font-semibold text-foreground">{formatNumber(d.total, 2)}</td>
                  <td className="num px-3 py-1.5 text-right text-muted-foreground">{formatNumber(d.milk_processed_l, 0)}</td>
                  <td className="num px-3 py-1.5 text-right">{d.milk_processed_l ? formatNumber(d.total / d.milk_processed_l, 3) : "—"}</td>
                </tr>
              ))}
              {history.length === 0 ? <Empty colSpan={shown.length + 4}>No fuel entered yet.</Empty> : null}
            </tbody>
          </table>
        </div>
      </Section>
    </>
  );
}

/** One fuel's price: what it is now, a form to change it from a date, and its history. */
function FuelPrice({ fuel, rates, today }: { fuel: PlantFuel; rates: PlantFuelRate[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState<"change" | "history" | null>(null);
  const [rate, setRate] = useState("");
  const [from, setFrom] = useState(today);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const history = rates.filter((r) => r.fuel_id === fuel.id);          // newest first
  const current = history.find((r) => r.effective_from <= today);
  const upcoming = history.filter((r) => r.effective_from > today).at(-1);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="num text-[13px]">
          {current ? <><b className="text-foreground">₹{formatNumber(Number(current.rate), 2)}</b> / {fuel.unit} <span className="text-muted-foreground">{since(current.effective_from)}</span></> : <span className="font-semibold text-destructive">no price set</span>}
          {upcoming ? <span className="ml-2 text-[12px] text-muted-foreground">· ₹{formatNumber(Number(upcoming.rate), 2)} from {upcoming.effective_from}</span> : null}
        </span>
        <button onClick={() => setOpen(open === "change" ? null : "change")} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Change price</button>
        <button onClick={() => setOpen(open === "history" ? null : "history")} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">
          History ({history.length})
        </button>
      </div>

      {open === "change" ? (
        <form
          className="mt-2 flex flex-wrap items-end gap-2 rounded-lg bg-muted/40 px-3 py-2"
          onSubmit={(e) => {
            e.preventDefault();
            start(async () => {
              const res = await setPlantFuelRate(fuel.id, from, rate);
              if (!res.ok) { setError(res.error); return; }
              setError(null); setRate(""); setOpen(null);
              router.refresh();
            });
          }}
        >
          <label className="text-[11px] font-semibold text-muted-foreground">
            New price ₹ / {fuel.unit}
            <Input value={rate} onChange={(e) => setRate(e.target.value)} inputMode="decimal" placeholder="6" className="mt-0.5 h-8 w-28 text-right" required />
          </label>
          <label className="text-[11px] font-semibold text-muted-foreground">
            Applies from
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-0.5 h-8 w-40" required />
          </label>
          <Button type="submit" disabled={pending} className="h-8 bg-foreground text-background hover:bg-foreground/85">{pending ? "Saving…" : "Set price"}</Button>
          <p className="w-full text-[11px] text-muted-foreground">
            Days before this date keep the old price. Days from this date on - including any already entered - use the new one.
          </p>
          {error ? <p className="w-full text-[12px] font-semibold text-destructive">{error}</p> : null}
        </form>
      ) : null}

      {open === "history" ? (
        <table className="mt-2 text-[12px]">
          <tbody>
            {history.map((r) => (
              <tr key={r.id}>
                <td className="py-0.5 pr-6 text-muted-foreground">{since(r.effective_from)}</td>
                <td className="num py-0.5 text-right font-semibold">₹{formatNumber(Number(r.rate), 2)} / {fuel.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : null}
    </div>
  );
}

/** The plant's fuels - coal first - each with its price, and a form to add another below. */
function FuelList({ fuels, rates, today }: { fuels: PlantFuel[]; rates: PlantFuelRate[]; today: string }) {
  const [editing, setEditing] = useState<string | null>(null);
  return (
    <Section title="Fuels" description="Each fuel keeps its price until you change it. Changing it from a date leaves earlier days at the old price. Untick Active to take a fuel off the daily list (its past days are kept).">
      <ul className="text-[13px]">
        {fuels.map((f) => editing === f.id ? (
          <li key={f.id} className="border-b border-border/70 px-4 py-2">
            <ActionForm action={savePlantFuel} onSuccess={() => setEditing(null)} className="flex flex-wrap items-end gap-2">
              <input type="hidden" name="id" value={f.id} />
              <Field label="Name" width="w-48"><Text name="name" defaultValue={f.name} required /></Field>
              <Field label="Unit" width="w-24">
                <select name="unit" defaultValue={f.unit} className="w-full rounded-lg border border-border bg-input/30 px-2 py-2 text-[13px]">
                  {[...new Set([...UNITS, f.unit])].map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
              <label className="flex items-center gap-1.5 pb-2 text-[12px] font-semibold text-muted-foreground">
                <input type="checkbox" name="is_active" defaultChecked={f.is_active} /> Active
              </label>
              <SubmitButton>Save</SubmitButton>
              <button type="button" onClick={() => setEditing(null)} className="pb-2 text-[12px] font-semibold text-muted-foreground">Cancel</button>
            </ActionForm>
          </li>
        ) : (
          <li key={f.id} className={`flex flex-wrap items-start justify-between gap-2 border-b border-border/70 px-4 py-2.5 ${f.is_active ? "" : "opacity-60"}`}>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-foreground">
                {f.name} <span className="font-normal text-muted-foreground">· {f.unit}{f.is_active ? "" : " · inactive"}</span>
              </div>
              <div className="mt-1"><FuelPrice fuel={f} rates={rates} today={today} /></div>
            </div>
            <button onClick={() => setEditing(f.id)} className="text-[12px] font-semibold text-muted-foreground hover:text-foreground">Edit</button>
          </li>
        ))}
      </ul>
      <ActionForm action={savePlantFuel} resetOnSuccess className="flex flex-wrap items-end gap-2 px-4 py-3">
        <Field label="Add a fuel" width="w-56"><Text name="name" placeholder="e.g. Firewood" required /></Field>
        <Field label="Unit" width="w-24">
          <select name="unit" defaultValue="kg" className="w-full rounded-lg border border-border bg-input/30 px-2 py-2 text-[13px]">
            {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Price ₹ per unit" width="w-32"><Text name="rate" placeholder="6" required /></Field>
        <input type="hidden" name="is_active" value="on" />
        <SubmitButton>Add fuel</SubmitButton>
      </ActionForm>
    </Section>
  );
}
