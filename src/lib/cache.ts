/**
 * A small in-process cache for data that changes rarely and is read on every app open (menus, category icons, product
 * photos). Each server process keeps its own copy for a few seconds to a few minutes; nothing here is used for prices
 * at checkout or anything that must be exact at that instant.
 *
 *  - TTL: an entry is used until it is ttlMs old.
 *  - In-flight sharing: when many requests miss at once, the loader runs once and they all wait for that one result.
 *  - Bounded: at most `maxEntries` entries and `maxBytes` of Buffers per cache; the least recently used go first.
 */
interface Entry<T> {
  value: T;
  at: number;
  bytes: number;
}

export class TtlCache<T> {
  private map = new Map<string, Entry<T>>();
  private loading = new Map<string, Promise<T>>();
  private used = 0;

  constructor(private opts: { ttlMs: number; maxEntries?: number; maxBytes?: number; sizeOf?: (v: T) => number }) {}

  async get(key: string, load: () => Promise<T>): Promise<T> {
    const hit = this.map.get(key);
    if (hit && Date.now() - hit.at < this.opts.ttlMs) {
      // most recently used goes to the end
      this.map.delete(key);
      this.map.set(key, hit);
      return hit.value;
    }
    const pending = this.loading.get(key);
    if (pending) return pending;
    const p = load()
      .then((value) => {
        this.put(key, value);
        return value;
      })
      .finally(() => this.loading.delete(key));
    this.loading.set(key, p);
    return p;
  }

  private put(key: string, value: T) {
    const old = this.map.get(key);
    if (old) {
      this.used -= old.bytes;
      this.map.delete(key);
    }
    const bytes = this.opts.sizeOf?.(value) ?? 0;
    // one value bigger than the whole cache is served but not kept
    if (this.opts.maxBytes && bytes > this.opts.maxBytes) return;
    this.map.set(key, { value, at: Date.now(), bytes });
    this.used += bytes;
    const maxEntries = this.opts.maxEntries ?? 1000;
    for (const [k, e] of this.map) {
      if (this.map.size <= maxEntries && (!this.opts.maxBytes || this.used <= this.opts.maxBytes)) break;
      this.map.delete(k);
      this.used -= e.bytes;
    }
  }

  /** Forget one key, or everything (after a change made on this process). */
  clear(key?: string) {
    if (key === undefined) {
      this.map.clear();
      this.used = 0;
    } else {
      const e = this.map.get(key);
      if (e) {
        this.used -= e.bytes;
        this.map.delete(key);
      }
    }
  }

  get stats() {
    return { entries: this.map.size, bytes: this.used };
  }
}
