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
