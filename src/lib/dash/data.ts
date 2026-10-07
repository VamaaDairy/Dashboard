import "server-only";
import { query } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";

// ---------------------------------------------------------------- tanks

export interface TankFlowDay {
  day: string;
  tank_id: string;
  tank: string;
  in_farmers: number;     // collections put in from Milk in
  in_other: number;       // tankers and anything entered by hand
  in_transfer: number;    // moved in from another tank
  out_transfer: number;   // moved on to another tank
  out_production: number; // drawn for bulk batches
  out_other: number;
  close: number | null;   // litres at the end of the day
  in_fat_kg: number;
  in_snf_kg: number;
  in_cost: number;        // ₹ of what came in
}

/** Every tank's flows per day in the period, and its closing litres. */
export async function getTankFlows(from: string, to: string): Promise<TankFlowDay[]> {
  return query<TankFlowDay>(
    `with flows as (
       select m.tank_id, m.movement_date as day,
              sum(m.qty_litre) filter (where m.direction = 'in' and m.source = 'vamaa') as in_farmers,
              sum(m.qty_litre) filter (where m.direction = 'in' and m.source is null) as in_other,
              sum(m.qty_litre) filter (where m.direction = 'in' and m.source = 'transfer') as in_transfer,
              sum(m.qty_litre) filter (where m.direction = 'out' and m.source = 'transfer') as out_transfer,
              sum(m.qty_litre) filter (where m.direction = 'out' and m.source = 'production') as out_production,
              sum(m.qty_litre) filter (where m.direction = 'out' and m.source is null) as out_other,
              -- the blend and cost of milk coming into the plant, not milk moving between tanks
              sum(m.qty_litre * 1.03 * coalesce(m.fat_pct, 0) / 100) filter (where m.direction = 'in' and m.source is distinct from 'transfer') as in_fat_kg,
              sum(m.qty_litre * 1.03 * coalesce(m.snf_pct, 0) / 100) filter (where m.direction = 'in' and m.source is distinct from 'transfer') as in_snf_kg,
              sum(m.qty_litre * coalesce(m.cost_per_litre, 0)) filter (where m.direction = 'in' and m.source is distinct from 'transfer') as in_cost
         from tank_movement m
        where m.scenario_id = $1 and m.movement_date between $2 and $3
        group by m.tank_id, m.movement_date
     )
     select to_char(f.day, 'YYYY-MM-DD') as day, t.id as tank_id, t.name as tank,
            coalesce(f.in_farmers, 0) as in_farmers, coalesce(f.in_other, 0) as in_other,
            coalesce(f.out_production, 0) as out_production, coalesce(f.out_other, 0) as out_other,
            coalesce(f.in_transfer, 0) as in_transfer, coalesce(f.out_transfer, 0) as out_transfer,
            (select balance_litre from tank_movement x where x.tank_id = t.id and x.movement_date = f.day
              order by x.created_at desc, x.id desc limit 1) as close,
            coalesce(f.in_fat_kg, 0) as in_fat_kg, coalesce(f.in_snf_kg, 0) as in_snf_kg, coalesce(f.in_cost, 0) as in_cost
       from flows f join tank t on t.id = f.tank_id
      order by f.day, t.sort_order`,
    [await activeScenarioId(), from, to],
  );
}

// ---------------------------------------------------------------- fuel & transport

export interface TransportDay {
  day: string;
  section: "milk_to_plant" | "delivery";
  transporter: string;
  km: number | null;
  trips: number | null;
  diesel: number | null;
  cost: number;
}

export interface PlantFuelUse { day: string; fuel: string; unit: string; qty: number; cost: number }

export async function getTransportDays(from: string, to: string): Promise<TransportDay[]> {
  return query<TransportDay>(
    `select to_char(run_date, 'YYYY-MM-DD') as day, section, transporter_name as transporter,
            distance_km as km, trips, diesel_litre as diesel, coalesce(cost, 0) as cost
       from v_transport_run where scenario_id = $1 and run_date between $2 and $3
      order by run_date, section, transporter_name`,
    [await activeScenarioId(), from, to],
  );
}

