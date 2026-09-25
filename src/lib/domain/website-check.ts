import { parse, type HTMLElement } from 'node-html-parser';

/**
 * The website check: turns one fetched page into plain-language findings,
 * grouped into Found (search), Trusted (credibility) and Fast (speed and mobile).
 * Pure analysis; fetching and safety checks live in the service layer.
 */

export type Pillar = 'found' | 'trusted' | 'fast';
export type CheckStatus = 'pass' | 'warn' | 'fail';

export interface SiteCheck {
  id: string;
  pillar: Pillar;
  title: string;
  status: CheckStatus;
  detail: string;
  fix?: string;
}

export interface PageSnapshot {
  requestedUrl: string;
  finalUrl: string;
  status: number;
  html: string;
  bytes: number;
  responseMs: number;
  /** Lower-cased header names. */
  headers: Record<string, string>;
  httpToHttps: 'redirects' | 'no-redirect' | 'unknown';
  robotsTxt: string | null;
  sitemapFound: boolean;
}

export interface PillarScores {
  found: number;
  trusted: number;
  fast: number;
  overall: number;
}

export interface WebsiteReport {
  url: string;
  host: string;
  checkedAt: string;
  pageTitle: string | null;
  platform: string | null;
  checks: SiteCheck[];
  score: PillarScores;
}

export const PILLAR_LABEL: Record<Pillar, string> = {
  found: 'Found',
  trusted: 'Trusted',
  fast: 'Fast',
};

export const PILLAR_SUMMARY: Record<Pillar, string> = {
  found: 'Can people find this page on Google?',
  trusted: 'Does it look safe and credible, and can customers reach you?',
  fast: 'Does it load quickly and work on phones?',
};

const SOCIAL_HOSTS: [RegExp, string][] = [
  [/(^|\.)instagram\.com$/, 'Instagram'],
  [/(^|\.)facebook\.com$|(^|\.)fb\.com$/, 'Facebook'],
  [/(^|\.)linkedin\.com$/, 'LinkedIn'],
  [/(^|\.)tiktok\.com$/, 'TikTok'],
  [/(^|\.)x\.com$|(^|\.)twitter\.com$/, 'X'],
  [/(^|\.)youtube\.com$|(^|\.)youtu\.be$/, 'YouTube'],
];

const BUSINESS_TYPES =
  /^(LocalBusiness|Organization|Corporation|Store|Restaurant|FoodEstablishment|ProfessionalService|MedicalBusiness|Dentist|Physician|HealthAndBeautyBusiness|BeautySalon|HairSalon|AutoRepair|HomeAndConstructionBusiness|LegalService|FinancialService|RealEstateAgent|TravelAgency|LodgingBusiness|Hotel|EducationalOrganization|School|SportsActivityLocation|EntertainmentBusiness|Church|PlaceOfWorship|NGO|OnlineStore|OnlineBusiness)$/;

