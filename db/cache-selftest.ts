/**
 * Self-test of the in-process cache (src/lib/cache.ts). No database needed.
 *
 *   npx tsx db/cache-selftest.ts
 */
import { TtlCache } from "../src/lib/cache";

let failures = 0;
const check = (ok: boolean, what: string) => {
  console.log(`${ok ? "PASS" : "FAIL"}  ${what}`);
  if (!ok) failures++;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  // TTL
  let loads = 0;
  const c = new TtlCache<number>({ ttlMs: 80 });
  const load = async () => ++loads;
  await c.get("a", load);
  await c.get("a", load);
  check(loads === 1, "a second read within the TTL comes from the cache");
  await sleep(100);
  await c.get("a", load);
  check(loads === 2, "after the TTL it loads again");

  // many requests at once share one load
  let slow = 0;
  const s = new TtlCache<string>({ ttlMs: 1000 });
  const out = await Promise.all(Array.from({ length: 50 }, () => s.get("k", async () => { slow++; await sleep(30); return "v"; })));
  check(slow === 1 && out.every((v) => v === "v"), "50 requests at once run the loader once");

  // a failed load is not cached
  const f = new TtlCache<string>({ ttlMs: 1000 });
  let tries = 0;
  await f.get("x", async () => { tries++; throw new Error("db down"); }).catch(() => null);
  const ok = await f.get("x", async () => { tries++; return "back"; });
  check(tries === 2 && ok === "back", "a failed load is tried again next time");

  // bounded by bytes, least recently used goes first
  const b = new TtlCache<Buffer>({ ttlMs: 60_000, maxBytes: 300, sizeOf: (v) => v.length });
  await b.get("1", async () => Buffer.alloc(100));
  await b.get("2", async () => Buffer.alloc(100));
  await b.get("1", async () => Buffer.alloc(100)); // 1 used again: 2 is now the oldest
  await b.get("3", async () => Buffer.alloc(150));
  check(b.stats.bytes <= 300, `stays within its byte limit (${b.stats.bytes} of 300)`);
  let reloaded2 = false, reloaded1 = false;
  await b.get("2", async () => { reloaded2 = true; return Buffer.alloc(10); });
  await b.get("1", async () => { reloaded1 = true; return Buffer.alloc(10); });
  check(reloaded2 && !reloaded1, "the least recently used entry was dropped first");
  const huge = await b.get("big", async () => Buffer.alloc(1000));
  check(huge.length === 1000 && b.stats.bytes <= 300, "a value bigger than the whole cache is served but not kept");

  // bounded by entries
  const e = new TtlCache<number>({ ttlMs: 60_000, maxEntries: 3 });
  for (let i = 0; i < 10; i++) await e.get(String(i), async () => i);
  check(e.stats.entries === 3, "stays within its entry limit");

  // clear
  e.clear();
  check(e.stats.entries === 0 && e.stats.bytes === 0, "clear empties it");

  console.log(failures ? `\n${failures} check(s) FAILED` : "\nAll checks passed");
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
