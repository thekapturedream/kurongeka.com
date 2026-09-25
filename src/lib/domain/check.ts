import { z } from 'astro/zod';

/**
 * The Kurongeka Check: seven questions plus contact details.
 * Pure domain logic shared by the check UI, the API route and the result page.
 */

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

export const STAGES = [
  { value: 'starting', label: 'Starting out, not trading yet' },
  { value: 'young', label: 'Trading for less than a year' },
  { value: 'established', label: 'Established, a year or more' },
] as const satisfies readonly Option[];

export const WEBSITE_STATUS = [
  { value: 'none', label: 'No website yet' },
  { value: 'outdated', label: 'Yes, but it is out of date or hard to update' },
  { value: 'good', label: 'Yes, and it works well' },
] as const satisfies readonly Option[];

export const MAPS_STATUS = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'unsure', label: 'I am not sure' },
] as const satisfies readonly Option[];

export const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash' },
  { value: 'mobile-money', label: 'Mobile money, such as EcoCash' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'card', label: 'Card, in person' },
  { value: 'online', label: 'Online, through a website or payment link' },
] as const satisfies readonly Option[];

export const BRAND_STATUS = [
  { value: 'yes', label: 'Yes, it works for us' },
  { value: 'partly', label: 'It is fine, but it could be better' },
  { value: 'no', label: 'No, or we do not have one' },
] as const satisfies readonly Option[];

export const PRIORITIES = [
  { value: 'customers', label: 'Getting more customers' },
  { value: 'credibility', label: 'Looking more professional' },
  { value: 'payments', label: 'Getting paid online' },
  { value: 'time', label: 'Spending less time on admin' },
  { value: 'tenders', label: 'Winning tenders and bigger contracts' },
] as const satisfies readonly Option[];

export const CONTACT_PREFERENCES = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'call', label: 'Phone call' },
  { value: 'email', label: 'Email' },
] as const satisfies readonly Option[];

export const COUNTRIES = [
  { value: 'GB', label: 'United Kingdom', dial: '44' },
  { value: 'IE', label: 'Ireland', dial: '353' },
  { value: 'ZW', label: 'Zimbabwe', dial: '263' },
  { value: 'ZA', label: 'South Africa', dial: '27' },
  { value: 'ZM', label: 'Zambia', dial: '260' },
  { value: 'BW', label: 'Botswana', dial: '267' },
  { value: 'MZ', label: 'Mozambique', dial: '258' },
  { value: 'NA', label: 'Namibia', dial: '264' },
  { value: 'MW', label: 'Malawi', dial: '265' },
  { value: 'KE', label: 'Kenya', dial: '254' },
  { value: 'NG', label: 'Nigeria', dial: '234' },
  { value: 'US', label: 'United States', dial: '1' },
  { value: 'OTHER', label: 'Somewhere else', dial: '' },
] as const;

export const OTHER_BUSINESS_TYPE = 'other';

type Values<T extends readonly Option[]> = T[number]['value'];
const values = <T extends readonly Option[]>(options: T) =>
  options.map((o) => o.value) as unknown as [Values<T>, ...Values<T>[]];

export type Stage = Values<typeof STAGES>;
export type WebsiteStatus = Values<typeof WEBSITE_STATUS>;
export type MapsStatus = Values<typeof MAPS_STATUS>;
export type PaymentMethod = Values<typeof PAYMENT_METHODS>;
export type BrandStatus = Values<typeof BRAND_STATUS>;
export type Priority = Values<typeof PRIORITIES>;
export type ContactPreference = Values<typeof CONTACT_PREFERENCES>;
export type CountryCode = (typeof COUNTRIES)[number]['value'];

export const RECOMMENDATIONS = ['essentials', 'pro', 'complete', 'run'] as const;
export type Recommendation = (typeof RECOMMENDATIONS)[number];

