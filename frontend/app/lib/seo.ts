import clinicData from '../../../content/clinic.json';
import { DAYS, weeklyHours } from './hours';

/**
 * Canonical site URL. Set VITE_SITE_URL per environment; defaults to the clinic's domain so
 * canonicals never point at temporary preview URLs.
 */
export const SITE_URL = (
  import.meta.env.VITE_SITE_URL || 'https://expressionsdentalclinic.com'
).replace(/\/+$/, '');

/** Search engines may index only when this is explicitly switched on at launch. */
export const SITE_INDEXABLE = import.meta.env.VITE_SITE_INDEXABLE === 'true';

export const absoluteUrl = (path: string) => `${SITE_URL}${path === '/' ? '' : path}`;

const DEFAULT_IMAGE = '/images/opt/about-img-800.webp';

interface PageMeta {
  title: string;
  description: string;
  path: string;
  image?: string;
  noindex?: boolean;
}

/** Title, description, canonical, Open Graph and Twitter tags for a page. */
export function pageMeta({ title, description, path, image = DEFAULT_IMAGE, noindex }: PageMeta) {
  const url = absoluteUrl(path);
  const imageUrl = image.startsWith('http') ? image : absoluteUrl(image);
  return [
    { title },
    { name: 'description', content: description },
    { tagName: 'link', rel: 'canonical', href: url },
    { property: 'og:type', content: 'website' },
    { property: 'og:site_name', content: clinicData.clinic.name },
    { property: 'og:locale', content: 'en_IN' },
    { property: 'og:title', content: title },
    { property: 'og:description', content: description },
    { property: 'og:url', content: url },
    { property: 'og:image', content: imageUrl },
    { name: 'twitter:card', content: 'summary_large_image' },
    { name: 'twitter:title', content: title },
    { name: 'twitter:description', content: description },
    { name: 'twitter:image', content: imageUrl },
    { name: 'robots', content: noindex || !SITE_INDEXABLE ? 'noindex, nofollow' : 'index, follow' },
  ];
}

/* ------------------------------------------------------------------ JSON-LD builders */

const ORG_ID = `${SITE_URL}/#organization`;

const DAY_SCHEMA: Record<(typeof DAYS)[number], string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
};

const sameAs = [
  clinicData.clinic.social.facebook,
  clinicData.clinic.social.youtube,
  clinicData.clinic.social.twitter,
];

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': ORG_ID,
    name: clinicData.clinic.name,
    url: SITE_URL,
    logo: absoluteUrl('/images/brand/mark-512.png'),
    email: clinicData.clinic.contact.email,
    telephone: clinicData.clinic.contact.phones.map((phone) => phone.e164),
    sameAs,
  };
}

/**
 * One Dentist entity per branch. Ratings are deliberately absent: Google disallows
 * self-serving review markup and we never publish an AggregateRating.
 */
export function dentistSchemas() {
  return clinicData.locations.map((location) => {
    const hours = weeklyHours(location.id);
    const address =
      ('addressOnGoogle' in location && location.addressOnGoogle) || location.addressOnWebsite;
    return {
      '@context': 'https://schema.org',
      '@type': 'Dentist',
      '@id': `${SITE_URL}/#${location.id}`,
      name: location.name,
      parentOrganization: { '@id': ORG_ID },
      url: absoluteUrl('/contact'),
      image: absoluteUrl('/images/opt/photo-42-900.webp'),
      telephone: location.phone,
      address: {
        '@type': 'PostalAddress',
        streetAddress: address,
        addressLocality: location.locality,
        addressRegion: location.region,
        ...(location.postalCode && !location.postalCode.startsWith('[[')
          ? { postalCode: location.postalCode }
          : {}),
        addressCountry: location.country,
      },
      geo: { '@type': 'GeoCoordinates', latitude: location.geo.lat, longitude: location.geo.lng },
      hasMap: `https://www.google.com/maps/search/?api=1&query_place_id=${location.googlePlaceId}&query=${location.geo.lat},${location.geo.lng}`,
      ...(hours
        ? {
            openingHoursSpecification: DAYS.flatMap((day) =>
              hours[day].map((interval) => ({
                '@type': 'OpeningHoursSpecification',
                dayOfWeek: DAY_SCHEMA[day],
                opens: interval.open,
                closes: interval.close,
              })),
            ),
          }
        : {}),
    };
  });
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    name: clinicData.clinic.name,
    url: SITE_URL,
    publisher: { '@id': ORG_ID },
    inLanguage: 'en-IN',
  };
}

export function breadcrumbSchema(items: Array<{ name: string; path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqSchema(faqs: Array<{ q: string; a: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: { '@type': 'Answer', text: faq.a },
    })),
  };
}

export function procedureSchema(treatment: { name: string; summary: string; slug: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'MedicalProcedure',
    name: treatment.name,
    description: treatment.summary,
    url: absoluteUrl(`/treatments/${treatment.slug}`),
    provider: { '@id': ORG_ID },
  };
}
