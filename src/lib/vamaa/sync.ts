import "server-only";
import { query, tx } from "@/lib/db";
import { addDays, today } from "@/lib/dates";
import { snfFromClr } from "@/lib/units";
import { fetchCollections, fetchFarmers, type VamaaCollection, type VamaaFarmer } from "@/lib/vamaa/client";

/** Days this recent are re-fetched once they're an hour old - collections get corrected the next morning. */
const FRESH_DAYS = 7;
const REFRESH_AFTER_MS = 60 * 60 * 1000;
/** How many days are fetched from the Vamaa app at once. */
const PARALLEL = 8;

export function centerCode(): string {
  const shortName = process.env.VAMAA_CENTER_SHORT_NAME;
  if (!shortName) throw new Error("VAMAA_CENTER_SHORT_NAME is not set in .env");
  return shortName;
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
    await client.query(`delete from vamaa_collection where center = $1 and day = $2`, [center, day]);
    for (const r of rows) {
      const fat = Number(r.fat) || 0;
      await client.query(
        `insert into vamaa_collection
           (center, day, farmer_code, shift, milk_type, qty_litre, fat_pct, snf_pct, clr, rate, amount, raw)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          center, day, r.farmer_code, r.shift, r.type, Number(r.quantity) || 0, fat,
          snfFromClr(Number(r.clr) || 0, fat), Number(r.clr) || 0, Number(r.rate) || 0,
          Number(r.amount) || 0, JSON.stringify(r),
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
 * Makes sure every day from `from` to `to` is in the local copy: days never
 * fetched are fetched, and recent days are re-fetched once they're an hour
 * old. Future days are skipped. Returns how many days were fetched.
 */
export async function ensureDays(from: string, to: string): Promise<number> {
  const center = centerCode();
  const now = today();
  const last = to > now ? now : to;
  if (from > last) return 0;

  const synced = await query<{ day: string; fetched_at: Date }>(
    `select to_char(day, 'YYYY-MM-DD') as day, fetched_at from vamaa_sync_day
      where center = $1 and day between $2 and $3`,
    [center, from, last],
  );
  const fetchedAt = new Map(synced.map((s) => [s.day, new Date(s.fetched_at).getTime()]));
  const freshFrom = addDays(now, -FRESH_DAYS);

  const todo = daysBetween(from, last).filter((d) => {
    const at = fetchedAt.get(d);
    if (at === undefined) return true;
    return d >= freshFrom && Date.now() - at > REFRESH_AFTER_MS;
  });

  for (let i = 0; i < todo.length; i += PARALLEL) {
    await Promise.all(todo.slice(i, i + PARALLEL).map((d) => storeDay(center, d)));
  }
  return todo.length;
}

/** Refreshes the stored farmer list from the Vamaa app when it is over an hour old (or empty). */
export async function ensureFarmers(): Promise<void> {
  const center = centerCode();
  const last = await query<{ at: Date | null }>(
    `select max(fetched_at) as at from vamaa_farmer where center = $1`, [center]);
  const at = last[0]?.at ? new Date(last[0].at).getTime() : 0;
  if (Date.now() - at < REFRESH_AFTER_MS) return;

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

/** The stored farmer list, in code order, exactly as the app sent each farmer. */
export async function storedFarmers(): Promise<VamaaFarmer[]> {
  const rows = await query<{ raw: VamaaFarmer }>(
    `select raw from vamaa_farmer where center = $1 order by code`, [centerCode()]);
  return rows.map((r) => r.raw);
}

/** One day's stored collections, exactly as the app sent them. Call `ensureDays` first. */
export async function storedCollections(day: string): Promise<VamaaCollection[]> {
  const rows = await query<{ raw: VamaaCollection }>(
    `select raw from vamaa_collection where center = $1 and day = $2
      order by farmer_code, shift desc, raw->>'qty_time'`,
    [centerCode(), day],
  );
  return rows.map((r) => r.raw);
}
