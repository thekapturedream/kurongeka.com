import type { BusinessModel, DirectoryListing, Faq, LaunchPackage, RunPlan } from '@/lib/domain/types';
import {
  fetchBusinessModels,
  fetchDirectoryListings,
  fetchFaqs,
  fetchLaunchPackages,
} from '@/lib/wix/cms';
import { fetchRunPlans } from '@/lib/wix/plans';
import { cached } from './cache';

/** A read that can fail without taking the page down. Pages render an error state when `ok` is false. */
export type Loaded<T> = { ok: true; data: T } | { ok: false; data: T };

const TTL = 60_000;

async function load<T>(key: string, fallback: T, fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await cached(key, TTL, fn) };
  } catch (error) {
    console.error(`[wix] ${key} failed`, error instanceof Error ? error.message : error);
    return { ok: false, data: fallback };
  }
}

export const getLaunchPackages = () => load<LaunchPackage[]>('launch-packages', [], fetchLaunchPackages);
export const getBusinessModels = () => load<BusinessModel[]>('business-models', [], fetchBusinessModels);
export const getFaqs = () => load<Faq[]>('faqs', [], fetchFaqs);
export const getRunPlans = () => load<RunPlan[]>('run-plans', [], fetchRunPlans);
export const getDirectoryListings = () => load<DirectoryListing[]>('directory', [], fetchDirectoryListings);

export async function getBusinessModel(slug: string): Promise<Loaded<BusinessModel | null>> {
  const models = await getBusinessModels();
  return { ok: models.ok, data: models.data.find((m) => m.slug === slug) ?? null };
}

export async function getDirectoryListing(slug: string): Promise<Loaded<DirectoryListing | null>> {
  const listings = await getDirectoryListings();
  return { ok: listings.ok, data: listings.data.find((l) => l.slug === slug) ?? null };
}
