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
  locations: ['Harare', 'London'],
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
  { label: 'About', href: '/about' },
] as const;

export function whatsappUrl(message?: string): string {
  const base = `https://wa.me/${site.contact.whatsapp}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

export function formatWhatsapp(number: string = site.contact.whatsapp): string {
  // 263771535326 -> +263 77 153 5326
  const match = /^(263)(\d{2})(\d{3})(\d{4})$/.exec(number);
  return match ? `+${match[1]} ${match[2]} ${match[3]} ${match[4]}` : `+${number}`;
}