function text(el: HTMLElement | null | undefined): string {
  return (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function meta(root: HTMLElement, key: string): string | null {
  for (const el of root.querySelectorAll('meta')) {
    const name = (el.getAttribute('name') ?? el.getAttribute('property') ?? '').toLowerCase();
    if (name === key) return (el.getAttribute('content') ?? '').trim();
  }
  return null;
}

function hrefs(root: HTMLElement): string[] {
  return root
    .querySelectorAll('a')
    .map((a) => (a.getAttribute('href') ?? '').trim())
    .filter(Boolean);
}

function hostOf(href: string, base: string): string | null {
  try {
    return new URL(href, base).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function jsonLdTypes(root: HTMLElement): string[] {
  const types = new Set<string>();
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    const type = record['@type'];
    if (typeof type === 'string') types.add(type);
    if (Array.isArray(type)) type.forEach((t) => typeof t === 'string' && types.add(t));
    if (record['@graph']) visit(record['@graph']);
  };
  for (const script of root.querySelectorAll('script')) {
    if ((script.getAttribute('type') ?? '').toLowerCase() !== 'application/ld+json') continue;
    try {
      visit(JSON.parse(script.textContent || 'null'));
    } catch {
      // Invalid JSON-LD is treated as absent.
    }
  }
  return [...types];
}

export function detectPlatform(html: string, generator: string | null): string | null {
  const g = (generator ?? '').toLowerCase();
  if (g.includes('wix') || /static\.parastorage\.com|static\.wixstatic\.com/.test(html)) return 'Wix';
  if (g.includes('wordpress') || html.includes('/wp-content/')) return 'WordPress';
  if (html.includes('cdn.shopify.com')) return 'Shopify';
  if (g.includes('squarespace') || html.includes('static1.squarespace.com')) return 'Squarespace';
  if (g.includes('webflow') || html.includes('data-wf-page')) return 'Webflow';
  if (html.includes('img1.wsimg.com')) return 'GoDaddy Website Builder';
  if (html.includes('framerusercontent.com')) return 'Framer';
  if (g.includes('astro')) return 'Astro';
  if (html.includes('/_next/')) return 'Next.js';
  return null;
}

const kb = (bytes: number) => `${Math.round(bytes / 1024)} KB`;

export function scoreChecks(checks: SiteCheck[]): PillarScores {
  const pillarScore = (pillar: Pillar) => {
    const items = checks.filter((c) => c.pillar === pillar);
    if (items.length === 0) return 100;
    const points = items.reduce((sum, c) => sum + (c.status === 'pass' ? 1 : c.status === 'warn' ? 0.5 : 0), 0);
    return Math.round((points / items.length) * 100);
  };
  const found = pillarScore('found');
  const trusted = pillarScore('trusted');
  const fast = pillarScore('fast');
  return { found, trusted, fast, overall: Math.round((found + trusted + fast) / 3) };
}

export function analysePage(snapshot: PageSnapshot, now: Date = new Date()): WebsiteReport {
  const root = parse(snapshot.html, { comment: false });
  const finalUrl = new URL(snapshot.finalUrl);
  const checks: SiteCheck[] = [];
  const add = (check: SiteCheck) => checks.push(check);

  // Found
  const title = text(root.querySelector('title')) || null;
  if (!title) {
    add({
      id: 'title',
      pillar: 'found',
      title: 'Page title',
      status: 'fail',
      detail: 'The page has no title, so Google has to guess what it is about.',
      fix: 'Add a title of 30 to 60 characters that says what you do and where, for example "Plumber in Leeds | Smith & Sons".',
    });
  } else {
    const good = title.length >= 10 && title.length <= 65;
    add({
      id: 'title',
      pillar: 'found',
      title: 'Page title',
      status: good ? 'pass' : 'warn',
      detail: `"${title.slice(0, 90)}${title.length > 90 ? '…' : ''}" (${title.length} characters).`,
      ...(good ? {} : { fix: 'Aim for 30 to 60 characters: what you do, where, and your name.' }),
    });
  }

  const description = meta(root, 'description');
  if (!description) {
    add({
      id: 'description',
      pillar: 'found',
      title: 'Search description',
      status: 'fail',
      detail: 'There is no meta description, so Google picks a random snippet from the page.',
      fix: 'Write one or two sentences (70 to 160 characters) that would make someone click.',
    });
  } else {
    const good = description.length >= 70 && description.length <= 160;
    add({
      id: 'description',
      pillar: 'found',
      title: 'Search description',
      status: good ? 'pass' : 'warn',
      detail: `${description.length} characters.`,
      ...(good ? {} : { fix: 'Keep it between 70 and 160 characters so it shows in full on Google.' }),
    });
  }

  const h1s = root.querySelectorAll('h1');
  add({
    id: 'h1',
    pillar: 'found',
    title: 'Main heading',
    status: h1s.length === 1 ? 'pass' : h1s.length === 0 ? 'fail' : 'warn',
    detail:
      h1s.length === 0
        ? 'The page has no main (H1) heading.'
        : h1s.length === 1
          ? `"${text(h1s[0]).slice(0, 80)}"`
          : `The page has ${h1s.length} main (H1) headings.`,
    ...(h1s.length === 1 ? {} : { fix: 'Use exactly one H1 that states what the business does.' }),
  });

  const robotsMeta = (meta(root, 'robots') ?? '').toLowerCase();
  const robotsHeader = (snapshot.headers['x-robots-tag'] ?? '').toLowerCase();
  const noindex = robotsMeta.includes('noindex') || robotsHeader.includes('noindex');
  add({
    id: 'indexable',
    pillar: 'found',
    title: 'Visible to search engines',
    status: noindex ? 'fail' : 'pass',
    detail: noindex ? 'This page tells search engines not to list it (noindex).' : 'Search engines are allowed to list this page.',
    ...(noindex ? { fix: 'Remove the noindex setting, unless the page should stay hidden.' } : {}),
  });

  add({
    id: 'sitemap',
    pillar: 'found',
    title: 'Sitemap',
    status: snapshot.sitemapFound ? 'pass' : 'warn',
    detail: snapshot.sitemapFound ? 'A sitemap is published for search engines.' : 'No sitemap was found.',
    ...(snapshot.sitemapFound ? {} : { fix: 'Publish a sitemap and submit it in Google Search Console.' }),
  });

  const types = jsonLdTypes(root);
  const businessType = types.find((t) => BUSINESS_TYPES.test(t));
  add({
    id: 'structured-data',
    pillar: 'found',
    title: 'Business details for Google',
    status: businessType ? 'pass' : types.length ? 'warn' : 'fail',
    detail: businessType
      ? `Structured data describes the business (${businessType}).`
      : types.length
        ? `Structured data found (${types.slice(0, 3).join(', ')}), but none describes the business.`
        : 'No structured data, so Google cannot read your opening hours, address or reviews reliably.',
    ...(businessType ? {} : { fix: 'Add LocalBusiness structured data with your name, address, phone and hours.' }),
  });

  const images = root.querySelectorAll('img');
  const missingAlt = images.filter((img) => img.getAttribute('alt') === undefined).length;
  const altShare = images.length ? missingAlt / images.length : 0;
  add({
    id: 'image-alt',
    pillar: 'found',
    title: 'Image descriptions',
    status: missingAlt === 0 ? 'pass' : altShare <= 0.2 ? 'warn' : 'fail',
    detail:
      images.length === 0
        ? 'No images on this page.'
        : missingAlt === 0
          ? `All ${images.length} images have descriptions.`
          : `${missingAlt} of ${images.length} images have no description (alt text).`,
    ...(missingAlt === 0 ? {} : { fix: 'Describe each meaningful image. It helps search and people using screen readers.' }),
  });

  // Trusted
  const https = finalUrl.protocol === 'https:';
  add({
    id: 'https',
    pillar: 'trusted',
    title: 'Secure connection',
    status: https ? 'pass' : 'fail',
    detail: https ? 'The page loads over HTTPS.' : 'The page loads without HTTPS, so browsers mark it "Not secure".',
    ...(https ? {} : { fix: 'Turn on HTTPS (an SSL certificate). Most hosts include it for free.' }),
  });

  if (snapshot.httpToHttps !== 'unknown') {
    const redirects = snapshot.httpToHttps === 'redirects';
    add({
      id: 'https-redirect',
      pillar: 'trusted',
      title: 'Secure by default',
      status: redirects ? 'pass' : 'warn',
      detail: redirects
        ? 'Visitors who type the address without https are moved to the secure version.'
        : 'Visitors who type the address without https stay on an insecure version.',
      ...(redirects ? {} : { fix: 'Redirect every http address to https.' }),
    });
  }

  const ogTitle = meta(root, 'og:title');
  const ogImage = meta(root, 'og:image');
  const og = [ogTitle, ogImage].filter(Boolean).length;
  add({
    id: 'social-preview',
    pillar: 'trusted',
    title: 'Link preview',
    status: og === 2 ? 'pass' : og === 1 ? 'warn' : 'fail',
    detail:
      og === 2
        ? 'Shared links show a title and image on WhatsApp and social media.'
        : og === 1
          ? 'Shared links show a partial preview.'
          : 'Shared links on WhatsApp and social media show no image or proper title.',
    ...(og === 2 ? {} : { fix: 'Add Open Graph tags (og:title and og:image) so shared links look professional.' }),
  });

  const hasIcon = root
    .querySelectorAll('link')
    .some((l) => /(^|\s)(icon|shortcut icon|apple-touch-icon)(\s|$)/i.test(l.getAttribute('rel') ?? ''));
  add({
    id: 'favicon',
    pillar: 'trusted',
    title: 'Browser icon',
    status: hasIcon ? 'pass' : 'warn',
    detail: hasIcon ? 'The site has its own browser tab icon.' : 'No browser tab icon was found.',
    ...(hasIcon ? {} : { fix: 'Add a favicon based on your logo.' }),
  });

  const links = hrefs(root);
  const hasPhone = links.some((h) => h.toLowerCase().startsWith('tel:'));
  const hasWhatsapp = links.some((h) => /(^|\/\/)(wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com)/i.test(h));
  const hasEmail = links.some((h) => h.toLowerCase().startsWith('mailto:'));
  const tapOptions = [hasPhone && 'call', hasWhatsapp && 'WhatsApp', hasEmail && 'email'].filter(Boolean) as string[];
  add({
    id: 'contact',
    pillar: 'trusted',
    title: 'One-tap contact',
    status: hasPhone || hasWhatsapp ? 'pass' : hasEmail ? 'warn' : 'fail',
    detail: tapOptions.length
      ? `Customers can ${tapOptions.join(', ')} you in one tap.`
      : 'There is no tap-to-call, WhatsApp or email link on this page.',
    ...(hasPhone || hasWhatsapp ? {} : { fix: 'Add tap-to-call and WhatsApp buttons. Most small-business enquiries start on a phone.' }),
  });

  const socials = new Set<string>();
  for (const href of links) {
    const host = hostOf(href, snapshot.finalUrl);
    if (!host) continue;
    for (const [pattern, label] of SOCIAL_HOSTS) if (pattern.test(host)) socials.add(label);
  }
  add({
    id: 'social-links',
    pillar: 'trusted',
    title: 'Social profiles',
    status: socials.size ? 'pass' : 'warn',
    detail: socials.size ? `Links to ${[...socials].join(', ')}.` : 'No links to social media profiles.',
    ...(socials.size ? {} : { fix: 'Link to the profiles you keep active. They reassure new customers.' }),
  });

  const hasMaps =
    links.some((h) => /google\.[a-z.]+\/maps|maps\.google\.|goo\.gl\/maps|maps\.app\.goo\.gl|g\.page\//i.test(h)) ||
    root.querySelectorAll('iframe').some((f) => /google\.[a-z.]+\/maps/i.test(f.getAttribute('src') ?? ''));
  add({
    id: 'maps',
    pillar: 'trusted',
    title: 'Google Maps',
    status: hasMaps ? 'pass' : 'warn',
    detail: hasMaps ? 'The page links to your location on Google Maps.' : 'No link to a Google Maps location.',
    ...(hasMaps ? {} : { fix: 'Link to your Google Business Profile so people can find you and read reviews.' }),
  });

  const bodyText = text(root.querySelector('body'));
  const years = [...bodyText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(\d{4})/gi)].map((m) => Number(m[1]));
  if (years.length) {
    const latest = Math.max(...years);
    const stale = latest < now.getUTCFullYear() - 1;
    add({
      id: 'fresh',
      pillar: 'trusted',
      title: 'Looks up to date',
      status: stale ? 'warn' : 'pass',
      detail: stale ? `The footer still says ${latest}.` : `The footer says ${latest}.`,
      ...(stale ? { fix: 'Update the copyright year and any old offers. Stale details make people wonder if you still trade.' } : {}),
    });
  }

  // Fast
  const viewport = (meta(root, 'viewport') ?? '').toLowerCase();
  const mobile = viewport.includes('width=device-width');
  add({
    id: 'mobile',
    pillar: 'fast',
    title: 'Works on phones',
    status: mobile ? 'pass' : 'fail',
    detail: mobile ? 'The page is set up for mobile screens.' : 'The page is not set up for mobile screens, so phones show a shrunken desktop page.',
    ...(mobile ? {} : { fix: 'Use a responsive design with a mobile viewport.' }),
  });

  const ms = Math.round(snapshot.responseMs);
  add({
    id: 'response-time',
    pillar: 'fast',
    title: 'Server response',
    status: ms < 800 ? 'pass' : ms < 1800 ? 'warn' : 'fail',
    detail: `The page took ${(ms / 1000).toFixed(1)} seconds to arrive at our checker.`,
    ...(ms < 800 ? {} : { fix: 'Use faster hosting and caching. Every extra second loses visitors, especially on mobile data.' }),
  });

  add({
    id: 'page-weight',
    pillar: 'fast',
    title: 'Page size',
    status: snapshot.bytes < 150 * 1024 ? 'pass' : snapshot.bytes < 400 * 1024 ? 'warn' : 'fail',
    detail: `The page's HTML is ${kb(snapshot.bytes)}, before images and scripts.`,
    ...(snapshot.bytes < 150 * 1024 ? {} : { fix: 'Remove unused code and page-builder bloat so the page starts faster.' }),
  });

  const encoding = (snapshot.headers['content-encoding'] ?? '').toLowerCase();
  const compressed = /br|gzip|zstd|deflate/.test(encoding);
  add({
    id: 'compression',
    pillar: 'fast',
    title: 'Compression',
    status: compressed ? 'pass' : 'warn',
    detail: compressed ? `The server compresses pages (${encoding}).` : 'The server sends pages uncompressed.',
    ...(compressed ? {} : { fix: 'Turn on gzip or Brotli compression on your host.' }),
  });

  const scripts = root.querySelectorAll('script').filter((s) => s.getAttribute('src')).length;
  add({
    id: 'scripts',
    pillar: 'fast',
    title: 'Scripts',
    status: scripts <= 15 ? 'pass' : scripts <= 30 ? 'warn' : 'fail',
    detail: `The page loads ${scripts} external ${scripts === 1 ? 'script' : 'scripts'}.`,
    ...(scripts <= 15 ? {} : { fix: 'Remove plugins and trackers you do not use. Each one slows the page.' }),
  });

  return {
    url: snapshot.finalUrl,
    host: finalUrl.hostname.replace(/^www\./, ''),
    checkedAt: now.toISOString(),
    pageTitle: title,
    platform: detectPlatform(snapshot.html, meta(root, 'generator')),
    checks,
    score: scoreChecks(checks),
  };
}
