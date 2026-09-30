"use server";

import { revalidatePath } from "next/cache";
import { query, tx } from "@/lib/db";
import { activeScenarioId } from "@/lib/model/load";
import { syncFuelDays } from "@/lib/transport/sync";
import type { TransportSection } from "@/lib/transport/data";
import type { Result } from "@/app/tanks/actions";

const SECTIONS = ["milk_to_plant", "delivery"] as const;

const text = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/** Blank is allowed (not known yet); anything else must be a number, not below zero. */
function amount(form: FormData, key: string, label: string): number | null {
  const raw = text(form, key).replace(/,/g, "");
  if (raw === "") return null;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < 0) throw new Error(`${label}: "${text(form, key)}" is not a valid number`);
  return v;
}

function section(form: FormData): TransportSection {
  const s = text(form, "section");
  if (!(SECTIONS as readonly string[]).includes(s)) throw new Error("Unknown transport section");
  return s as TransportSection;
}

function date(form: FormData, key: string): string {
  const d = text(form, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) throw new Error("Pick a date");
  return d;
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

async function guard(fn: () => Promise<void>): Promise<Result> {
  try {
    await fn();
    revalidatePath("/transport", "layout");
    revalidatePath("/fuel", "layout");
    revalidatePath("/daily", "layout");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Name, notes and active - the Transport pages. */
export async function saveTransporter(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "id");
    const name = text(form, "name");
    if (!name) throw new Error("Give the transporter a name");
    const fields = [name, form.get("is_active") !== null, text(form, "notes") || null];

    if (id) {
      await query(
        `update transporter set name = $2, is_active = $3, notes = $4 where id = $1`,
        [id, ...fields],
      );
      return;
    }

    const s = section(form);
    const code = slug(name);
    if (!/^[a-z][a-z0-9_]*$/.test(code)) throw new Error("Use a name that starts with a letter");
    const scenario = await activeScenarioId();
    const taken = await query(
      `select 1 from transporter where scenario_id = $1 and section = $2 and code = $3`,
      [scenario, s, code]);
    if (taken.length) throw new Error(`A transporter called "${name}" is already in this section`);
    await query(
      `insert into transporter (scenario_id, section, code, name, is_active, notes, sort_order)
       values ($1, $2, $3, $4, $5, $6,
               (select coalesce(max(sort_order), 0) + 1 from transporter where scenario_id = $1))`,
      [scenario, s, code, ...fields],
    );
  });
}

/**
 * One day's work for every transporter in a section. Each transporter sends
 * `km_<id>`, `trips_<id>` or `litres_<id>`; a blank one means it did not run that day.
 */
export async function saveTransportDay(form: FormData): Promise<Result> {
  return guard(async () => {
    const s = section(form);
    const day = date(form, "date");
    const ids = form.getAll("transporter_id").map(String);
    const scenario = await activeScenarioId();

    await tx(async (client) => {
      for (const id of ids) {
        const km = amount(form, `km_${id}`, "Km");
        const trips = amount(form, `trips_${id}`, "Trips");
        const litres = amount(form, `litres_${id}`, "Diesel litres");
        if (km === null && trips === null && litres === null) {
          await client.query(`delete from transport_run where transporter_id = $1 and run_date = $2`, [id, day]);
          continue;
        }
        await client.query(
          `insert into transport_run (scenario_id, transporter_id, run_date, distance_km, trips, diesel_litre)
           values ($1, $2, $3, $4, $5, $6)
           on conflict (transporter_id, run_date) do update
             set distance_km = excluded.distance_km, trips = excluded.trips,
                 diesel_litre = excluded.diesel_litre`,
          [scenario, id, day, km, trips, litres],
        );
      }
    });

    await syncFuelDays(scenario, s, [day]);
  });
}

/**
 * A new rate, in force from `effective_from` until the next one. Entering a
 * rate for a date that already has one replaces it. Every day already run
 * from that date on is re-costed.
 */
export async function addTransporterRate(form: FormData): Promise<Result> {
  return guard(async () => {
    const s = section(form);
    const id = text(form, "transporter_id");
    if (!id) throw new Error("Pick a transporter");
    const from = date(form, "effective_from");
    const basis = text(form, "cost_basis");
    if (basis !== "per_km" && basis !== "per_trip" && basis !== "diesel") {
      throw new Error("Pick per km, per trip or diesel used");
    }
    // diesel is charged at the shared diesel price, not a rate of its own
    const rate = basis === "diesel" ? null : amount(form, "rate", "Rate");
    if (basis !== "diesel" && rate === null) throw new Error("Enter the rate");
    const scenario = await activeScenarioId();

    await query(
      `insert into transporter_rate (scenario_id, transporter_id, effective_from, cost_basis, rate, notes)
       values ($1, $2, $3, $4, $5, $6)
       on conflict (transporter_id, effective_from) do update
         set cost_basis = excluded.cost_basis, rate = excluded.rate, notes = excluded.notes`,
      [scenario, id, from, basis, rate, text(form, "notes") || null],
    );

    const affected = await query<{ d: string }>(
      `select to_char(run_date, 'YYYY-MM-DD') as d from transport_run
        where transporter_id = $1 and run_date >= $2`,
      [id, from],
    );
    await syncFuelDays(scenario, s, affected.map((r) => r.d));
  });
}

/**
 * A new diesel price, in force from `effective_from` until the next one. Every
 * diesel-paid day already entered from that date on, in either section, is re-costed.
 */
export async function addDieselPrice(form: FormData): Promise<Result> {
  return guard(async () => {
    const from = date(form, "effective_from");
    const price = amount(form, "price_per_litre", "Diesel price");
    if (price === null) throw new Error("Enter the diesel price");
    const scenario = await activeScenarioId();

    await query(
      `insert into diesel_price (scenario_id, effective_from, price_per_litre, notes)
       values ($1, $2, $3, $4)
       on conflict (scenario_id, effective_from) do update
         set price_per_litre = excluded.price_per_litre, notes = excluded.notes`,
      [scenario, from, price, text(form, "notes") || null],
    );

    const affected = await query<{ section: TransportSection; d: string }>(
      `select distinct section, to_char(run_date, 'YYYY-MM-DD') as d from v_transport_run
        where scenario_id = $1 and cost_basis = 'diesel' and run_date >= $2`,
      [scenario, from],
    );
    for (const s of SECTIONS) {
      await syncFuelDays(scenario, s, affected.filter((r) => r.section === s).map((r) => r.d));
    }
  });
}

/** The usual km / trips / diesel a day, used only to pre-fill a transporter's first day entry. */
export async function saveUsualRoute(form: FormData): Promise<Result> {
  return guard(async () => {
    const id = text(form, "transporter_id");
    if (!id) throw new Error("Pick a transporter");
    await query(
      `update transporter set distance_km = $2, trips_per_day = $3, diesel_litre_per_day = $4 where id = $1`,
      [
        id,
        amount(form, "distance_km", "Usual km"),
        amount(form, "trips_per_day", "Usual trips"),
        amount(form, "diesel_litre_per_day", "Usual diesel litres"),
      ],
    );
  });
}
