import type { APIRoute } from 'astro';
import { signOut } from '@/lib/auth/login';

export const prerender = false;

/** POST only, from the account page's form, so a link or image cannot log someone out. */
export const POST: APIRoute = async ({ cookies, url, redirect }) => {
  const destination = await signOut({ cookies, url });
  return redirect(destination === '/' ? '/account/login?notice=signed-out' : destination, 303);
};

export const ALL: APIRoute = () => new Response(null, { status: 405, headers: { Allow: 'POST', 'Cache-Control': 'no-store' } });
