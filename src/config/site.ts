import { CONTACT_EMAIL, WHATSAPP_NUMBER } from 'astro:env/server';

/** Brand-level facts. Operational content (packages, models, FAQs, plans) lives in Wix. */
export const site = {
  name: 'Kurongeka',
  legalName: 'Kurongeka, a Kapture company',
  url: 'https://www.kurongeka.com',
  tagline: 'Your business, properly set up.',
  description:
    'Kurongeka launches small businesses online in days: website, brand, payments and bookings, then keeps them running. Fixed prices. Built on Wix, delivered by Kapture.',
  locale: 'en_GB',
  parent: {
    name: 'Kapture',
    url: 'https://www.thekapture.com',
  },
  /** Where the business is run from, and who it serves. */
  base: 'United Kingdom',
  serves: 'the UK and Southern Africa',
  contact: {
    email: CONTACT_EMAIL,
    whatsapp: WHATSAPP_NUMBER,
  },
  /** Only handles confirmed to exist. Add others once verified. */
  social: [{ label: 'Instagram', handle: '@kurongekadotcom', url: 'https://www.instagram.com/kurongekadotcom' }],
} as const;

export const nav = [
  { label: 'How it works', href: '/how-it-works' },
  { label: 'Business types', href: '/business-types' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Free tools', href: '/tools' },
  { label: 'About', href: '/about' },
] as const;

export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatWhatsapp(number: string = site.contact.whatsapp): string {
  // UK mobile: 447352144677 -> +44 7352 144677
  const uk = /^(44)(7\d{3})(\d{6})$/.exec(number);
  if (uk) return `+${uk[1]} ${uk[2]} ${uk[3]}`;
  // Zimbabwe: 263771234567 -> +263 77 123 4567
  const zw = /^(263)(\d{2})(\d{3})(\d{4})$/.exec(number);
  return zw ? `+${zw[1]} ${zw[2]} ${zw[3]} ${zw[4]}` : `+${number}`;
}
