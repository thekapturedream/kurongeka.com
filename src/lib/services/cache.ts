/**
 * Small in-memory TTL cache for Wix reads on a warm server instance.
 * The CDN cache (see pages) does the heavy lifting; this only collapses bursts of identical reads.
 */
interface Entry<T> {
  expires: number;
  value: Promise<T>;
}

const store = new Map<string, Entry<unknown>>();

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
