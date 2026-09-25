import { describe, expect, it } from 'vitest';
import { callDays, describeCallSlot, enquirySchema } from '@/lib/domain/enquiry';
import { briefSchema, parseStatus, signUpSchema, stageIndex } from '@/lib/domain/projects';
import { safeNextPath } from '@/lib/http';

describe('enquiries', () => {
  const base = { topic: 'call', name: 'Tendai Moyo', email: ' Tendai@Example.co.uk ', phone: '07700 900123', callWindow: 'morning' };

  it('accepts a call request and normalises contact details', () => {
    const result = enquirySchema.safeParse(base);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.email).toBe('tendai@example.co.uk');
    expect(result.data.phone).toBe('+447700900123');
    expect(result.data.subscribe).toBe(false);
  });

  it('needs a phone number and time of day for a call', () => {
    expect(enquirySchema.safeParse({ ...base, phone: '' }).success).toBe(false);
    expect(enquirySchema.safeParse({ ...base, callWindow: '' }).success).toBe(false);
  });

  it('needs a message for a question, not a phone number', () => {
    expect(enquirySchema.safeParse({ topic: 'question', name: 'A', email: 'a@b.co' }).success).toBe(false);
    expect(enquirySchema.safeParse({ topic: 'question', name: 'A', email: 'a@b.co', message: 'Hi' }).success).toBe(true);
  });

  it('normalises websites and rejects nonsense', () => {
    const ok = enquirySchema.safeParse({ topic: 'website-check', name: 'A', email: 'a@b.co', website: 'example.co.uk' });
    expect(ok.success && ok.data.website).toBe('https://example.co.uk/');
    expect(enquirySchema.safeParse({ topic: 'website-check', name: 'A', email: 'a@b.co', website: 'nope' }).success).toBe(false);
  });

  it('offers working days only, in UK time', () => {
    const days = callDays(new Date('2026-09-25T10:00:00Z'), 5);
    expect(days.map((d) => d.value)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02']);
    expect(days[0]?.label).toBe('Monday 28 September');
  });

  it('describes the chosen slot for staff', () => {
    expect(describeCallSlot('2026-09-29', 'afternoon')).toBe('Tuesday 29 September, afternoon (UK time)');
    expect(describeCallSlot('any', 'morning')).toBe('Any working day, morning (UK time)');
  });
});

describe('projects', () => {
  it('reads the status staff type in Wix, forgivingly', () => {
    expect(parseStatus('In Progress')).toBe('in_progress');
    expect(parseStatus('review')).toBe('review');
    expect(parseStatus('on-hold')).toBe('on_hold');
    expect(parseStatus('')).toBe('brief_received');
    expect(stageIndex('live')).toBe(3);
  });

  it('validates a launch brief', () => {
    const brief = {
      title: 'Zuva Bakery',
      packageSlug: 'pro',
      businessType: 'restaurant',
      location: 'Leeds',
      goals: 'Take orders online',
      assetsReady: ['logo'],
      contactPhone: '07700 900123',
    };
    const ok = briefSchema.safeParse(brief);
    expect(ok.success && ok.data.contactPhone).toBe('+447700900123');
    expect(briefSchema.safeParse({ ...brief, packageSlug: 'gold' }).success).toBe(false);
    expect(briefSchema.safeParse({ ...brief, assetsReady: ['yacht'] }).success).toBe(false);
  });

  it('asks for a reasonable password', () => {
    const user = { firstName: 'Tendai', email: 'a@b.co' };
    expect(signUpSchema.safeParse({ ...user, password: 'short1' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...user, password: 'onlyletters' }).success).toBe(false);
    expect(signUpSchema.safeParse({ ...user, password: 'letters-and-1' }).success).toBe(true);
  });
});

describe('post-login redirects', () => {
  it('only allows same-site paths', () => {
    expect(safeNextPath('/account/brief')).toBe('/account/brief');
    expect(safeNextPath('https://evil.example/')).toBe('/account');
    expect(safeNextPath('//evil.example')).toBe('/account');
    expect(safeNextPath('/\\evil.example')).toBe('/account');
    expect(safeNextPath(null, '/x')).toBe('/x');
  });
});
