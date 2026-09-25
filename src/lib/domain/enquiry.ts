import { z } from 'astro/zod';
import { normalisePhone } from './check';
import { emailField, optionalText, optionalWebsite, requiredText } from './validation';

/**
 * Enquiries: every conversation that is not the Kurongeka Check.
 * They all land in one Wix form ("Kurongeka enquiry"), labelled by topic, so staff work one inbox.
 */

export const ENQUIRY_TOPICS = [
  { value: 'call', label: 'Free call' },
  { value: 'question', label: 'Question' },
  { value: 'website-check', label: 'Website fixes' },
  { value: 'directory', label: 'Directory listing' },
  { value: 'launch-brief', label: 'Launch brief' },
] as const;

export type EnquiryTopic = (typeof ENQUIRY_TOPICS)[number]['value'];

export const CALL_WINDOWS = [
  { value: 'morning', label: 'Morning, 9am to 12pm' },
  { value: 'afternoon', label: 'Afternoon, 12pm to 5pm' },
  { value: 'evening', label: 'Early evening, 5pm to 7pm' },
] as const;

export type CallWindow = (typeof CALL_WINDOWS)[number]['value'];

export const ANY_DAY = 'any';

const UK_DATE = new Intl.DateTimeFormat('en-GB', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'Europe/London',
});

const ISO_DATE = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London' });

/** The next working days (UK time), starting tomorrow, as options for a call. */
export function callDays(from: Date = new Date(), count = 10): { value: string; label: string }[] {
  const days: { value: string; label: string }[] = [];
  const cursor = new Date(from.getTime());
  while (days.length < count) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const weekday = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'Europe/London' }).format(cursor);
    if (weekday === 'Sat' || weekday === 'Sun') continue;
    days.push({ value: ISO_DATE.format(cursor), label: UK_DATE.format(cursor) });
  }
  return days;
}

/** "Tuesday 30 September, morning (UK time)" */
export function describeCallSlot(day: string | undefined, window: CallWindow | undefined): string {
  const windowLabel = window ? CALL_WINDOWS.find((w) => w.value === window)?.label.split(',')[0]?.toLowerCase() : null;
  const dayLabel =
    day && day !== ANY_DAY && /^\d{4}-\d{2}-\d{2}$/.test(day) ? UK_DATE.format(new Date(`${day}T12:00:00Z`)) : 'Any working day';
  return windowLabel ? `${dayLabel}, ${windowLabel} (UK time)` : `${dayLabel} (UK time)`;
}

const topicValues = ENQUIRY_TOPICS.map((t) => t.value) as [EnquiryTopic, ...EnquiryTopic[]];
const windowValues = CALL_WINDOWS.map((w) => w.value) as [CallWindow, ...CallWindow[]];

export const enquirySchema = z
  .object({
    topic: z.enum(topicValues, { message: 'Choose what you need' }),
    name: requiredText(80, 'Enter your name'),
    email: emailField,
    phone: optionalText(32),
    company: optionalText(120),
    message: optionalText(2000),
    website: optionalWebsite,
    callDay: optionalText(10),
    callWindow: z
      .union([z.literal(''), z.enum(windowValues)])
      .optional()
      .transform((v) => v || undefined),
    details: optionalText(4000),
    sourcePage: optionalText(200),
    subscribe: z.boolean().optional(),
  })
  .transform((data, ctx) => {
    let phone: string | undefined;
    if (data.phone) {
      const normalised = normalisePhone(data.phone, 'GB');
      if (!normalised) {
        ctx.addIssue({
          code: 'custom',
          path: ['phone'],
          message: 'Enter a full number. Outside the UK, start with your country code, like +263',
        });
        return z.NEVER;
      }
      phone = normalised;
    }
    if (data.topic === 'question' && !data.message) {
      ctx.addIssue({ code: 'custom', path: ['message'], message: 'Tell us what you would like to know' });
      return z.NEVER;
    }
    if (data.topic === 'call' && !phone) {
      ctx.addIssue({ code: 'custom', path: ['phone'], message: 'Add a number we can call' });
      return z.NEVER;
    }
    if (data.topic === 'call' && !data.callWindow) {
      ctx.addIssue({ code: 'custom', path: ['callWindow'], message: 'Choose a time of day' });
      return z.NEVER;
    }
    return { ...data, phone, subscribe: data.subscribe === true };
  });

export type EnquiryInput = z.input<typeof enquirySchema>;
export type Enquiry = z.output<typeof enquirySchema>;

export function topicLabel(topic: EnquiryTopic): string {
  return ENQUIRY_TOPICS.find((t) => t.value === topic)?.label ?? topic;
}
