import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { analysePage, type PageSnapshot, type WebsiteReport } from '@/lib/domain/website-check';
import { createCache } from './cache';

/**
 * Fetches a public web page for the website check, safely:
 * only http(s) on standard ports, only hosts that resolve to public addresses,
 * a capped number of redirects (each re-checked), a size limit and a time limit.
 */

const USER_AGENT = 'KurongekaWebsiteCheck/1.0 (+https://www.kurongeka.com/tools/website-check)';
const MAX_HTML_BYTES = 1_500_000;
const MAX_REDIRECTS = 5;
const PAGE_TIMEOUT_MS = 10_000;
const SIDE_TIMEOUT_MS = 5_000;

export type WebsiteCheckFailure = 'invalid' | 'blocked' | 'unreachable' | 'timeout' | 'not-html' | 'error-status';

export type WebsiteCheckResult = { ok: true; report: WebsiteReport } | { ok: false; reason: WebsiteCheckFailure; status?: number };

const reports = createCache<WebsiteReport>(15 * 60 * 1000, 200);

/** Turns what someone typed into a URL we are willing to fetch, or null. */
export function normaliseTarget(input: string): URL | null {
  const value = input.trim();
  if (!value || value.length > 2000) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== '80' && url.port !== '443') return null;
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  if (!host.includes('.') || host.length > 253) return null;
  if (isIP(host.replace(/^\[|\]$/g, ''))) return null;
  if (/(^|\.)(localhost|local|internal|intranet|home|lan|corp|test|invalid|example)$/.test(host)) return null;
  url.hash = '';
  return url;
}

function ipv4ToInt(ip: string): number {
  return ip.split('.').reduce((acc, part) => (acc << 8) + Number(part), 0) >>> 0;
}

const PRIVATE_V4: [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const value = ipv4ToInt(ip);
    return PRIVATE_V4.some(([base, bits]) => {
      const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
      return (value & mask) === (ipv4ToInt(base) & mask);
    });
  }
  const v6 = ip.toLowerCase();
  if (v6 === '::' || v6 === '::1') return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v6);
  if (mapped?.[1]) return isPrivateAddress(mapped[1]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(v6) || v6.startsWith('2001:db8') || v6.startsWith('64:ff9b');
}

async function isPublicHost(hostname: string): Promise<boolean> {
  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}

class CheckError extends Error {
  constructor(
    readonly reason: WebsiteCheckFailure,
    readonly status?: number,
  ) {
    super(reason);
  }
}

interface Fetched {
  url: URL;
  status: number;
  headers: Record<string, string>;
  body: string;
  bytes: number;
  ms: number;
}

async function readCapped(response: Response, maxBytes: number): Promise<{ body: string; bytes: number }> {
  if (!response.body) return { body: '', bytes: 0 };
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  while (bytes < maxBytes) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    chunks.push(value);
    bytes += value.byteLength;
  }
  await reader.cancel().catch(() => undefined);
  const merged = new Uint8Array(Math.min(bytes, maxBytes));
  let offset = 0;
  for (const chunk of chunks) {
    const slice = chunk.subarray(0, Math.min(chunk.byteLength, merged.byteLength - offset));
    merged.set(slice, offset);
    offset += slice.byteLength;
    if (offset >= merged.byteLength) break;
  }
  return { body: new TextDecoder('utf-8', { fatal: false }).decode(merged), bytes };
}

/** GET with manual, re-validated redirects. */
async function safeGet(start: URL, { maxBytes, timeoutMs }: { maxBytes: number; timeoutMs: number }): Promise<Fetched> {
  const signal = AbortSignal.timeout(timeoutMs);
  const started = performance.now();
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    if (!(await isPublicHost(url.hostname))) throw new CheckError('blocked');
    let response: Response;
    try {
      response = await fetch(url, {
        redirect: 'manual',
        signal,
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5' },
      });
    } catch (error) {
      const name = error instanceof Error ? error.name : '';
      throw new CheckError(name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable');
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel().catch(() => undefined);
      const next = normaliseTarget(new URL(location, url).toString());
      if (!next) throw new CheckError('blocked');
      url = next;
      continue;
    }
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });
    const { body, bytes } = await readCapped(response, maxBytes);
    return { url, status: response.status, headers, body, bytes, ms: performance.now() - started };
  }
  throw new CheckError('unreachable');
}

