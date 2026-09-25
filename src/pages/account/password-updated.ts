import type { APIRoute } from 'astro';

export const prerender = false;

/** Wix sends members here after they set a new password on the Wix-hosted reset page. */
export const GET: APIRoute = ({ redirect }) => redirect('/account/login?notice=password-updated', 302);
