import type { APIRoute } from 'astro';
import { completeCallback } from '@/lib/auth/login';

export const prerender = false;

/** Browser fallback for completing sign-in: Wix returns here with an authorization code. */
export const GET: APIRoute = async ({ cookies, url, redirect }) => {
  const ok = await completeCallback({ cookies, url });
  return redirect(ok ? '/account' : '/account/login?notice=session-ended', 302);
};
