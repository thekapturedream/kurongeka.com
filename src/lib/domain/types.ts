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
