import { describe, expect, it } from 'vitest';
import { contrastRatio, derivePalette, gradeFor, normaliseHex, paletteChecks, PRESETS, textOn } from '@/lib/domain/colour';
import { domainCandidates, domainLabel, rdapUrl, statusFromRdap } from '@/lib/domain/domains';
import { escapeHtml, signatureHtml, signatureText } from '@/lib/domain/signature';
import { analysePage, detectPlatform, scoreChecks, type PageSnapshot } from '@/lib/domain/website-check';
import { isPrivateAddress, normaliseTarget } from '@/lib/services/website-check';

describe('colour', () => {
  it('parses short and long hex codes', () => {
    expect(normaliseHex('#fc0')).toBe('#FFCC00');
    expect(normaliseHex('1d6b45')).toBe('#1D6B45');
    expect(normaliseHex('not a colour')).toBeNull();
  });

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
  });

  it('grades ratios against WCAG thresholds', () => {
    expect(gradeFor(7.2)).toBe('AAA');
    expect(gradeFor(4.6)).toBe('AA');
    expect(gradeFor(3.2)).toBe('Large text only');
    expect(gradeFor(2)).toBe('Fails');
  });

  it('derives a readable palette from one brand colour', () => {
    const palette = derivePalette('#1D6B45');
    expect(palette).not.toBeNull();
    const checks = paletteChecks(palette!);
    expect(checks[0]!.use).toContain('Body text');
    expect(checks[0]!.ratio).toBeGreaterThan(12);
    expect(checks[1]!.ratio).toBeGreaterThanOrEqual(4.5);
  });

  it('picks the more readable text colour for a fill', () => {
    expect(textOn('#FFCC00', '#0A0E0F')).toBe('#0A0E0F');
    expect(textOn('#1D6B45', '#0A0E0F')).toBe('#FFFFFF');
  });

  it('keeps the ten presets from the original portal', () => {
    expect(PRESETS).toHaveLength(10);
    expect(PRESETS.every((p) => normaliseHex(p.accent))).toBe(true);
  });
});

describe('domains', () => {
  it('turns business names into domain labels', () => {
    expect(domainLabel("Tendai's Hair & Beauty Ltd")).toBe('tendaishairandbeauty');
    expect(domainLabel('Café Zuva')).toBe('cafezuva');
    expect(domainLabel('!!')).toBeNull();
  });

  it('suggests UK-first candidates without duplicates', () => {
    const candidates = domainCandidates('Smith & Sons');
    expect(candidates[0]).toBe('smithandsons.co.uk');
    expect(candidates).toContain('smithandsons.com');
    expect(candidates).toContain('smith-and-sons.co.uk');
    expect(new Set(candidates).size).toBe(candidates.length);
    expect(candidates.length).toBeLessThanOrEqual(8);
  });

  it('knows which registry answers for each ending', () => {
    expect(rdapUrl('a.co.uk')).toContain('rdap.nominet.uk');
    expect(rdapUrl('a.com')).toContain('verisign.com/com');
    expect(rdapUrl('a.org')).toContain('publicinterestregistry');
    expect(rdapUrl('a.io')).toBeNull();
    expect(statusFromRdap(404)).toBe('available');
    expect(statusFromRdap(200)).toBe('taken');
    expect(statusFromRdap(429)).toBe('unknown');
  });
});

describe('email signature', () => {
  const input = {
    name: 'Tendai <Moyo>',
    role: 'Owner',
    business: "Tendai's Kitchen",
    phone: '+44 7700 900123',
    email: 'hello@example.co.uk',
    website: 'www.example.co.uk',
    accent: '#1d6b45',
  };

  it('escapes what people type', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
    const html = signatureHtml(input);
    expect(html).toContain('Tendai &lt;Moyo&gt;');
    expect(html).not.toContain('<Moyo>');
  });

  it('builds links and uses the brand colour', () => {
    const html = signatureHtml(input);
    expect(html).toContain('href="tel:+447700900123"');
    expect(html).toContain('href="mailto:hello@example.co.uk"');
    expect(html).toContain('>example.co.uk<');
    expect(html).toContain('#1D6B45');
  });

  it('has a plain-text version', () => {
    expect(signatureText(input).split('\n')).toHaveLength(3);
  });
});

function snapshot(html: string, overrides: Partial<PageSnapshot> = {}): PageSnapshot {
  return {
    requestedUrl: 'https://example.co.uk/',
    finalUrl: 'https://example.co.uk/',
    status: 200,
    html,
    bytes: html.length,
    responseMs: 300,
    headers: { 'content-encoding': 'br' },
    httpToHttps: 'redirects',
    robotsTxt: 'Sitemap: https://example.co.uk/sitemap.xml',
    sitemapFound: true,
    ...overrides,
  };
}

