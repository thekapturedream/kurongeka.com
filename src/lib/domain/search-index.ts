import type { Tool } from '@/config/tools';
import { formatMoney, formatPrice } from './format';
import type { SearchEntry } from './search';
import type { BusinessModel, RunPlan, Solution } from './types';

/** Pages people look for by name. Everything else in the index comes from Wix. */
const PAGES: SearchEntry[] = [
  {
    kind: 'page',
    title: 'Prices and packages',
    summary: 'Fixed launch prices and monthly plans, in pounds.',
    href: '/pricing',
    keywords: ['price', 'prices', 'pricing', 'cost', 'how much', 'packages', 'quote', 'fees', 'budget', 'cheap', 'affordable'],
  },
  {
    kind: 'page',
    title: 'Kurongeka Check',
    summary: 'Seven questions, about two minutes. Get your score and a clear next step.',
    href: '/check',
    keywords: ['check', 'score', 'audit', 'assessment', 'quiz', 'start', 'free check', 'where do i start', 'not sure'],
  },
  {
    kind: 'page',
    title: 'Book a free call',
    summary: 'Pick a time and we call you back.',
    href: '/contact?topic=call',
    keywords: ['call', 'talk', 'speak', 'meeting', 'consultation', 'phone', 'contact', 'call back', 'chat'],
  },
  {
    kind: 'page',
    title: 'Ask a question',
    summary: 'Send us a message and we reply within one working day.',
    href: '/contact?topic=question',
    keywords: ['question', 'contact', 'message', 'enquiry', 'enquire', 'email us', 'whatsapp'],
  },
  {
    kind: 'page',
    title: 'How it works',
    summary: 'Check, launch, run: what happens and when.',
    href: '/how-it-works',
    keywords: ['process', 'steps', 'timeline', 'how long', 'how it works', 'launch', 'what happens'],
  },
  {
    kind: 'page',
    title: 'Client log in',
    summary: 'Follow your launch and manage your plan.',
    href: '/account',
    keywords: ['log in', 'login', 'sign in', 'account', 'dashboard', 'portal', 'my project', 'client', 'register', 'sign up'],
  },
  {
    kind: 'page',
    title: 'Directory',
    summary: 'Businesses launched with Kurongeka.',
    href: '/directory',
    keywords: ['directory', 'listing', 'listings', 'list my business', 'find a business'],
  },
  {
    kind: 'page',
    title: 'About Kurongeka',
    summary: 'Who we are and how we work, from the UK.',
    href: '/about',
    keywords: ['about', 'who', 'team', 'kapture', 'company', 'uk', 'based'],
  },
];

interface IndexInput {
  solutions: Solution[];
  models: BusinessModel[];
  tools: readonly Tool[];
  runPlans: RunPlan[];
}

/** The price line shown next to a solution, from Wix packages and plans. */
export function solutionPrice(solution: Solution, runPlans: RunPlan[]): string | null {
  if (solution.offer === 'run') {
    const cheapest = [...runPlans].sort((a, b) => a.price - b.price)[0];
    return cheapest ? `From ${formatMoney(cheapest.price, cheapest.currency)} a month` : null;
  }
  const price = solution.fromPackage?.price;
  return price ? `From ${formatPrice(price)}` : null;
}

export function buildSearchIndex({ solutions, models, tools, runPlans }: IndexInput): SearchEntry[] {
  const entries: SearchEntry[] = [];
  for (const s of solutions) {
    const meta = solutionPrice(s, runPlans);
    entries.push({
      kind: 'solution',
      title: s.title,
      summary: s.summary,
      href: `/solutions/${s.slug}`,
      keywords: s.keywords,
      icon: s.icon,
      ...(meta ? { meta } : {}),
    });
  }
  for (const m of models) {
    entries.push({
      kind: 'business-type',
      title: m.title,
      summary: m.summary,
      href: `/business-types/${m.slug}`,
      keywords: [m.category, ...m.idealFor],
    });
  }
  for (const t of tools) {
    entries.push({
      kind: 'tool',
      title: t.name,
      summary: t.summary,
      href: `/tools/${t.slug}`,
      keywords: t.keywords,
      meta: 'Free',
    });
  }
  entries.push(...PAGES);
  return entries;
}
