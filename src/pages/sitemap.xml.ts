import type { APIRoute } from 'astro';
import { site } from '@/config/site';
import { getBusinessModels, getDirectoryListings, getSolutions } from '@/lib/services/catalog';

export const prerender = false;

const STATIC_PATHS = [
  '/',
  '/solutions',
  '/how-it-works',
  '/business-types',
  '/pricing',
  '/check',
  '/tools',
  '/tools/website-check',
  '/tools/domain-check',
  '/tools/brand-colours',
  '/tools/email-signature',
  '/contact',
  '/about',
  '/privacy',
  '/terms',
];

export const GET: APIRoute = async () => {
  const [models, listings, solutions] = await Promise.all([getBusinessModels(), getDirectoryListings(), getSolutions()]);
  const paths = [
    ...STATIC_PATHS,
    ...solutions.data.map((s) => `/solutions/${s.slug}`),
    ...models.data.map((m) => `/business-types/${m.slug}`),
    ...(listings.data.length > 0 ? ['/directory', ...listings.data.map((l) => `/directory/${l.slug}`)] : []),
  ];
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paths.map((path) => `  <url><loc>${new URL(path, site.url).toString()}</loc></url>`).join('\n')}
</urlset>
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': models.ok && listings.ok && solutions.ok ? 'public, max-age=0, s-maxage=3600' : 'no-store',
    },
  });
};
