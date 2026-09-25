import type { AstroGlobal } from 'astro';

/**
 * CDN caching for CMS-backed pages: Wix edits appear within `maxAge` seconds without a deploy,
 * and a stale copy is served while it refreshes. Error responses are never cached.
 */
export function cachePage(astro: AstroGlobal, { maxAge = 300, ok = true }: { maxAge?: number; ok?: boolean } = {}): void {
  astro.response.headers.set(
    'Cache-Control',
    ok ? `public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=86400` : 'no-store',
  );
}

/** Personal, form-handling and account pages: never cached anywhere. */
export function noStore(astro: AstroGlobal): void {
  astro.response.headers.set('Cache-Control', 'private, no-store');
}

/** A stable key for rate limiting: the first forwarded IP, or the socket address when there is no proxy. */
export function clientKey(request: Request, getAddress: () => string): string {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  if (forwarded) return forwarded;
  try {
    return getAddress() || 'unknown';
  } catch {
    // clientAddress is unavailable in some runtimes.
    return 'unknown';
  }
}

/** Reads a POSTed form. Returns null for anything that is not a readable form body. */
export async function readForm(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}

/** Form values as plain strings; missing fields become empty strings. */
export function formValues<K extends string>(form: FormData, keys: readonly K[]): Record<K, string> {
  const values = {} as Record<K, string>;
  for (const key of keys) {
    const value = form.get(key);
    values[key] = typeof value === 'string' ? value : '';
  }
  return values;
}

/** Only same-site relative paths are allowed as post-login destinations. */
export function safeNextPath(value: string | null | undefined, fallback = '/account'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  return value;
}
