/** Domain types shared by services and UI. Independent of Wix field naming quirks. */

export interface LaunchPackage {
  id: string;
  slug: string;
  title: string;
  tagline: string;
  /** One-off price in GBP (see CURRENCY). */
  price: number | null;
  deliveryDays: number | null;
  includes: string[];
  bestFor: string;
  highlighted: boolean;
}

export interface BusinessModel {
  id: string;
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  idealFor: string[];
  customerActions: string[];
  wixSolutions: string[];
  launchDays: number | null;
  recommendedPackage: LaunchPackage | null;
  imageUrl: string | null;
  demoUrl: string | null;
  seoTitle: string;
  seoDescription: string;
}

/** Icons a solution can use. Staff pick one in the Wix CMS; unknown values fall back to the first. */
export const SOLUTION_ICONS = ['globe', 'pen', 'calendar', 'card', 'bag', 'pin', 'at', 'file', 'refresh'] as const;
export type SolutionIcon = (typeof SOLUTION_ICONS)[number];

/**
 * Something a visitor comes looking for ("a website", "online bookings"), mapped to what we sell.
 * `launch` solutions are priced by their cheapest launch package; `run` solutions by the Run plans.
 */
export interface Solution {
  id: string;
  slug: string;
  title: string;
  summary: string;
  intro: string;
  includes: string[];
  keywords: string[];
  icon: SolutionIcon;
  offer: 'launch' | 'run';
  fromPackage: LaunchPackage | null;
  relatedTool: string | null;
  seoTitle: string;
  seoDescription: string;
}

export interface Faq {
  id: string;
  question: string;
  answer: string;
  topic: string;
}

export interface RunPlan {
  id: string;
  slug: string;
  name: string;
  description: string;
  perks: string[];
  price: number;
  currency: string;
  /** e.g. "month" */
  interval: string;
}

export interface DirectoryListing {
  id: string;
  slug: string;
  businessName: string;
  category: string;
  city: string;
  country: string;
  summary: string;
  website: string | null;
  whatsapp: string | null;
  logoUrl: string | null;
  coverImageUrl: string | null;
  businessModelTitle: string | null;
  verified: boolean;
}
