import type { APIRoute } from 'astro';
import { checkSchema, resultPath, scoreCheck } from '@/lib/domain/check';
import { submitCheck } from '@/lib/services/leads';
import { allowRequest } from '@/lib/services/rate-limit';

export const prerender = false;

const NO_STORE = { 'Cache-Control': 'no-store' };

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...NO_STORE },
  });
}

function redirect(location: string): Response {
  return new Response(null, { status: 303, headers: { Location: location, ...NO_STORE } });
}

async function readBody(request: Request): Promise<{ data: Record<string, unknown>; wantsJson: boolean } | null> {
  const type = request.headers.get('content-type') ?? '';
  const wantsJson = type.includes('application/json');
  try {
    if (wantsJson) {
      const data: unknown = await request.json();
      return data && typeof data === 'object' ? { data: data as Record<string, unknown>, wantsJson } : null;
    }
    const form = await request.formData();
    return {
      wantsJson,
      data: {
        ...Object.fromEntries(Array.from(form.keys()).map((key) => [key, form.get(key)])),
        payments: form.getAll('payments'),
        subscribe: form.get('subscribe') === 'true',
      },
    };
  } catch {
    return null;
  }
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  const body = await readBody(request);
  if (!body) return json({ ok: false, message: 'Unreadable request.' }, 400);
  const { data, wantsJson } = body;

  // Honeypot: bots fill every field. Pretend success, record nothing.
  if (typeof data['company_website'] === 'string' && data['company_website'].trim() !== '') {
    return wantsJson ? json({ ok: true, resultUrl: '/check' }) : redirect('/check');
  }

  let ip = 'unknown';
  try {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || clientAddress || 'unknown';
  } catch {
    /* clientAddress is unavailable in some runtimes */
  }
  if (!allowRequest(ip)) {
    return wantsJson
      ? json({ ok: false, message: 'Too many attempts. Please wait a few minutes or message us on WhatsApp.' }, 429)
      : redirect('/check?error=unavailable');
  }

  const parsed = checkSchema.safeParse(data);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      fieldErrors[key] ??= issue.message;
    }
    return wantsJson ? json({ ok: false, fieldErrors }, 400) : redirect('/check?error=invalid');
  }

  try {
    const outcome = await submitCheck(parsed.data);
    const url = resultPath({ ...outcome.score, recommendation: outcome.recommendation, businessType: outcome.businessType });
    return wantsJson ? json({ ok: true, resultUrl: url, score: outcome.score.overall }) : redirect(url);
  } catch (error) {
    console.error('[check] submission failed', error instanceof Error ? error.message : error);
    const score = scoreCheck(parsed.data).overall;
    return wantsJson
      ? json({ ok: false, message: 'We could not record your answers.', score }, 502)
      : redirect('/check?error=unavailable');
  }
};

export const ALL: APIRoute = () =>
  new Response(null, { status: 405, headers: { Allow: 'POST', ...NO_STORE } });
