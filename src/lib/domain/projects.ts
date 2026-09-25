import { z } from 'astro/zod';
import { normalisePhone } from './check';
import { optionalText, optionalWebsite, requiredText } from './validation';

/**
 * Client projects in the portal. A client starts one by submitting a launch brief;
 * Kurongeka staff move it through the stages in Wix Dashboard > CMS > Client projects.
 */

export const PROJECT_STAGES = [
  {
    value: 'brief_received',
    label: 'Brief received',
    client: 'We are reading your brief and will confirm the scope, price and launch date.',
  },
  {
    value: 'in_progress',
    label: 'Building',
    client: 'Your launch is being built. We will share a preview link here when it is ready.',
  },
  {
    value: 'review',
    label: 'Ready for your review',
    client: 'Your preview is ready. Have a look and send us your changes.',
  },
  {
    value: 'live',
    label: 'Live',
    client: 'Your business is live. Run plans keep it up to date.',
  },
] as const;

export type ProjectStage = (typeof PROJECT_STAGES)[number]['value'];
export type ProjectStatus = ProjectStage | 'on_hold';

export function parseStatus(value: string): ProjectStatus {
  const normalised = value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (normalised === 'on_hold') return 'on_hold';
  return PROJECT_STAGES.some((s) => s.value === normalised) ? (normalised as ProjectStage) : 'brief_received';
}

export function stageIndex(status: ProjectStatus): number {
  return PROJECT_STAGES.findIndex((s) => s.value === status);
}

export interface Project {
  id: string;
  title: string;
  status: ProjectStatus;
  nextStep: string;
  clientNote: string;
  previewUrl: string | null;
  liveUrl: string | null;
  filesUrl: string | null;
  targetLaunchDate: string | null;
  depositReceived: boolean;
  packageSlug: string;
  createdAt: string | null;
}

export const LAUNCH_PACKAGE_CHOICES = [
  { value: 'essentials', label: 'Essentials' },
  { value: 'pro', label: 'Pro' },
  { value: 'complete', label: 'Complete' },
  { value: 'unsure', label: 'Not sure yet' },
] as const;

export const ASSETS = [
  { value: 'domain', label: 'A domain name' },
  { value: 'logo', label: 'A logo' },
  { value: 'photos', label: 'Good photos of the business' },
  { value: 'copy', label: 'Written text about what we do' },
  { value: 'social', label: 'Social media accounts' },
  { value: 'google', label: 'A Google Business Profile' },
] as const;

type Value<T extends readonly { value: string }[]> = T[number]['value'];
const values = <T extends readonly { value: string }[]>(options: T) =>
  options.map((o) => o.value) as unknown as [Value<T>, ...Value<T>[]];

export const briefSchema = z
  .object({
    title: requiredText(120, 'Enter the business name'),
    packageSlug: z.enum(values(LAUNCH_PACKAGE_CHOICES), { message: 'Choose a package, or "Not sure yet"' }),
    businessType: requiredText(80, 'Choose a business type'),
    location: requiredText(120, 'Where does the business trade?'),
    currentWebsite: optionalWebsite,
    assetsReady: z.array(z.enum(values(ASSETS))).default([]),
    goals: requiredText(1000, 'Tell us what a successful launch looks like'),
    contactPhone: optionalText(32),
  })
  .transform((data, ctx) => {
    if (!data.contactPhone) return { ...data, contactPhone: undefined };
    const phone = normalisePhone(data.contactPhone, 'GB');
    if (!phone) {
      ctx.addIssue({
        code: 'custom',
        path: ['contactPhone'],
        message: 'Enter a full number. Outside the UK, start with your country code',
      });
      return z.NEVER;
    }
    return { ...data, contactPhone: phone };
  });

export type Brief = z.output<typeof briefSchema>;

export const signUpSchema = z.object({
  firstName: requiredText(60, 'Enter your first name'),
  lastName: optionalText(60),
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email('Enter a valid email address').max(254),
  ),
  password: z
    .string()
    .min(8, 'Use at least 8 characters')
    .max(100, 'Use at most 100 characters')
    .refine((p) => /[a-z]/i.test(p) && /\d|[^a-z]/i.test(p), 'Mix letters with numbers or symbols'),
});

export const signInSchema = z.object({
  email: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toLowerCase() : v),
    z.email('Enter a valid email address').max(254),
  ),
  password: z.string().min(1, 'Enter your password').max(100),
});
