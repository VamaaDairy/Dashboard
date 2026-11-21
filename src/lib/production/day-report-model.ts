/**
 * The daily production report: one day's rows (milk in at the centre, the tanks, the batches, the packing) and the
 * figures, checks and chart rows built from them. No server code here: the browser builds and prints the report from
 * the rows /api/production/day-report returns.
 */

export type CollectionRow = { center: string; shift: string; farmers: number; litre: number; fat: number | null; snf: number | null };
export type ProcurementRow = {
  center: string; shift: string; kg: number | null; litre: number | null; fat: number | null; snf: number | null; tanker: string | null;
};
export type TankRow = {
  tank: string; capacity: number | null;
  opening: number | null; opening_fat: number | null; opening_snf: number | null;
  closing: number | null; closing_fat: number | null; closing_snf: number | null;
};
export type MoveRow = {
  tank: string; direction: string; source: string; litre: number | null; fat: number | null; snf: number | null; rate: number | null;
  notes: string | null; batch_product: string | null; transfer_tank: string | null;
};
export type BatchRow = {
  product: string; unit: string; batch_no: string | null;
  milk_l: number | null; fat: number | null; snf: number | null; milk_cost: number | null; output: number | null;
  workers: number | null; hours: number | null; labour_cost: number | null; notes: string | null;
  ingredients: { name: string; qty: number | null; unit: string | null }[];
  draws: { tank: string; litre: number | null; fat: number | null; snf: number | null }[];
  tests: { tank: string; fat: number | null; snf: number | null; clr: number | null }[];
};
export type PackRow = {
  code: string; name: string; category: string | null; case_unit: string | null; per_case: number | null;
  cases_only: boolean; made_outside: boolean; cases: number | null; loose: number | null; pcs: number | null;
  bulk_product: string | null; bulk_unit: string | null; bulk_used: number | null;
  batch_date: string | null; batch_product: string | null; material: number | null;
};
export type DayReportData = {
  date: string; pulledAt: string;
  collection: CollectionRow[]; procurement: ProcurementRow[]; tanks: TankRow[]; moves: MoveRow[]; batches: BatchRow[]; packing: PackRow[];
};

// ------------------------------------------------------------------ numbers, Indian grouping
const formats = new Map<string, Intl.NumberFormat>();
function fmt(n: number, min: number, max: number) {
  const key = `${min}-${max}`;
  let f = formats.get(key);
  if (!f) formats.set(key, (f = new Intl.NumberFormat("en-IN", { minimumFractionDigits: min, maximumFractionDigits: max })));
  const s = f.format(Math.abs(n));
  return n < 0 && /[1-9]/.test(s) ? `−${s}` : s;
}
type N = number | null | undefined;
export const num = (n: N, dec = 0) => (n == null ? "—" : fmt(n, dec, dec));
/** Up to 2 decimals, none that are 0. */
export const smart = (n: N) => (n == null ? "—" : fmt(n, 0, 2));
export const litre = (n: N) => num(n, 1);
export const qty = (n: N, unit: string | null | undefined) => (n == null ? "—" : `${smart(n)} ${unit ?? ""}`.trim());
export const signed = (n: number, unit = "") => (Math.abs(n) < 0.005 ? `0 ${unit}` : `${n > 0 ? "+" : ""}${smart(n)} ${unit}`).trim();
export const rupee = (n: N) => (n == null ? "—" : `₹${num(n)}`);
export const f2 = (n: N) => (n == null ? "—" : n.toFixed(2));
export const fatSnf = (fat: N, snf: N) => (fat == null && snf == null ? "—" : `${f2(fat)} / ${f2(snf)}`);

/** Average of the values weighted by litres (or any weight), skipping missing values. */
export function wavg(pairs: N[][]): number | null {
  let w = 0;
  let s = 0;
  for (const [a, v] of pairs) {
    if (v == null || !a) continue;
    w += a;
    s += a * v;
  }
  return w ? s / w : null;
}

export const byUnit = (m: Map<string, number>, sep = " · ") =>
  [...m].filter(([, v]) => Math.abs(v) > 0.0001).map(([u, v]) => `${smart(v)} ${u}`).join(sep) || "—";

const sum = <T,>(rows: T[], f: (r: T) => N) => rows.reduce((a, r) => a + (f(r) ?? 0), 0);
function push<T>(m: Map<string, T[]>, k: string, v: T) {
  const list = m.get(k);
  if (list) list.push(v);
  else m.set(k, [v]);
}

// ------------------------------------------------------------------ the report
export type Flow = { milkIn: number; back: number; drawn: number; transfer: number; other: number };
export type MadePacked = { unit: string; made: number; batches: number; packed: number; lines: number };
/** A point to check: what it is about, then what is wrong. */
export type Check = { lead: string; text: string };

