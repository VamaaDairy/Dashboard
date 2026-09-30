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
 * What a collection brings into a tank: litres, fat %, SNF % (from CLR and
 * fat, as the Milk in page shows it) and cost per litre (what the farmer is
 * paid: amount / litres, or the rate if there is no amount).
 */
export function collectionMilk(r: CollectionLike) {
  const litres = Number(r.quantity) || 0;
  const fat = Number(r.fat) || 0;
  const amount = Number(r.amount) || 0;
  return {
    litres,
    fat,
    snf: snfFromClr(Number(r.clr) || 0, fat),
    costPerLitre: litres > 0 && amount > 0 ? amount / litres : Number(r.rate) || 0,
  };
}
