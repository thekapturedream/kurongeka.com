import type { APIRoute } from 'astro';

export const prerender = false;

/**
 * Landing point for the old Wix-designed site. Its pages (kapturestudio.wixstudio.com/kurongeka/...)
 * redirect here with Wix SEO redirects, and this sends each one to the matching page on kurongeka.com.
 */
const LEGACY: [RegExp, string][] = [
  [/^pricing-plans(\/|$)/, '/pricing#run-plans'],
  [/^(product-page|category|shop|cart-page)(\/|$)/, '/pricing'],
  [/^(book-online|booking-calendar|service-page)(\/|$)/, '/contact?topic=call'],
  [/^(members|profile)(\/|$)/, '/account'],
];

export const GET: APIRoute = ({ params, redirect }) => {
  const path = (params['path'] ?? '').replace(/^\/+/, '');
  const target = LEGACY.find(([pattern]) => pattern.test(path))?.[1] ?? '/';
  return redirect(target, 301);
};