export async function getPlantFuelUse(from: string, to: string): Promise<PlantFuelUse[]> {
  return query<PlantFuelUse>(
    `select to_char(v.day, 'YYYY-MM-DD') as day, f.name as fuel, f.unit, v.qty, coalesce(v.cost, 0) as cost
       from v_plant_fuel_day v join plant_fuel f on f.id = v.fuel_id
      where v.scenario_id = $1 and v.day between $2 and $3 order by v.day, f.sort_order`,
    [await activeScenarioId(), from, to],
  );
}

/** Litres of milk processed per day (the base shared costs are divided over). */
export async function getMilkProcessed(from: string, to: string): Promise<Record<string, number>> {
  const rows = await query<{ day: string; l: number }>(
    `select to_char(day, 'YYYY-MM-DD') as day, milk_processed_l as l from production_day
      where scenario_id = $1 and day between $2 and $3 and milk_processed_l > 0`,
    [await activeScenarioId(), from, to],
  );
  return Object.fromEntries(rows.map((r) => [r.day, Number(r.l)]));
}

// ---------------------------------------------------------------- milk in

export interface MilkInDay {
  day: string;
  center: string;
  centre: string;
  kind: string;
  farmers: number;
  litres: number;
  fat_kg: number;
  snf_kg: number;
  amount: number | null;   // at the price for the day (rate chart from 1 Oct 2026, the app's before); null for tankers
}

export async function getMilkInDays(from: string, to: string): Promise<MilkInDay[]> {
  return query<MilkInDay>(
    `select to_char(c.day, 'YYYY-MM-DD') as day, c.center, coalesce(vc.name, c.center) as centre, coalesce(vc.kind, 'village') as kind,
            count(distinct c.farmer_code)::int as farmers, sum(c.qty_litre) as litres,
            sum(c.qty_litre * 1.03 * c.fat_pct / 100) as fat_kg,
            sum(c.qty_litre * 1.03 * c.snf_pct / 100) as snf_kg,
            case when coalesce(vc.kind, 'village') = 'tanker' then null
                 else sum(c.qty_litre * coalesce(milk_price($1::uuid, c.day, c.fat_pct, c.clr, c.rate), 0)) end as amount
       from vamaa_collection c left join vamaa_center vc on vc.center = c.center
      where c.day between $2 and $3
      group by c.day, c.center, vc.name, vc.kind
      order by c.day, c.center`,
    [await activeScenarioId(), from, to],
  );
}

/** Litres in all tanks at the end of `to` - each tank's last balance on or before it. */
export async function getTankStock(to: string): Promise<number> {
  const r = await query<{ q: number | null }>(
    `select sum(b.balance_litre) as q from tank t
       cross join lateral (select balance_litre from tank_movement m where m.tank_id = t.id and m.movement_date <= $2
                            order by m.movement_date desc, m.created_at desc, m.id desc limit 1) b
      where t.scenario_id = $1`,
    [await activeScenarioId(), to],
  );
  return Number(r[0]?.q ?? 0);
}

export interface TankLevel {
  tank_id: string;
  name: string;
  capacity: number | null;
  litres: number;
  fat_pct: number | null;
  snf_pct: number | null;
  cost_per_litre: number | null;
}

/** Every active tank (and any holding milk) at the end of `to`: its level and the blend in it. */
export async function getTankLevels(to: string): Promise<TankLevel[]> {
  return query<TankLevel>(
    `select t.id as tank_id, t.name, t.capacity_litre as capacity, coalesce(b.balance_litre, 0) as litres,
            case when b.balance_litre > 0 then b.balance_fat_pct end as fat_pct,
            case when b.balance_litre > 0 then b.balance_snf_pct end as snf_pct,
            case when b.balance_litre > 0 then b.balance_cost_per_litre end as cost_per_litre
       from tank t
       left join lateral (select balance_litre, balance_fat_pct, balance_snf_pct, balance_cost_per_litre from tank_movement m
                           where m.tank_id = t.id and m.movement_date <= $2
                           order by m.movement_date desc, m.created_at desc, m.id desc limit 1) b on true
      where t.scenario_id = $1 and (t.is_active or coalesce(b.balance_litre, 0) > 0)
      order by t.sort_order, t.name`,
    [await activeScenarioId(), to],
  );
}

