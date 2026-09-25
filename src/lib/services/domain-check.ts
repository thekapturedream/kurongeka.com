import { domainCandidates, rdapUrl, statusFromRdap, type DomainResult } from '@/lib/domain/domains';
import { createCache } from './cache';

const cache = createCache<DomainResult>(10 * 60 * 1000);

async function lookup(domain: string): Promise<DomainResult> {
  const cached = cache.get(domain);
  if (cached) return cached;
  const url = rdapUrl(domain);
  if (!url) return { domain, status: 'unknown' };
  try {
    const response = await fetch(url, {
      headers: { Accept: 'application/rdap+json' },
      signal: AbortSignal.timeout(6000),
      redirect: 'follow',
    });
    const result: DomainResult = { domain, status: statusFromRdap(response.status) };
    // Drain the body so the connection can be reused.
    await response.arrayBuffer().catch(() => undefined);
    if (result.status !== 'unknown') cache.set(domain, result);
    return result;
  } catch {
    return { domain, status: 'unknown' };
  }
}

/** Looks up every candidate domain for a business name in the public registries. */
export async function checkDomains(name: string): Promise<DomainResult[]> {
  const domains = domainCandidates(name);
  return Promise.all(domains.map(lookup));
}
