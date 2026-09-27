/**
 * Site search for the finder: "a website for my salon" should land on the website solution and the
 * salons business type. Pure and dependency-free so the same code runs on the server (/find) and in
 * the browser (instant suggestions).
 */

export type SearchKind = 'solution' | 'business-type' | 'tool' | 'page';

export interface SearchEntry {
  kind: SearchKind;
  title: string;
  summary: string;
  href: string;
  keywords: string[];
  /** Short extra line, such as a starting price. */
  meta?: string;
  /** Icon name for solutions. */
  icon?: string;
}

export interface SearchResult extends SearchEntry {
  score: number;
}

export const KIND_LABEL: Record<SearchKind, string> = {
  solution: 'Solution',
  'business-type': 'Business type',
  tool: 'Free tool',
  page: 'Page',
};

const KIND_ORDER: Record<SearchKind, number> = { solution: 0, 'business-type': 1, tool: 2, page: 3 };

const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'can', 'do', 'for', 'get', 'help', 'how', 'i', 'im', 'in', 'is', 'it', 'me', 'my', 'need',
  'of', 'on', 'or', 'our', 'set', 'some', 'the', 'to', 'up', 'want', 'we', 'with', 'you', 'your', 'business', 'new',
]);

export function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9.]+/g, ' ')
    .replace(/(^|\s)\.+|\.+(\s|$)/g, ' ')
    .trim();
}

/** Light stemming so "bookings" finds "booking" and "salons" finds "salon". */
export function stem(word: string): string {
  if (word.length > 4 && word.endsWith('ies')) return `${word.slice(0, -3)}y`;
  if (word.length > 3 && word.endsWith('s') && !word.endsWith('ss')) return word.slice(0, -1);
  return word;
}

export function terms(text: string): string[] {
  return normalise(text)
    .split(' ')
    .filter((w) => w && !STOPWORDS.has(w))
    .map(stem);
}

/** True when two words are at most one edit apart (insert, delete, substitute or swap neighbours). */
export function withinOneEdit(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  if (a.length === b.length) {
    const diffs: number[] = [];
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diffs.push(i);
    if (diffs.length === 1) return true;
    const [i, j] = diffs;
    return diffs.length === 2 && i !== undefined && j === i + 1 && a[i] === b[j] && a[j] === b[i];
  }
  const [short, long] = a.length < b.length ? [a, b] : [b, a];
  let i = 0;
  let j = 0;
  let skipped = false;
  while (i < short.length && j < long.length) {
    if (short[i] === long[j]) {
      i++;
      j++;
    } else if (skipped) {
      return false;
    } else {
      skipped = true;
      j++;
    }
  }
  return true;
}

interface Prepared {
  entry: SearchEntry;
  title: string[];
  keywords: string[];
  phrases: string[];
  summary: string[];
}

function prepare(entry: SearchEntry): Prepared {
  return {
    entry,
    title: terms(entry.title),
    keywords: entry.keywords.flatMap(terms),
    phrases: [entry.title, ...entry.keywords].map((k) => terms(k).join(' ')).filter(Boolean),
    summary: terms(entry.summary),
  };
}

function termScore(term: string, p: Prepared): number {
  const exact = (list: string[]) => list.includes(term);
  const prefix = (list: string[]) => term.length >= 2 && list.some((w) => w.startsWith(term));
  const typo = (list: string[]) => term.length >= 5 && list.some((w) => w.length >= 5 && withinOneEdit(term, w));

  if (exact(p.title)) return 6;
  if (exact(p.keywords)) return 5;
  if (prefix(p.title)) return 4;
  if (prefix(p.keywords)) return 3;
  if (typo(p.title) || typo(p.keywords)) return 3;
  if (exact(p.summary)) return 2;
  if (term.length >= 3 && prefix(p.summary)) return 1;
  return 0;
}

const preparedCache = new WeakMap<readonly SearchEntry[], Prepared[]>();

export function search(entries: readonly SearchEntry[], query: string, limit = 8): SearchResult[] {
  const queryTerms = terms(query);
  if (queryTerms.length === 0) return [];
  let prepared = preparedCache.get(entries);
  if (!prepared) {
    prepared = entries.map(prepare);
    preparedCache.set(entries, prepared);
  }
  const phrase = queryTerms.join(' ');

  const results: SearchResult[] = [];
  for (const p of prepared) {
    let score = 0;
    let matched = 0;
    for (const term of queryTerms) {
      const s = termScore(term, p);
      score += s;
      if (s > 0) matched++;
    }
    if (matched === 0) continue;
    if (queryTerms.length > 1 && p.phrases.some((k) => k.includes(phrase))) score += 4;
    // Entries that answer more of the query rank above ones that match a single word strongly.
    score += (matched / queryTerms.length) * 3;
    results.push({ ...p.entry, score });
  }

  return results
    .sort((a, b) => b.score - a.score || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title))
    .slice(0, limit);
}
