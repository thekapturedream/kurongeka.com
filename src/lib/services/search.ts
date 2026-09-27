import { tools } from '@/config/tools';
import type { SearchEntry } from '@/lib/domain/search';
import { buildSearchIndex } from '@/lib/domain/search-index';
import { getBusinessModels, getRunPlans, getSolutions, type Loaded } from './catalog';

/** Everything the finder can find, built from Wix content plus the tools and key pages. */
export async function getSearchIndex(): Promise<Loaded<SearchEntry[]>> {
  const [solutions, models, runPlans] = await Promise.all([getSolutions(), getBusinessModels(), getRunPlans()]);
  const data = buildSearchIndex({ solutions: solutions.data, models: models.data, tools, runPlans: runPlans.data });
  return { ok: solutions.ok && models.ok && runPlans.ok, data };
}
