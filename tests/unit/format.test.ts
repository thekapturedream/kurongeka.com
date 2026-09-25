import { describe, expect, it } from 'vitest';
import { CURRENCY, formatMoney, formatPrice, paragraphs, workingDays } from '@/lib/domain/format';
import { allowRequest } from '@/lib/services/rate-limit';

describe('formatMoney', () => {
  it('formats whole amounts without decimals and with natural symbols', () => {
    expect(formatMoney(1290, 'USD')).toBe('$1,290');
    expect(formatMoney(990, 'GBP')).toBe('£990');
  });

  it('keeps pence when the amount has them', () => {
    expect(formatMoney(49.5, 'USD')).toBe('$49.50');
  });
});

describe('formatPrice', () => {
  it('prices everything in pounds sterling', () => {
    expect(CURRENCY).toBe('GBP');
    expect(formatPrice(990)).toBe('£990');
    expect(formatPrice(1650)).toBe('£1,650');
  });
});

describe('workingDays', () => {
  it('pluralises', () => {
    expect(workingDays(1)).toBe('1 working day');
    expect(workingDays(14)).toBe('14 working days');
    expect(workingDays(null)).toBeNull();
  });
});

describe('paragraphs', () => {
  it('splits CMS text on blank lines and drops empties', () => {
    expect(paragraphs('One.\n\nTwo.\n\n\n  \nThree.')).toEqual(['One.', 'Two.', 'Three.']);
  });
});

describe('allowRequest', () => {
  it('allows a burst up to the limit, then blocks until the window passes', () => {
    const start = 1_000_000;
    for (let i = 0; i < 6; i++) expect(allowRequest('203.0.113.9', start + i)).toBe(true);
    expect(allowRequest('203.0.113.9', start + 10)).toBe(false);
    expect(allowRequest('203.0.113.9', start + 11 * 60 * 1000)).toBe(true);
  });
});
