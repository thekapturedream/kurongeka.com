/** The free tools. Rebuilt from the original Kurongeka portal as working, honest utilities. */
export interface Tool {
  slug: string;
  name: string;
  summary: string;
  time: string;
}

export const tools: readonly Tool[] = [
  {
    slug: 'website-check',
    name: 'Website check',
    summary: 'Check any website for search, trust and speed problems, with a plain-English fix for each.',
    time: 'About 10 seconds',
  },
  {
    slug: 'domain-check',
    name: 'Name and domain check',
    summary: 'See whether your business name is free as a .co.uk, .com and more, straight from the registries.',
    time: 'About 5 seconds',
  },
  {
    slug: 'brand-colours',
    name: 'Brand colours',
    summary: 'Build a four-colour palette from your brand colour and check it passes accessibility contrast rules.',
    time: 'Instant',
  },
  {
    slug: 'email-signature',
    name: 'Email signature',
    summary: 'Make a clean email signature for Gmail, Outlook or Apple Mail and copy it in one click.',
    time: 'Two minutes',
  },
];
