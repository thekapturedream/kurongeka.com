import { describeCallSlot, topicLabel, type Enquiry } from '@/lib/domain/enquiry';
import { submitEnquiryForm } from '@/lib/wix/forms';

/** Records an enquiry in Wix Forms, which notifies staff and creates or updates the CRM contact. */
export async function submitEnquiry(enquiry: Enquiry): Promise<void> {
  await submitEnquiryForm({
    first_name: enquiry.name,
    email: enquiry.email,
    phone: enquiry.phone,
    company: enquiry.company,
    topic: topicLabel(enquiry.topic),
    message: enquiry.message,
    website: enquiry.website,
    preferred_time: enquiry.topic === 'call' ? describeCallSlot(enquiry.callDay, enquiry.callWindow) : undefined,
    details: enquiry.details,
    source_page: enquiry.sourcePage,
    subscribe: enquiry.subscribe === true,
  });
}