async function httpRedirectsToHttps(host: string): Promise<PageSnapshot['httpToHttps']> {
  try {
    if (!(await isPublicHost(host))) return 'unknown';
    const response = await fetch(`http://${host}/`, {
      redirect: 'manual',
      signal: AbortSignal.timeout(SIDE_TIMEOUT_MS),
      headers: { 'User-Agent': USER_AGENT },
    });
    await response.body?.cancel().catch(() => undefined);
    const location = response.headers.get('location') ?? '';
    if (response.status >= 300 && response.status < 400) {
      return location.startsWith('https://') ? 'redirects' : 'unknown';
    }
    return response.status < 300 ? 'no-redirect' : 'unknown';
  } catch {
    return 'unknown';
  }
}

async function robotsAndSitemap(origin: URL): Promise<{ robotsTxt: string | null; sitemapFound: boolean }> {
  let robotsTxt: string | null = null;
  try {
    const robots = await safeGet(new URL('/robots.txt', origin), { maxBytes: 64_000, timeoutMs: SIDE_TIMEOUT_MS });
    if (robots.status === 200 && !/<html/i.test(robots.body.slice(0, 500))) robotsTxt = robots.body;
  } catch {
    // Missing robots.txt is reported as a finding, not an error.
  }
  if (robotsTxt && /^\s*sitemap:\s*\S+/im.test(robotsTxt)) return { robotsTxt, sitemapFound: true };
  try {
    const sitemap = await safeGet(new URL('/sitemap.xml', origin), { maxBytes: 16_000, timeoutMs: SIDE_TIMEOUT_MS });
    return { robotsTxt, sitemapFound: sitemap.status === 200 && /<(urlset|sitemapindex)/i.test(sitemap.body) };
  } catch {
    return { robotsTxt, sitemapFound: false };
  }
}

export async function runWebsiteCheck(input: string): Promise<WebsiteCheckResult> {
  const target = normaliseTarget(input);
  if (!target) return { ok: false, reason: 'invalid' };

  const key = `${target.host}${target.pathname}`;
  const hit = reports.get(key);
  if (hit) return { ok: true, report: hit };

  try {
    const page = await safeGet(target, { maxBytes: MAX_HTML_BYTES, timeoutMs: PAGE_TIMEOUT_MS });
    if (page.status >= 400) return { ok: false, reason: 'error-status', status: page.status };
    const type = page.headers['content-type'] ?? '';
    if (type && !/html/i.test(type)) return { ok: false, reason: 'not-html' };

    const [httpToHttps, extras] = await Promise.all([
      page.url.protocol === 'https:' ? httpRedirectsToHttps(page.url.hostname) : Promise.resolve('no-redirect' as const),
      robotsAndSitemap(new URL(page.url.origin)),
    ]);

    const report = analysePage({
      requestedUrl: target.toString(),
      finalUrl: page.url.toString(),
      status: page.status,
      html: page.body,
      bytes: page.bytes,
      responseMs: page.ms,
      headers: page.headers,
      httpToHttps,
      robotsTxt: extras.robotsTxt,
      sitemapFound: extras.sitemapFound,
    });
    reports.set(key, report);
    return { ok: true, report };
  } catch (error) {
    if (error instanceof CheckError) return { ok: false, reason: error.reason, ...(error.status ? { status: error.status } : {}) };
    console.error('[website-check] failed', error instanceof Error ? error.message : error);
    return { ok: false, reason: 'unreachable' };
  }
}
