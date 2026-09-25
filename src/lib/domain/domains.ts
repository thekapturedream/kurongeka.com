/**
 * Business name to domain candidates, for the name and domain check tool.
 * Availability itself is looked up in the public registries (RDAP) by the service layer.
 */

export type DomainStatus = 'available' | 'taken' | 'unknown';

export interface DomainResult {
  domain: string;
  status: DomainStatus;
}

const COMPANY_SUFFIXES = /\b(ltd|limited|plc|llp|llc|inc|pvt|pty|co)\b\.?/g;

/** "Tendai's Hair & Beauty Ltd" -> "tendaishairandbeauty". Returns null when nothing usable is left. */
export function domainLabel(name: string): string | null {
  const label = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(COMPANY_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 63);
  return label.length >= 2 ? label : null;
}

/** Hyphenated form, offered when the words run together: "tendais-hair-and-beauty". */
export function hyphenatedLabel(name: string): string | null {
  const label = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’]/g, '')
    .replace(COMPANY_SUFFIXES, ' ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  return label.length >= 2 && label.includes('-') ? label : null;
}

export const TLDS = ['co.uk', 'com', 'uk', 'org', 'net'] as const;

/** The domains worth checking for a business name, most useful first. At most eight. */
export function domainCandidates(name: string): string[] {
  const label = domainLabel(name);
  if (!label) return [];
  const candidates = TLDS.map((tld) => `${label}.${tld}`);
  const hyphenated = hyphenatedLabel(name);
  if (hyphenated) candidates.push(`${hyphenated}.co.uk`);
  candidates.push(`${label}uk.com`, `get${label}.com`);
  return [...new Set(candidates)].slice(0, 8);
}

/** Public RDAP endpoints for the registries we check. */
export function rdapUrl(domain: string): string | null {
  const encoded = encodeURIComponent(domain);
  if (domain.endsWith('.com')) return `https://rdap.verisign.com/com/v1/domain/${encoded}`;
  if (domain.endsWith('.net')) return `https://rdap.verisign.com/net/v1/domain/${encoded}`;
  if (domain.endsWith('.org')) return `https://rdap.publicinterestregistry.org/rdap/domain/${encoded}`;
  if (domain.endsWith('.uk')) return `https://rdap.nominet.uk/uk/domain/${encoded}`;
  return null;
}

/** RDAP answers 404 for names no one has registered and 200 for registered ones. */
export function statusFromRdap(httpStatus: number): DomainStatus {
  if (httpStatus === 404) return 'available';
  if (httpStatus === 200) return 'taken';
  return 'unknown';
}