/** Normalises a phone number to E.164 using the selected country for local formats. */
export function normalisePhone(raw: string, country: CountryCode): string | null {
  let digits = raw.trim().replace(/[\s().-]/g, '');
  if (digits.startsWith('00')) digits = `+${digits.slice(2)}`;
  if (!digits.startsWith('+')) {
    const dial = COUNTRIES.find((c) => c.value === country)?.dial;
    if (!dial) return null;
    const national = digits.startsWith('0') ? digits.slice(1) : digits;
    if (!/^\d{7,12}$/.test(national)) return null;
    digits = `+${dial}${national}`;
  }
  // E.164: country code plus subscriber number, 9 to 15 digits in total.
  return /^\+[1-9]\d{8,14}$/.test(digits) ? digits : null;
}

const trimmed = (max: number) => z.string().trim().min(1, 'Required').max(max, `Keep this under ${max} characters`);

export const checkSchema = z
  .object({
    businessType: z.string().trim().min(1, 'Choose a business type').max(80),
    stage: z.enum(values(STAGES), { message: 'Choose one' }),
    website: z.enum(values(WEBSITE_STATUS), { message: 'Choose one' }),
    maps: z.enum(values(MAPS_STATUS), { message: 'Choose one' }),
    payments: z.array(z.enum(values(PAYMENT_METHODS))).min(1, 'Choose at least one'),
    brand: z.enum(values(BRAND_STATUS), { message: 'Choose one' }),
    priority: z.enum(values(PRIORITIES), { message: 'Choose one' }),
    name: trimmed(80),
    business: trimmed(120),
    country: z.enum(COUNTRIES.map((c) => c.value) as [CountryCode, ...CountryCode[]], { message: 'Choose a country' }),
    phone: z.string().trim().min(1, 'Enter your WhatsApp number').max(32),
    email: z
      .preprocess(
        (value) => (typeof value === 'string' ? value.trim() : value),
        z.union([z.literal(''), z.email('Enter a valid email address').max(160)]),
      )
      .optional(),
    contactPreference: z.enum(values(CONTACT_PREFERENCES), { message: 'Choose one' }),
    subscribe: z.boolean().optional(),
    /** Package the visitor was looking at when they started the check, if any. */
    interest: z.union([z.literal(''), z.enum(['essentials', 'pro', 'complete', 'run'])]).optional(),
  })
  .transform((data, ctx) => {
    const phone = normalisePhone(data.phone, data.country);
    if (!phone) {
      ctx.addIssue({
        code: 'custom',
        path: ['phone'],
        message: 'Enter a full number, including the country code if you are outside the listed countries',
      });
      return z.NEVER;
    }
    if (data.contactPreference === 'email' && !data.email) {
      ctx.addIssue({ code: 'custom', path: ['email'], message: 'Add an email address so we can reply by email' });
      return z.NEVER;
    }
    return {
      ...data,
      phone,
      email: data.email || undefined,
      subscribe: data.subscribe === true,
      interest: data.interest || undefined,
    };
  });

export type CheckInput = z.input<typeof checkSchema>;
export type CheckAnswers = z.output<typeof checkSchema>;

export interface CheckScore {
  found: number;
  trusted: number;
  paid: number;
  overall: number;
}

export type ScoreBand = 'low' | 'mid' | 'high';

const WEBSITE_FOUND: Record<WebsiteStatus, number> = { none: 0, outdated: 20, good: 50 };
const MAPS_FOUND: Record<MapsStatus, number> = { yes: 50, unsure: 15, no: 0 };
const BRAND_TRUSTED: Record<BrandStatus, number> = { yes: 60, partly: 30, no: 0 };
const WEBSITE_TRUSTED: Record<WebsiteStatus, number> = { none: 0, outdated: 15, good: 40 };
const PAYMENT_POINTS: Record<PaymentMethod, number> = {
  online: 40,
  card: 25,
  'mobile-money': 20,
  'bank-transfer': 10,
  cash: 5,
};

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function scoreCheck(answers: Pick<CheckAnswers, 'website' | 'maps' | 'brand' | 'payments'>): CheckScore {
  const found = clamp(WEBSITE_FOUND[answers.website] + MAPS_FOUND[answers.maps]);
  const trusted = clamp(BRAND_TRUSTED[answers.brand] + WEBSITE_TRUSTED[answers.website]);
  const unique = [...new Set(answers.payments)];
  const paid = clamp(unique.reduce((sum, method) => sum + PAYMENT_POINTS[method], 0));
  return { found, trusted, paid, overall: clamp((found + trusted + paid) / 3) };
}

