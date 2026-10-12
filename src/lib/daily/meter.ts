/** Electricity meter arithmetic - shared by the server action and the page. */

/** The meter's reading difference is divided by this ... */
export const METER_DIVISOR = 10;
/** ... then multiplied by this (the feeder multiplier) to get units. */
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
  kwhDiff: number | null;     // next reading - this reading
  kwhScaled: number | null;   // diff / 10
  units: number | null;       // scaled x 600 = the day's kWh
  kvahDiff: number | null;
  kvahScaled: number | null;
  kvahUnits: number | null;   // scaled x 600 = the day's kVAh
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function nextDay(day: string): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** Units for the day from two consecutive morning readings. */
export function meterUnits(from: number, to: number): number {
  return round2(((to - from) / METER_DIVISOR) * METER_MULTIPLIER);
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
      return {
        ...r,
        nextKwh: n ? n.kwh : null,
        kwhDiff,
        kwhScaled: kwhDiff === null ? null : round2(kwhDiff / METER_DIVISOR),
        units: n ? meterUnits(r.kwh, n.kwh) : null,
        kvahDiff,
        kvahScaled: kvahDiff === null ? null : round2(kvahDiff / METER_DIVISOR),
        kvahUnits: n && n.kvah != null && r.kvah != null ? meterUnits(r.kvah, n.kvah) : null,
      };
    });
}
