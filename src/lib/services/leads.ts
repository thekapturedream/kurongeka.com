import {
  BRAND_STATUS,
  CONTACT_PREFERENCES,
  COUNTRIES,
  MAPS_STATUS,
  OTHER_BUSINESS_TYPE,
  PAYMENT_METHODS,
  PRIORITIES,
  STAGES,
  WEBSITE_STATUS,
  labelFor,
  recommend,
  scoreCheck,
  type CheckAnswers,
  type CheckScore,
  type Recommendation,
} from '@/lib/domain/check';
import { submitCheckForm } from '@/lib/wix/forms';
import { getBusinessModels } from './catalog';

const RECOMMENDATION_LABEL: Record<Recommendation, string> = {
  essentials: 'Launch Essentials',
  pro: 'Launch Pro',
  complete: 'Launch Complete',
  run: 'Run plan',
};

export interface CheckOutcome {
  score: CheckScore;
  recommendation: Recommendation;
  businessType: string | null;
}

/** Scores a validated check and records it in Wix Forms (which also creates the CRM contact). */
export async function submitCheck(answers: CheckAnswers): Promise<CheckOutcome> {
  const models = await getBusinessModels();
  const model = models.data.find((m) => m.slug === answers.businessType) ?? null;
  const score = scoreCheck(answers);
  const recommendation = recommend(answers, score, model?.recommendedPackage?.slug);

  await submitCheckForm({
    first_name: answers.name,
    company: answers.business,
    phone: answers.phone,
    ...(answers.email ? { email: answers.email } : {}),
    country: COUNTRIES.find((c) => c.value === answers.country)?.label ?? answers.country,
    business_type: model?.title ?? (answers.businessType === OTHER_BUSINESS_TYPE ? 'Something else' : answers.businessType),
    stage: labelFor(STAGES, answers.stage),
    website_status: labelFor(WEBSITE_STATUS, answers.website),
    google_maps: labelFor(MAPS_STATUS, answers.maps),
    payments: answers.payments.map((p) => labelFor(PAYMENT_METHODS, p)).join(', '),
    brand_status: labelFor(BRAND_STATUS, answers.brand),
    priority: labelFor(PRIORITIES, answers.priority),
    score: `${score.overall}/100 (Found ${score.found}, Trusted ${score.trusted}, Paid ${score.paid})`,
    recommendation:
      answers.interest && answers.interest !== recommendation
        ? `${RECOMMENDATION_LABEL[recommendation]} (was viewing ${RECOMMENDATION_LABEL[answers.interest]})`
        : RECOMMENDATION_LABEL[recommendation],
    contact_preference: labelFor(CONTACT_PREFERENCES, answers.contactPreference),
    subscribe: answers.subscribe,
  });

  return { score, recommendation, businessType: model?.slug ?? null };
}