export function band(score: number): ScoreBand {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

export const BAND_LABEL: Record<ScoreBand, string> = {
  low: 'Not yet set up',
  mid: 'Partly set up',
  high: 'Properly set up',
};

/**
 * Picks the next step. Order matters: established, well-presented businesses need care, not a rebuild;
 * tender-focused or unbranded established businesses need the full brand system.
 */
export function recommend(
  answers: Pick<CheckAnswers, 'website' | 'brand' | 'stage' | 'priority'>,
  score: CheckScore,
  modelPackageSlug?: string | null,
): Recommendation {
  if (answers.website === 'good' && answers.brand === 'yes' && score.found >= 70) return 'run';
  if (answers.priority === 'tenders') return 'complete';
  if (answers.stage === 'established' && answers.brand === 'no') return 'complete';
  if (answers.priority === 'payments') return 'pro';
  if (modelPackageSlug && isRecommendation(modelPackageSlug) && modelPackageSlug !== 'run') return modelPackageSlug;
  if (answers.stage === 'starting') return 'essentials';
  return 'pro';
}

export function isRecommendation(value: unknown): value is Recommendation {
  return typeof value === 'string' && (RECOMMENDATIONS as readonly string[]).includes(value);
}

export const PILLAR_COPY: Record<keyof Omit<CheckScore, 'overall'>, { title: string } & Record<ScoreBand, string>> = {
  found: {
    title: 'Found',
    low: 'People searching for what you sell are finding competitors first.',
    mid: 'Customers can find you, but not consistently.',
    high: 'Customers can find you easily on Google and Maps.',
  },
  trusted: {
    title: 'Trusted',
    low: 'Your brand and website are not yet doing the selling for you.',
    mid: 'You look credible, with room to look established.',
    high: 'You look like the serious business you are.',
  },
  paid: {
    title: 'Paid',
    low: 'Most customers can only pay you in person, which limits sales.',
    mid: 'Some customers can pay you remotely, but not all of them.',
    high: 'Customers can pay you the way they prefer.',
  },
};

/** Result pages carry scores in the URL, never personal data. */
export interface ResultParams extends CheckScore {
  recommendation: Recommendation;
  businessType: string | null;
}

export function resultPath(params: ResultParams): string {
  const query = new URLSearchParams({
    s: String(params.overall),
    f: String(params.found),
    t: String(params.trusted),
    p: String(params.paid),
    r: params.recommendation,
  });
  if (params.businessType) query.set('b', params.businessType);
  return `/check/result?${query.toString()}`;
}

export function parseResultParams(search: URLSearchParams): ResultParams | null {
  const num = (key: string) => {
    const raw = search.get(key);
    if (raw === null || !/^\d{1,3}$/.test(raw)) return null;
    const n = Number(raw);
    return n >= 0 && n <= 100 ? n : null;
  };
  const found = num('f');
  const trusted = num('t');
  const paid = num('p');
  const overall = num('s');
  const recommendation = search.get('r');
  if (found === null || trusted === null || paid === null || overall === null || !isRecommendation(recommendation)) {
    return null;
  }
  const b = search.get('b');
  const businessType = b && /^[a-z0-9-]{1,80}$/.test(b) ? b : null;
  return { found, trusted, paid, overall, recommendation, businessType };
}

export function labelFor<T extends readonly Option[]>(options: T, value: string): string {
  return options.find((o) => o.value === value)?.label ?? value;
}