export function buildDayReport(d: DayReportData) {
  const collected = sum(d.collection, (v) => v.litre);
  const colFat = wavg(d.collection.map((v) => [v.litre, v.fat]));
  const colSnf = wavg(d.collection.map((v) => [v.litre, v.snf]));

  /** the milk in from the centre, by the tank it was put into */
  const into = new Map<string, MoveRow[]>();
  for (const m of d.moves) if (m.direction === "in" && m.source === "vamaa") push(into, m.tank, m);
  const intoRows = [...into.values()].flat();
  const intoL = sum(intoRows, (m) => m.litre);
  const gap = collected - intoL;

  const drawn = sum(d.batches, (b) => b.milk_l);
  const made = new Map<string, number>();
  for (const b of d.batches) made.set(b.unit, (made.get(b.unit) ?? 0) + (b.output ?? 0));
  const pcs = sum(d.packing, (p) => p.pcs);
  const material = sum(d.packing, (p) => p.material);

  const flows = new Map<string, Flow>();
  for (const m of d.moves) {
    let f = flows.get(m.tank);
    if (!f) flows.set(m.tank, (f = { milkIn: 0, back: 0, drawn: 0, transfer: 0, other: 0 }));
    const L = m.litre ?? 0;
    if (m.direction === "in") {
      if (m.source === "vamaa") f.milkIn += L;
      else if (m.source === "production_output" || m.source === "production_return") f.back += L;
      else if (m.source === "transfer") f.transfer += L;
      else f.other += L;
    } else if (m.source === "production") f.drawn += L;
    else if (m.source === "transfer") f.transfer -= L;
    else f.other -= L;
  }
  /** the tanks in use: any movement on the day, or milk in them */
  const tanks = d.tanks.filter((t) => flows.has(t.tank) || Math.abs(t.opening ?? 0) > 0.5 || Math.abs(t.closing ?? 0) > 0.5);
  const hasTransfer = [...flows.values()].some((f) => Math.abs(f.transfer) > 0.05);
  const hasOther = [...flows.values()].some((f) => Math.abs(f.other) > 0.05);

  const categories = new Map<string, PackRow[]>();
  for (const p of d.packing) push(categories, p.category || "Other", p);

  const madePacked = new Map<string, MadePacked>();
  for (const b of d.batches) {
    let r = madePacked.get(b.product);
    if (!r) madePacked.set(b.product, (r = { unit: b.unit, made: 0, batches: 0, packed: 0, lines: 0 }));
    r.made += b.output ?? 0;
    r.batches += 1;
  }
  for (const p of d.packing) {
    if (p.made_outside) continue;
    const name = p.bulk_product ?? "Not linked to a bulk product";
    let r = madePacked.get(name);
    if (!r) madePacked.set(name, (r = { unit: p.bulk_unit ?? "", made: 0, batches: 0, packed: 0, lines: 0 }));
    r.packed += p.bulk_used ?? 0;
    r.lines += 1;
  }

  const checks: Check[] = [];
  if (gap > 0.5) checks.push({ lead: "Milk in:", text: `${litre(gap)} L of the ${litre(collected)} L collected has no tank chosen, so it is not in any tank's stock.` });
  for (const t of tanks) {
    const cl = t.closing ?? 0;
    if (t.capacity && cl > t.capacity + 0.5) {
      checks.push({ lead: t.tank, text: `closed at ${litre(cl)} L, above its ${num(t.capacity)} L capacity (${((cl / t.capacity) * 100).toFixed(0)}% full).` });
    }
    if (cl < -0.5) checks.push({ lead: t.tank, text: `closed below zero (${litre(cl)} L).` });
  }
  for (const b of d.batches) {
    const milk = b.milk_l ?? 0;
    const out = b.output ?? 0;
    if (milk < 1 && out > 0) checks.push({ lead: `${b.product}:`, text: `${qty(out, b.unit)} made from ${smart(milk)} L of milk; the milk this batch used is not recorded.` });
    if (milk >= 1 && out <= 0) checks.push({ lead: `${b.product}:`, text: `${smart(milk)} L of milk drawn, but nothing entered as made.` });
  }
  for (const [name, r] of madePacked) {
    if (r.batches === 0 && r.lines > 0) checks.push({ lead: `${name}:`, text: `${qty(r.packed, r.unit)} packed, but no ${name} batch was entered on this day.` });
  }

  return {
    collected, colFat, colSnf, into, intoL, gap, drawn, made, pcs, material,
    flows, tanks, hiddenTanks: d.tanks.length - tanks.length, hasTransfer, hasOther, categories, madePacked, checks,
  };
}

export type DayReportModel = ReturnType<typeof buildDayReport>;