const GOOD_PAGE = `<!doctype html><html lang="en-GB"><head>
<title>Plumber in Leeds | Smith and Sons Plumbing</title>
<meta name="description" content="Emergency and planned plumbing across Leeds. Fixed prices, Gas Safe engineers, and same-day callouts.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta property="og:title" content="Smith and Sons"><meta property="og:image" content="https://example.co.uk/og.png">
<link rel="icon" href="/favicon.ico"><link rel="canonical" href="https://example.co.uk/">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber"}</script>
<script type="application/ld+json">{"@graph":[{"@type":"LocalBusiness"}]}</script>
</head><body><h1>Plumbers in Leeds</h1><img src="a.jpg" alt="Van">
<a href="tel:+441130000000">Call</a><a href="https://wa.me/441130000000">WhatsApp</a>
<a href="https://www.instagram.com/smithandsons">Instagram</a><a href="https://maps.app.goo.gl/abc">Find us</a>
<footer>© 2026 Smith and Sons</footer></body></html>`;

describe('website check analysis', () => {
  it('passes a well set-up page', () => {
    const report = analysePage(snapshot(GOOD_PAGE), new Date('2026-09-25T12:00:00Z'));
    const failing = report.checks.filter((c) => c.status !== 'pass').map((c) => c.id);
    expect(failing).toEqual([]);
    expect(report.score.overall).toBe(100);
    expect(report.pageTitle).toBe('Plumber in Leeds | Smith and Sons Plumbing');
  });

  it('flags the common small-business problems with fixes', () => {
    const html = '<html><head><meta name="robots" content="noindex"></head><body><img src="a.jpg"><p>© 2019</p></body></html>';
    const report = analysePage(
      snapshot(html, { finalUrl: 'http://example.co.uk/', httpToHttps: 'no-redirect', sitemapFound: false, headers: {} }),
      new Date('2026-09-25T12:00:00Z'),
    );
    const byId = Object.fromEntries(report.checks.map((c) => [c.id, c]));
    expect(byId['title']?.status).toBe('fail');
    expect(byId['indexable']?.status).toBe('fail');
    expect(byId['https']?.status).toBe('fail');
    expect(byId['mobile']?.status).toBe('fail');
    expect(byId['contact']?.status).toBe('fail');
    expect(byId['fresh']?.status).toBe('warn');
    expect(byId['image-alt']?.status).toBe('fail');
    expect(report.checks.filter((c) => c.status !== 'pass').every((c) => c.fix)).toBe(true);
    expect(report.score.overall).toBeLessThan(40);
  });

  it('scores each pillar out of 100', () => {
    const score = scoreChecks([
      { id: 'a', pillar: 'found', title: 'A', status: 'pass', detail: '' },
      { id: 'b', pillar: 'found', title: 'B', status: 'warn', detail: '' },
      { id: 'c', pillar: 'trusted', title: 'C', status: 'fail', detail: '' },
    ]);
    expect(score.found).toBe(75);
    expect(score.trusted).toBe(0);
    expect(score.fast).toBe(100);
  });

  it('recognises common site builders', () => {
    expect(detectPlatform('<img src="https://static.wixstatic.com/x.png">', null)).toBe('Wix');
    expect(detectPlatform('<link href="/wp-content/themes/x.css">', null)).toBe('WordPress');
    expect(detectPlatform('<p>plain</p>', null)).toBeNull();
  });
});

describe('website check safety', () => {
  it('only accepts public web addresses', () => {
    expect(normaliseTarget('example.co.uk')?.toString()).toBe('https://example.co.uk/');
    expect(normaliseTarget('http://example.com/page#top')?.toString()).toBe('http://example.com/page');
    expect(normaliseTarget('localhost:3000')).toBeNull();
    expect(normaliseTarget('http://169.254.169.254/latest')).toBeNull();
    expect(normaliseTarget('ftp://example.com')).toBeNull();
    expect(normaliseTarget('https://user:pass@example.com')).toBeNull();
    expect(normaliseTarget('https://example.com:8080')).toBeNull();
    expect(normaliseTarget('printer.local')).toBeNull();
  });

  it('recognises private and reserved addresses', () => {
    for (const ip of ['10.1.2.3', '127.0.0.1', '169.254.169.254', '172.20.0.1', '192.168.1.1', '100.64.0.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '151.101.1.69', '2606:4700::6810:84e5']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });
});
