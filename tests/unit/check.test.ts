import { describe, expect, it } from 'vitest';
import {
  band,
  checkSchema,
  normalisePhone,
  parseResultParams,
  recommend,
  resultPath,
  scoreCheck,
  type CheckInput,
} from '@/lib/domain/check';

const base: CheckInput = {
  businessType: 'clinics-and-dental',
  stage: 'young',
  website: 'none',
  maps: 'no',
  payments: ['cash'],
  brand: 'partly',
  priority: 'customers',
  name: 'Tariro',
  business: 'Bright Smile',
  country: 'ZW',
  phone: '077 123 4567',
  email: '',
  contactPreference: 'whatsapp',
};

describe('normalisePhone', () => {
  it('converts local numbers using the country dial code', () => {
    expect(normalisePhone('077 123 4567', 'ZW')).toBe('+263771234567');
    expect(normalisePhone('07352 144677', 'GB')).toBe('+447352144677');
  });

  it('keeps international numbers and converts 00 prefixes', () => {
    expect(normalisePhone('+27 63 198 7864', 'ZW')).toBe('+27631987864');
    expect(normalisePhone('0044 7352 144677', 'ZW')).toBe('+447352144677');
  });

  it('rejects numbers it cannot resolve', () => {
    expect(normalisePhone('12345', 'ZW')).toBeNull();
    expect(normalisePhone('0771234567', 'OTHER')).toBeNull();
    expect(normalisePhone('not a number', 'ZW')).toBeNull();
  });
});

describe('checkSchema', () => {
  it('accepts a complete check and normalises it', () => {
    const result = checkSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('+263771234567');
      expect(result.data.email).toBeUndefined();
      expect(result.data.subscribe).toBe(false);
    }
  });

  it('requires at least one payment method', () => {
    const result = checkSchema.safeParse({ ...base, payments: [] });
    expect(result.success).toBe(false);
  });

  it('rejects unknown answer values', () => {
    expect(checkSchema.safeParse({ ...base, stage: 'unicorn' }).success).toBe(false);
  });

  it('requires an email when the visitor prefers email', () => {
    const result = checkSchema.safeParse({ ...base, contactPreference: 'email', email: '' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['email']);
  });

  it('reports an unusable phone number against the phone field', () => {
    const result = checkSchema.safeParse({ ...base, phone: '123' });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['phone']);
  });

  it('trims and validates email addresses', () => {
    expect(checkSchema.safeParse({ ...base, email: '  tariro@example.com ' }).success).toBe(true);
    expect(checkSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});

describe('scoreCheck', () => {
  it('scores a business with nothing in place very low', () => {
    const score = scoreCheck({ website: 'none', maps: 'no', brand: 'no', payments: ['cash'] });
    expect(score).toEqual({ found: 0, trusted: 0, paid: 5, overall: 2 });
  });

  it('scores a fully set-up business at the top', () => {
    const score = scoreCheck({
      website: 'good',
      maps: 'yes',
      brand: 'yes',
      payments: ['online', 'card', 'mobile-money', 'bank-transfer', 'cash'],
    });
    expect(score).toEqual({ found: 100, trusted: 100, paid: 100, overall: 100 });
  });

  it('counts each payment method once', () => {
    const once = scoreCheck({ website: 'none', maps: 'no', brand: 'no', payments: ['card'] });
    const twice = scoreCheck({ website: 'none', maps: 'no', brand: 'no', payments: ['card', 'card'] });
    expect(twice.paid).toBe(once.paid);
  });

  it('bands scores', () => {
    expect(band(0)).toBe('low');
    expect(band(39)).toBe('low');
    expect(band(40)).toBe('mid');
    expect(band(69)).toBe('mid');
    expect(band(70)).toBe('high');
  });
});

describe('recommend', () => {
  const low = { found: 10, trusted: 10, paid: 10, overall: 10 };

  it('recommends a Run plan for businesses already well set up', () => {
    const answers = { website: 'good', brand: 'yes', stage: 'established', priority: 'customers' } as const;
    expect(recommend(answers, { found: 100, trusted: 100, paid: 60, overall: 87 })).toBe('run');
  });

  it('recommends Complete for tender-focused businesses', () => {
    expect(recommend({ website: 'none', brand: 'partly', stage: 'young', priority: 'tenders' }, low)).toBe('complete');
  });

  it('recommends Complete for established businesses without a brand', () => {
    expect(recommend({ website: 'outdated', brand: 'no', stage: 'established', priority: 'customers' }, low)).toBe(
      'complete',
    );
  });

  it('recommends Pro when getting paid online is the priority', () => {
    expect(recommend({ website: 'none', brand: 'yes', stage: 'starting', priority: 'payments' }, low)).toBe('pro');
  });

  it("follows the business model's recommended package", () => {
    expect(
      recommend({ website: 'none', brand: 'yes', stage: 'starting', priority: 'customers' }, low, 'pro'),
    ).toBe('pro');
  });

  it('recommends Essentials for new businesses without a model preference', () => {
    expect(recommend({ website: 'none', brand: 'yes', stage: 'starting', priority: 'customers' }, low)).toBe(
      'essentials',
    );
  });
});

describe('result URLs', () => {
  it('round-trips scores and recommendation without personal data', () => {
    const path = resultPath({
      found: 20,
      trusted: 45,
      paid: 30,
      overall: 32,
      recommendation: 'pro',
      businessType: 'clinics-and-dental',
    });
    expect(path).not.toMatch(/Tariro|Bright|263/);
    const parsed = parseResultParams(new URL(path, 'https://www.kurongeka.com').searchParams);
    expect(parsed).toEqual({
      found: 20,
      trusted: 45,
      paid: 30,
      overall: 32,
      recommendation: 'pro',
      businessType: 'clinics-and-dental',
    });
  });

  it('rejects tampered parameters', () => {
    expect(parseResultParams(new URLSearchParams('s=150&f=1&t=1&p=1&r=pro'))).toBeNull();
    expect(parseResultParams(new URLSearchParams('s=10&f=1&t=1&p=1&r=free-money'))).toBeNull();
    expect(parseResultParams(new URLSearchParams('s=10&f=1&t=1&r=pro'))).toBeNull();
  });

  it('drops unsafe business type values', () => {
    const parsed = parseResultParams(new URLSearchParams('s=10&f=1&t=1&p=1&r=pro&b=<script>'));
    expect(parsed?.businessType).toBeNull();
  });
});