export interface MilkQuality {
  bands: { band: string; litres: number; farmers: number }[];   // litres by fat % band, low to high
  shifts: { shift: string; litres: number }[];                 // morning / evening
}

/** How the period's farmer milk spreads across fat bands, and morning vs evening. Tanker loads excluded. */
export async function getMilkQuality(from: string, to: string): Promise<MilkQuality> {
  const [bands, shifts] = await Promise.all([
    query<{ band: string; litres: number; farmers: number; ord: number }>(
      `select case when fat_pct < 3 then 'under 3.0' when fat_pct < 3.5 then '3.0 - 3.4' when fat_pct < 4 then '3.5 - 3.9'
                   when fat_pct < 4.5 then '4.0 - 4.4' when fat_pct < 5 then '4.5 - 4.9' when fat_pct < 6 then '5.0 - 5.9' else '6.0 +' end as band,
              case when fat_pct < 3 then 0 when fat_pct < 3.5 then 1 when fat_pct < 4 then 2 when fat_pct < 4.5 then 3
                   when fat_pct < 5 then 4 when fat_pct < 6 then 5 else 6 end as ord,
              sum(qty_litre) as litres, count(distinct c.center || c.farmer_code)::int as farmers
         from vamaa_collection c left join vamaa_center vc on vc.center = c.center
        where c.day between $1 and $2 and coalesce(vc.kind, 'village') <> 'tanker' and c.fat_pct is not null and c.qty_litre > 0
        group by 1, 2 order by 2`, [from, to]),
    query<{ shift: string; litres: number }>(
      `select case when c.shift = 'M' then 'Morning' else 'Evening' end as shift, sum(c.qty_litre) as litres
         from vamaa_collection c left join vamaa_center vc on vc.center = c.center
        where c.day between $1 and $2 and coalesce(vc.kind, 'village') <> 'tanker'
        group by 1 order by 1 desc`, [from, to]),
  ]);
  return {
    bands: bands.map((b) => ({ band: b.band, litres: Number(b.litres), farmers: b.farmers })),
    shifts: shifts.map((x) => ({ shift: x.shift, litres: Number(x.litres) })),
  };
}

/** Litres put into the tanks over the period (all sources). */
export async function getTankInTotal(from: string, to: string): Promise<number> {
  const r = await query<{ q: number | null }>(
    `select sum(qty_litre) as q from tank_movement where scenario_id = $1 and direction = 'in' and source is distinct from 'transfer' and movement_date between $2 and $3`,
    [await activeScenarioId(), from, to]);
  return Number(r[0]?.q ?? 0);
}

/** One farmer's milk-to-plant transport share on one day: their transporter's day cost ÷ the farmers it carried. */
export interface FarmerTransportDay {
  day: string;
  center: string;
  code: string;
  name: string | null;
  transporter_id: string;
  transporter: string;
  litres: number;
  cost: number | null;          // this farmer's share
  farmers: number;              // farmers the day's cost was split over
  milk_amount: number | null;   // what this farmer's milk cost that day (rate chart / app price)
}

/** Every farmer's equal share of their transporter's cost, day by day. */
export async function getFarmerTransport(from: string, to: string): Promise<FarmerTransportDay[]> {
  return query<FarmerTransportDay>(
    `select to_char(v.day, 'YYYY-MM-DD') as day, v.center, v.farmer_code as code, f.name,
            v.transporter_id, t.name as transporter, v.litres, v.cost, v.transporter_farmers as farmers,
            (select sum(c.qty_litre * coalesce(milk_price($1::uuid, c.day, c.fat_pct, c.clr, c.rate), 0))
               from vamaa_collection c where c.center = v.center and c.farmer_code = v.farmer_code and c.day = v.day) as milk_amount
       from v_farmer_transport_day v
       join transporter t on t.id = v.transporter_id
       left join vamaa_farmer f on f.center = v.center and f.code = v.farmer_code
      where v.scenario_id = $1 and v.day between $2 and $3
      order by v.day, t.name, v.farmer_code`,
    [await activeScenarioId(), from, to],
  );
}
