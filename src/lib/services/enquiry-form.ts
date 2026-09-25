import { enquirySchema, type Enquiry } from '@/lib/domain/enquiry';
import { fieldErrors } from '@/lib/domain/validation';
import { formValues } from '@/lib/http';
import { submitEnquiry } from './enquiries';
import { allowRequest } from './rate-limit';

export const ENQUIRY_FIELDS = [
  'topic',
  'name',
  'email',
  'phone',
  'company',
  'message',
  'website',
  'callDay',
  'callWindow',
  'details',
  'sourcePage',
] as const;

export type EnquiryValues = Record<(typeof ENQUIRY_FIELDS)[number], string> & { subscribe: boolean };

export interface EnquiryFormState {
  status: 'idle' | 'sent' | 'invalid' | 'failed' | 'limited';
  values: EnquiryValues;
  errors: Record<string, string>;
  enquiry?: Enquiry;
}

export function emptyEnquiry(overrides: Partial<EnquiryValues> = {}): EnquiryValues {
  const values = Object.fromEntries(ENQUIRY_FIELDS.map((k) => [k, ''])) as Record<(typeof ENQUIRY_FIELDS)[number], string>;
  return { ...values, subscribe: false, ...overrides };
}

/** True when the hidden honeypot field was filled in, which people never do. */
export function isBot(form: FormData): boolean {
  const honeypot = form.get('company_website');
  return typeof honeypot === 'string' && honeypot.trim() !== '';
}

/**
 * Handles a server-rendered enquiry form POST: honeypot, rate limit, validation, then Wix Forms.
 * `fixed` values (topic, source page, composed details) override whatever the browser sent.
 */
export async function handleEnquiryForm(
  form: FormData | null,
  clientKey: string,
  fixed: Partial<EnquiryValues> = {},
): Promise<EnquiryFormState> {
  if (!form) return { status: 'invalid', values: emptyEnquiry(fixed), errors: { form: 'Please try again.' } };

  const values: EnquiryValues = {
    ...formValues(form, ENQUIRY_FIELDS),
    subscribe: form.get('subscribe') === 'true',
    ...fixed,
  };

  if (isBot(form)) return { status: 'sent', values, errors: {} };

  if (!allowRequest(clientKey)) return { status: 'limited', values, errors: {} };

  const parsed = enquirySchema.safeParse(values);
  if (!parsed.success) return { status: 'invalid', values, errors: fieldErrors(parsed.error) };

  try {
    await submitEnquiry(parsed.data);
    return { status: 'sent', values, errors: {}, enquiry: parsed.data };
  } catch (error) {
    console.error('[enquiry] submission failed', error instanceof Error ? error.message : error);
    return { status: 'failed', values, errors: {} };
  }
}
