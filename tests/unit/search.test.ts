import { describe, expect, it } from 'vitest';
import { tools } from '@/config/tools';
import { normalise, search, stem, terms, withinOneEdit } from '@/lib/domain/search';
import { buildSearchIndex, solutionPrice } from '@/lib/domain/search-index';
import type { BusinessModel, LaunchPackage, RunPlan, Solution } from '@/lib/domain/types';

const pkg = (slug: string, price: number): LaunchPackage => ({
  id: slug,
  slug,
  title: slug[0]!.toUpperCase() + slug.slice(1),
  tagline: '',
  price,
  deliveryDays: 7,
  includes: [],
  bestFor: '',
  highlighted: false,
});

const solution = (slug: string, title: string, keywords: string[], extra: Partial<Solution> = {}): Solution => ({
  id: slug,
  slug,
  title,
  summary: '',
  intro: '',
  includes: [],
  keywords,
  icon: 'globe',
  offer: 'launch',
  fromPackage: pkg('essentials', 390),
  relatedTool: null,
  seoTitle: '',
  seoDescription: '',
  ...extra,
});

const model = (slug: string, title: string, category: string, idealFor: string[]): BusinessModel => ({
  id: slug,
  slug,
  title,
  category,
  summary: '',
  body: '',
  idealFor,
  customerActions: [],
  wixSolutions: [],
  launchDays: null,
  recommendedPackage: null,
  imageUrl: null,
  demoUrl: null,
  seoTitle: '',
  seoDescription: '',
});

const runPlans: RunPlan[] = [
  { id: 'g', slug: 'run-grow', name: 'Run Grow', description: '', perks: [], price: 119, currency: 'GBP', interval: 'month' },
  { id: 'c', slug: 'run-care', name: 'Run Care', description: '', perks: [], price: 39, currency: 'GBP', interval: 'month' },
];

const index = buildSearchIndex({
  solutions: [
    solution('website', 'A website', ['website', 'site', 'landing page', 'redesign']),
    solution('brand', 'Logo and brand', ['logo', 'branding', 'colours', 'business cards']),
    solution('bookings', 'Online bookings', ['booking', 'appointments', 'reservations'], { fromPackage: pkg('pro', 990) }),
    solution('payments', 'Get paid online', ['payments', 'card', 'mobile money', 'ecocash']),
    solution('monthly-care', 'Monthly care', ['maintenance', 'updates', 'support'], { offer: 'run', fromPackage: null }),
  ],
  models: [
    model('salons-and-wellness', 'Salons, barbers and wellness', 'Beauty and wellness', ['Hair salons', 'Barbers']),
    model('clinics-and-dental', 'Clinics and dental practices', 'Health', ['Dentists', 'GPs and clinics']),
  ],
  tools,
  runPlans,
});

const titles = (query: string) => search(index, query).map((r) => r.title);

describe('search text handling', () => {
  it('normalises case, accents and punctuation', () => {
    expect(normalise('Cafés & Bakeries!')).toBe('cafes and bakeries');
    expect(normalise('.co.uk')).toBe('co.uk');
  });

  it('stems simple plurals', () => {
    expect(stem('bookings')).toBe('booking');
    expect(stem('agencies')).toBe('agency');
    expect(stem('business')).toBe('business');
  });

  it('drops filler words', () => {
    expect(terms('I need a website for my salon')).toEqual(['website', 'salon']);
  });

  it('tolerates one typo', () => {
    expect(withinOneEdit('webiste', 'website')).toBe(true);
    expect(withinOneEdit('bookng', 'booking')).toBe(true);
    expect(withinOneEdit('logo', 'lodge')).toBe(false);
  });
});

describe('search', () => {
  it('finds the solution and the business type in one query', () => {
    const found = titles('website for my salon');
    expect(found.slice(0, 2)).toEqual(expect.arrayContaining(['A website', 'Salons, barbers and wellness']));
  });

  it('matches keywords and synonyms', () => {
    expect(titles('ecocash')[0]).toBe('Get paid online');
    expect(titles('appointments')[0]).toBe('Online bookings');
    expect(titles('dentist')[0]).toBe('Clinics and dental practices');
    expect(titles('maintenance')[0]).toBe('Monthly care');
  });

  it('matches as you type', () => {
    expect(titles('boo')[0]).toBe('Online bookings');
    expect(titles('log')).toContain('Logo and brand');
  });

  it('survives typos', () => {
    expect(titles('webiste')[0]).toBe('A website');
  });

  it('finds tools and pages', () => {
    expect(titles('how much')[0]).toBe('Prices and packages');
    expect(titles('email signature')[0]).toBe('Email signature');
    expect(titles('login')[0]).toBe('Client log in');
  });

  it('returns nothing for empty or filler-only queries', () => {
    expect(search(index, '')).toEqual([]);
    expect(search(index, 'I need a')).toEqual([]);
    expect(search(index, 'zzzqqq')).toEqual([]);
  });

  it('respects the limit', () => {
    expect(search(index, 'a', 3).length).toBeLessThanOrEqual(3);
  });
});

describe('solution prices', () => {
  it('uses the cheapest package for launch solutions', () => {
    expect(solutionPrice(solution('website', 'A website', []), runPlans)).toBe('From £390');
  });

  it('uses the cheapest monthly plan for run solutions', () => {
    expect(solutionPrice(solution('care', 'Monthly care', [], { offer: 'run', fromPackage: null }), runPlans)).toBe(
      'From £39 a month',
    );
  });
});
