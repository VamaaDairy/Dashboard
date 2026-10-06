import { snfFromClr } from "@/lib/units";

/** The fields that identify one collection and carry its quality. */
interface CollectionLike {
  center_code: string;
  farmer_code: string;
  shift: string;
  qty_time: string;
  created: string;
  date: string;
  quantity: number;
  fat: number;
  clr: number;
  snf?: number;
  amount: number;
  rate: number;
}

/**
 * A stable id for one collection, stored on the tank movement it was put in
 * as. The API has no id of its own, so it is built from what makes a record
 * unique: centre, date, farmer, shift, and when it was weighed and created.
 */
export function collectionRef(r: CollectionLike, date: string): string {
  return ["vamaa", r.center_code, date, r.farmer_code, r.shift, r.qty_time, r.created].join("|");
}

/**
 * SNF % of a collection. Village centres record CLR, so SNF is calculated
 * from CLR and fat (CLR/4 + 0.20 x fat + 0.70). Tankers - and some centres -
 * record no CLR and send SNF directly, so that is used as sent.
 */
export function collectionSnf(r: { fat: number | string; clr: number | string; snf?: number | string }): number {
  const fat = Number(r.fat) || 0;
  const clr = Number(r.clr) || 0;
  if (clr > 0) return snfFromClr(clr, fat);
  return Number(r.snf) || 0;
}

/**
 * What a collection brings into a tank: litres, fat %, SNF % (as the Milk in
 * page shows it) and cost per litre (replaced by the collection's price when
 * it goes into a tank - see assignCollectionToTank).
 */
export function collectionMilk(r: CollectionLike) {
  const litres = Number(r.quantity) || 0;
  const amount = Number(r.amount) || 0;
  return {
    litres,
    fat: Number(r.fat) || 0,
    snf: collectionSnf(r),
    costPerLitre: litres > 0 && amount > 0 ? amount / litres : Number(r.rate) || 0,
  };
}
