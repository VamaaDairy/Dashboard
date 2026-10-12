/** One count of labourers per section. */
export interface LabourShifts {
  dayRegular: number;
  daySpecial: number;
  night: number;
  contract: number;
}

/** What one labourer is paid for a day, per section. */
export type LabourRates = LabourShifts;

/** Used only when no rate has been set at all. */
export const DEFAULT_LABOUR_RATES: LabourRates = { dayRegular: 300, daySpecial: 350, night: 300, contract: 400 };

/** One entry of the rate history: these rates apply from `effective_from`. */
export interface LabourRateRow extends LabourRates {
  id: string;
  effective_from: string;
}

export const labourCount = (s: LabourShifts) => s.dayRegular + s.daySpecial + s.night + s.contract;

export const labourAmount = (s: LabourShifts, r: LabourRates) =>
  s.dayRegular * r.dayRegular + s.daySpecial * r.daySpecial + s.night * r.night + s.contract * r.contract;

/** The rates in force on a date, from a history sorted newest first. */
export const labourRatesOn = (rows: LabourRateRow[], date: string): LabourRateRow | null =>
  rows.find((r) => r.effective_from <= date) ?? null;
