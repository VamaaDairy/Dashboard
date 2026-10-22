/** Electricity meter arithmetic - shared by the server action and the page. */

/** The difference between two morning readings is multiplied by this (the feeder multiplier) to get units. */
export const METER_MULTIPLIER = 600;

export interface MeterReading {
  day: string;
  kwh: number;
  kvarh: number | null;
  kva: number | null;
  kvah: number | null;
  pf: number | null;
}

/** A reading with what it works out to: the use from this morning to the next. */
export interface MeterRow extends MeterReading {
  nextKwh: number | null;     // the next morning's reading
  nextKvah: number | null;
  billedUnits: number | null; // the day's kVAh (kWh if no kVAh reading) - what is costed
  kwhDiff: number | null;     // next reading - this reading
  units: number | null;       // diff x 600 = the day's kWh
  kvahDiff: number | null;
  kvahUnits: number | null;   // diff x 600 = the day's kVAh
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Units for the day from two consecutive morning readings. */
export function meterUnits(from: number, to: number): number {
  return round2((to - from) * METER_MULTIPLIER);
}

/** Newest first, like the other day lists. A day's use needs the next day's reading. */
export function meterRows(readings: MeterReading[]): MeterRow[] {
  const byDay = new Map(readings.map((r) => [r.day, r]));
  return [...readings]
    .sort((a, b) => (a.day < b.day ? 1 : -1))
    .map((r) => {
      const n = byDay.get(nextDay(r.day));
      const kwhDiff = n ? round2(n.kwh - r.kwh) : null;
      const kvahDiff = n && n.kvah != null && r.kvah != null ? round2(n.kvah - r.kvah) : null;
      const kvahUnits = n && n.kvah != null && r.kvah != null ? meterUnits(r.kvah, n.kvah) : null;
      const units = n ? meterUnits(r.kwh, n.kwh) : null;
      return {
        ...r,
        nextKwh: n ? n.kwh : null,
        nextKvah: n ? n.kvah : null,
        kwhDiff,
        units,
        billedUnits: kvahUnits ?? units,
        kvahDiff,
        kvahUnits,
      };
    });
}
