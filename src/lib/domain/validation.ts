import { z } from 'astro/zod';

/** Shared field rules for Kurongeka forms. */

export const requiredText = (max: number, message = 'Required') =>
  z.string().trim().min(1, message).max(max, `Keep this under ${max} characters`);

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Keep this under ${max} characters`)
    .optional()
    .transform((v) => (v ? v : undefined));

export const emailField = z.preprocess(
  (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
  z.email('Enter a valid email address').max(254),
);

/** Accepts "example.com", "www.example.com" or a full URL; returns a normalised https URL or undefined. */
export const optionalWebsite = z
  .string()
  .trim()
  .max(200, 'Keep this under 200 characters')
  .optional()
  .transform((value, ctx) => {
    if (!value) return undefined;
    const withScheme = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    try {
      const url = new URL(withScheme);
      if (!url.hostname.includes('.')) throw new Error('no dot');
      return url.toString();
    } catch {
      ctx.addIssue({ code: 'custom', message: 'Enter a website address, like example.com' });
      return z.NEVER;
    }
  });

/** First message per field, for rendering next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    errors[key] ??= issue.message;
  }
  return errors;
}
