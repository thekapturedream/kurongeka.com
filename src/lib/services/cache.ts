/**
 * Small in-memory TTL cache for Wix reads on a warm server instance.
 * The CDN cache (see pages) does the heavy lifting; this only collapses bursts of identical reads.
 */
interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();

/** A bounded, synchronous TTL cache for tool results (domain lookups, website reports). */
export function createCache<T>(ttlMs: number, maxEntries = 500) {
  const entries = new Map<string, { expires: number; value: T }>();
  return {
    get(key: string): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expires <= Date.now()) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T): void {
      if (entries.size >= maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest !== undefined) entries.delete(oldest);
      }
      entries.set(key, { expires: Date.now() + ttlMs, value });
    },
  };
}

export function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const now = Date.now();
  const hit = store.get(key) as Entry<T> | undefined;
  if (hit && hit.expires > now) return hit.value;
  const value = load();
  store.set(key, { expires: now + ttlMs, value });
  // Never cache failures: the next request retries Wix.
  value.catch(() => store.delete(key));
  return value;
}
