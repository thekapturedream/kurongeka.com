import { WIX_CHECK_FORM_ID, WIX_ENQUIRY_FORM_ID } from 'astro:env/server';
import { wixLeadClient } from './client';

/**
 * Field targets on the "Kurongeka Check" Wix form (Wix Dashboard > Forms & Submissions).
 * Contact-mapped fields (name, company, phone, email, subscribe) create or update a Wix CRM contact.
 */
export interface CheckFormFields {
  first_name: string;
  company: string;
  phone: string;
  email?: string;
  country: string;
  business_type: string;
  stage: string;
  website_status: string;
  google_maps: string;
  payments: string;
  brand_status: string;
  priority: string;
  score: string;
  recommendation: string;
  contact_preference: string;
  subscribe: boolean;
}

export async function submitCheckForm(fields: CheckFormFields): Promise<{ submissionId: string | null }> {
  const values: Record<string, string | boolean> = { ...fields };
  if (!fields.email) delete values['email'];
  const submission = await wixLeadClient().submissions.createSubmission({
    formId: WIX_CHECK_FORM_ID,
    submissions: values,
  });
  return { submissionId: submission._id ?? null };
}

/**
 * Field targets on the "Kurongeka enquiry" Wix form. One form for calls, questions, website fixes,
 * directory applications and launch briefs; `topic` tells staff which is which.
 */
export interface EnquiryFormFields {
  first_name: string;
  email: string;
  phone?: string | undefined;
  company?: string | undefined;
  topic: string;
  message?: string | undefined;
  website?: string | undefined;
  preferred_time?: string | undefined;
  details?: string | undefined;
  source_page?: string | undefined;
  subscribe: boolean;
}

export async function submitEnquiryForm(fields: EnquiryFormFields): Promise<{ submissionId: string | null }> {
  const values: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== '') values[key] = value;
  }
  const submission = await wixLeadClient().submissions.createSubmission({
    formId: WIX_ENQUIRY_FORM_ID,
    submissions: values,
  });
  return { submissionId: submission._id ?? null };
}
