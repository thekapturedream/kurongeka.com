import { site } from '@/config/site';
import { CURRENCY } from '@/lib/domain/format';
import type { BusinessModel, Faq, LaunchPackage } from '@/lib/domain/types';

type JsonLd = Record<string, unknown>;

export const ORG_ID = `${site.url}/#organization`;

export function organizationLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: site.name,
    url: site.url,
    logo: `${site.url}/icon-512.png`,
    description: site.description,
    email: site.contact.email,
    telephone: `+${site.contact.whatsapp}`,
    address: { '@type': 'PostalAddress', addressCountry: 'GB' },
    areaServed: ['GB', 'ZW', 'ZA'],
    parentOrganization: { '@type': 'Organization', name: site.parent.name, url: site.parent.url },
    sameAs: site.social.map((s) => s.url),
  };
}

export function websiteLd(): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${site.url}/#website`,
    url: site.url,
    name: site.name,
    publisher: { '@id': ORG_ID },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: new URL(item.path, site.url).toString(),
    })),
  };
}

export function faqLd(faqs: Faq[]): JsonLd | null {
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: { '@type': 'Answer', text: faq.answer },
    })),
  };
}

function offer(pkg: LaunchPackage): JsonLd[] {
  return pkg.price !== null ? [{ '@type': 'Offer', price: pkg.price, priceCurrency: CURRENCY }] : [];
}

export function launchServicesLd(packages: LaunchPackage[]): JsonLd[] {
  return packages.map((pkg) => ({
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: `Kurongeka Launch ${pkg.title}`,
    description: pkg.bestFor || pkg.tagline,
    provider: { '@id': ORG_ID },
    serviceType: 'Small business website and brand launch',
    offers: offer(pkg),
  }));
}

export function businessModelLd(model: BusinessModel, path: string): JsonLd {
  return {
    '@context': 'https://schema.org',
    '@type': 'Service',
    name: model.seoTitle || model.title,
    description: model.seoDescription || model.summary,
    url: new URL(path, site.url).toString(),
    provider: { '@id': ORG_ID },
    audience: model.idealFor.length
      ? { '@type': 'BusinessAudience', audienceType: model.idealFor.join(', ') }
      : undefined,
    ...(model.recommendedPackage ? { offers: offer(model.recommendedPackage) } : {}),
  };
}
