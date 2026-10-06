import "server-only";
import { query, tx } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { fetchCollections, fetchFarmers, type VamaaCollection, type VamaaFarmer } from "@/lib/vamaa/client";
import { collectionSnf } from "@/lib/vamaa/keys";

/** Days this recent are re-fetched once they're an hour old - collections get corrected the next morning. */
const FRESH_DAYS = 7;
const REFRESH_AFTER_MS = 60 * 60 * 1000;
/** How many centre-days are fetched from the Vamaa app at once. */
const PARALLEL = 8;

export interface Center {
  center: string;
  name: string;
  kind: "village" | "tanker";
}

/**
 * Every active centre, in display order (db/012). Before any are listed, the
 * single VAMAA_CENTER_SHORT_NAME from .env is used, so a fresh setup still works.
 */
export async function centers(): Promise<Center[]> {
  const rows = await query<Center>(
    `select center, name, kind from vamaa_center where is_active order by sort_order, center`);
  if (rows.length) return rows;
  const env = process.env.VAMAA_CENTER_SHORT_NAME;
  if (!env) throw new Error("No Vamaa centres are set up - add them to vamaa_center or set VAMAA_CENTER_SHORT_NAME in .env");
  return [{ center: env, name: `Centre ${env}`, kind: "village" }];
}

/** Every date from `from` to `to`, inclusive. */
function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

async function storeDay(center: string, day: string) {
  const rows = await fetchCollections(center, day);
  await tx(async (client) => {
    // Two fetches of the same centre-day at once (a page open while history loads) would each
    // delete-then-insert and leave the day doubled - so one waits for the other.
    await client.query(`select pg_advisory_xact_lock(hashtext('vamaa_day:' || $1 || ':' || $2))`, [center, day]);
    await client.query(`delete from vamaa_collection where center = $1 and day = $2`, [center, day]);
    for (const r of rows) {
      await client.query(
        `insert into vamaa_collection
           (center, day, farmer_code, shift, milk_type, qty_litre, fat_pct, snf_pct, clr, rate, amount, raw)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          center, day, r.farmer_code, r.shift, r.type, Number(r.quantity) || 0, Number(r.fat) || 0,
          collectionSnf(r), Number(r.clr) || 0, Number(r.rate) || 0, Number(r.amount) || 0, JSON.stringify(r),
        ],
      );
    }
    await client.query(
      `insert into vamaa_sync_day (center, day, fetched_at, row_count) values ($1, $2, now(), $3)
       on conflict (center, day) do update set fetched_at = now(), row_count = excluded.row_count`,
      [center, day, rows.length],
    );
  });
}

/**
 * Makes sure every day from `from` to `to` is in the local copy, for every
 * active centre: centre-days never fetched are fetched, and recent ones are
 * re-fetched once they're an hour old. Future days are skipped. Returns how
 * many centre-days were fetched.
 */
export async function ensureDays(from: string, to: string): Promise<number> {
  const all = (await centers()).map((c) => c.center);
  const now = today();
  const last = to > now ? now : to;
  if (from > last) return 0;

  const synced = await query<{ center: string; day: string; fetched_at: Date }>(
    `select center, to_char(day, 'YYYY-MM-DD') as day, fetched_at from vamaa_sync_day
      where center = any($1) and day between $2 and $3`,
    [all, from, last],
  );
  const fetchedAt = new Map(synced.map((s) => [`${s.center}|${s.day}`, new Date(s.fetched_at).getTime()]));
  const freshFrom = addDays(now, -FRESH_DAYS);

  const todo: [string, string][] = [];
  for (const center of all) {
    for (const d of daysBetween(from, last)) {
      const at = fetchedAt.get(`${center}|${d}`);
      if (at === undefined || (d >= freshFrom && Date.now() - at > REFRESH_AFTER_MS)) todo.push([center, d]);
    }
  }

  for (let i = 0; i < todo.length; i += PARALLEL) {
    await Promise.all(todo.slice(i, i + PARALLEL).map(([c, d]) => storeDay(c, d)));
  }
  return todo.length;
}

/** Refreshes each centre's stored farmer list from the Vamaa app when it is over an hour old (or empty). */
export async function ensureFarmers(): Promise<void> {
  for (const { center } of await centers()) {
    const last = await query<{ at: Date | null }>(
      `select max(fetched_at) as at from vamaa_farmer where center = $1`, [center]);
    const at = last[0]?.at ? new Date(last[0].at).getTime() : 0;
    if (Date.now() - at < REFRESH_AFTER_MS) continue;

    const farmers = await fetchFarmers(center);
    await tx(async (client) => {
      for (const f of farmers) {
        await client.query(
          `insert into vamaa_farmer (center, code, unique_code, name, mobile, milk_type, status, created_on, raw, fetched_at)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, now())
           on conflict (center, code) do update set
             unique_code = excluded.unique_code, name = excluded.name, mobile = excluded.mobile,
             milk_type = excluded.milk_type, status = excluded.status, created_on = excluded.created_on,
             raw = excluded.raw, fetched_at = now()`,
          [
            center, f.code, f.unique_code ?? null,
            f.name_en || [f.first_name, f.last_name].filter(Boolean).join(" ") || null,
            f.mobile || null, f.milk_type || null, f.status ?? null, f.created || null, JSON.stringify(f),
          ],
        );
      }
    });
  }
}

/** Every active centre's stored farmers (the app's record, plus which centre), in centre then code order. */
export async function storedFarmers(): Promise<(VamaaFarmer & { center: string })[]> {
  const rows = await query<{ raw: VamaaFarmer; center: string }>(
    `select f.raw, f.center from vamaa_farmer f join vamaa_center c on c.center = f.center and c.is_active
      order by c.sort_order, f.code`);
  return rows.map((r) => ({ ...r.raw, center: r.center }));
}

/** One day's stored collections across every active centre, exactly as the app sent them. Call `ensureDays` first. */
export async function storedCollections(day: string): Promise<VamaaCollection[]> {
  const rows = await query<{ raw: VamaaCollection }>(
    `select v.raw from vamaa_collection v join vamaa_center c on c.center = v.center and c.is_active
      where v.day = $1
      order by c.sort_order, v.farmer_code, v.shift desc, v.raw->>'qty_time'`,
    [day],
  );
  return rows.map((r) => r.raw);
}
