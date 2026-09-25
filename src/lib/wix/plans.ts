import type { RunPlan } from '@/lib/domain/types';
import { wixRead } from './client';

const PERIOD_LABEL: Record<string, string> = { DAY: 'day', WEEK: 'week', MONTH: 'month', YEAR: 'year' };

/** Monthly "Run" plans, managed in Wix Dashboard > Pricing Plans. */
export async function fetchRunPlans(): Promise<RunPlan[]> {
  const result = await wixRead().plansV3.queryPlans().eq('visibility', 'PUBLIC').limit(50).find();
  return result.items
    .map((plan): RunPlan | null => {
      // `archived` is returned by the API but missing from the SDK's Plan type.
      const archived = (plan as { archived?: boolean }).archived === true;
      if (!plan._id || !plan.name || archived || !plan.currency) return null;
      const variant = plan.pricingVariants?.find((v) => v.visible !== false) ?? plan.pricingVariants?.[0];
      const price = Number(variant?.pricingStrategies?.[0]?.flatRate?.amount);
      if (!Number.isFinite(price)) return null;
      const cycle = variant?.billingTerms?.billingCycle;
      const period = cycle?.period ? PERIOD_LABEL[cycle.period] : undefined;
      const count = Number(cycle?.count ?? 1);
      return {
        id: plan._id,
        slug: plan.slug ?? plan._id,
        name: plan.name,
        description: plan.description ?? '',
        perks: (plan.perks ?? []).map((perk) => perk.description ?? '').filter(Boolean),
        price,
        currency: plan.currency,
        interval: period ? (count > 1 ? `${count} ${period}s` : period) : 'one-off',
      };
    })
    .filter((plan): plan is RunPlan => plan !== null)
    .sort((a, b) => a.price - b.price);
}
