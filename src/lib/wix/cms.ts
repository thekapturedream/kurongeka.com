import type { BusinessModel, DirectoryListing, Faq, LaunchPackage } from '@/lib/domain/types';
import { wixRead } from './client';
import { imageUrl } from './media';

/** Collection IDs on the kurongeka.com Wix site. Managed in Wix Dashboard > CMS. */
export const COLLECTIONS = {
  launchPackages: 'LaunchPackages',
  businessModels: 'BusinessModels',
  faqs: 'Faqs',
  directory: 'DirectoryListings',
} as const;

type RawItem = Record<string, unknown> & { _id: string };

interface QueryOptions {
  filter?: Record<string, unknown>;
  sortBy?: string;
  limit?: number;
  includeReferences?: string[];
}

async function queryItems(collectionId: string, options: QueryOptions = {}): Promise<RawItem[]> {
  const response = await wixRead().items.query(
    collectionId,
    {
      filter: { isPublished: true, ...options.filter },
      sort: [{ fieldName: options.sortBy ?? 'sortOrder', order: 'ASC' }],
      paging: { limit: options.limit ?? 100 },
    },
    options.includeReferences ? { includeReferences: options.includeReferences.map((field) => ({ field })) } : undefined,
  );
  return (response.items ?? []) as RawItem[];
}

const str = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');
const num = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const list = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && v.trim().length > 0) : [];
const url = (value: unknown): string | null => {
  const s = str(value);
  return /^https?:\/\//.test(s) ? s : null;
};

function toLaunchPackage(item: RawItem): LaunchPackage {
  return {
    id: item._id,
    slug: str(item['slug']),
    title: str(item['title']),
    tagline: str(item['tagline']),
    price: num(item['priceGbp']),
    deliveryDays: num(item['deliveryDays']),
    includes: list(item['includes']),
    bestFor: str(item['bestFor']),
    highlighted: item['highlighted'] === true,
  };
}

function toBusinessModel(item: RawItem): BusinessModel {
  const pkg = item['recommendedPackage'];
  return {
    id: item._id,
    slug: str(item['slug']),
    title: str(item['title']),
    category: str(item['category']),
    summary: str(item['summary']),
    body: str(item['body']),
    idealFor: list(item['idealFor']),
    customerActions: list(item['customerActions']),
    wixSolutions: list(item['wixSolutions']),
    launchDays: num(item['launchDays']),
    recommendedPackage: pkg && typeof pkg === 'object' && '_id' in pkg ? toLaunchPackage(pkg as RawItem) : null,
    imageUrl: imageUrl(item['image'], 1200, 800),
    demoUrl: url(item['demoUrl']),
    seoTitle: str(item['seoTitle']),
    seoDescription: str(item['seoDescription']),
  };
}

function toFaq(item: RawItem): Faq {
  return { id: item._id, question: str(item['question']), answer: str(item['answer']), topic: str(item['topic']) };
}

function toDirectoryListing(item: RawItem): DirectoryListing {
  const model = item['businessModel'];
  return {
    id: item._id,
    slug: str(item['slug']),
    businessName: str(item['businessName']),
    category: str(item['category']),
    city: str(item['city']),
    country: str(item['country']),
    summary: str(item['summary']),
    website: url(item['website']),
    whatsapp: /^\+?\d{8,15}$/.test(str(item['whatsapp'])) ? str(item['whatsapp']).replace(/^\+/, '') : null,
    logoUrl: imageUrl(item['logo'], 240, 240),
    coverImageUrl: imageUrl(item['coverImage'], 1200, 800),
    businessModelTitle: model && typeof model === 'object' ? str((model as RawItem)['title']) || null : null,
    verified: item['verified'] === true,
  };
}

export async function fetchLaunchPackages(): Promise<LaunchPackage[]> {
  return (await queryItems(COLLECTIONS.launchPackages)).map(toLaunchPackage).filter((p) => p.slug && p.title);
}

export async function fetchBusinessModels(): Promise<BusinessModel[]> {
  const items = await queryItems(COLLECTIONS.businessModels, { includeReferences: ['recommendedPackage'] });
  return items.map(toBusinessModel).filter((m) => m.slug && m.title);
}

export async function fetchFaqs(): Promise<Faq[]> {
  return (await queryItems(COLLECTIONS.faqs)).map(toFaq).filter((f) => f.question && f.answer);
}

/** Only listings the owner has consented to, and staff have published. */
export async function fetchDirectoryListings(): Promise<DirectoryListing[]> {
  const items = await queryItems(COLLECTIONS.directory, {
    filter: { consentConfirmed: true },
    sortBy: 'businessName',
    includeReferences: ['businessModel'],
  });
  return items.map(toDirectoryListing).filter((l) => l.slug && l.businessName);
}
