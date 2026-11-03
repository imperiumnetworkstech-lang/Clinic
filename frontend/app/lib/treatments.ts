import treatmentData from '../../../content/treatments.json';

export type CategoryId = 'general-treatments' | 'advanced-treatments' | 'cosmetic-treatments';

export interface Treatment {
  slug: string;
  name: string;
  category: CategoryId;
  legacySlug: string;
  metaTitle: string;
  metaDescription: string;
  summary: string;
  whoFor: string[];
  steps: Array<{ title: string; text: string }>;
  aftercare: string[];
  faqs: Array<{ q: string; a: string }>;
  related: string[];
}

export const treatments = treatmentData.treatments as Treatment[];

/** Medical copy written for the new site; must be approved by a clinic dentist before launch. */
export const TREATMENT_CONTENT_STATUS = treatmentData.reviewStatus;

const bySlug = new Map(treatments.map((treatment) => [treatment.slug, treatment]));

export function getTreatment(slug: string | undefined): Treatment | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

export const treatmentHref = (slug: string) => `/treatments/${slug}`;

export const CATEGORIES: Record<CategoryId, { title: string; blurb: string; slug: string }> = {
  'general-treatments': {
    title: 'General dentistry',
    slug: 'general',
    blurb: 'Check-ups, cleaning, fillings and root canals: everyday care that keeps teeth healthy.',
  },
  'advanced-treatments': {
    title: 'Advanced treatments',
    slug: 'advanced',
    blurb: 'Implants, gum surgery, braces and impacted teeth, handled by experienced doctors.',
  },
  'cosmetic-treatments': {
    title: 'Cosmetic dentistry',
    slug: 'cosmetic',
    blurb: 'Smile design, veneers, whitening and natural-looking ceramic crowns.',
  },
};

export const treatmentCategories = (Object.keys(CATEGORIES) as CategoryId[]).map((id) => ({
  id,
  ...CATEGORIES[id],
  treatments: treatments.filter((treatment) => treatment.category === id),
}));

export const treatmentCount = treatments.length;

/** "What is the visit for?" choices on the booking form. */
export const VISIT_REASONS = [
  { value: 'checkup', label: 'Check-up & cleaning' },
  { value: 'tooth-pain', label: 'Tooth pain / emergency' },
  { value: 'not-sure', label: 'Not sure, need advice' },
];

export function reasonLabel(value: string): string {
  return (
    VISIT_REASONS.find((reason) => reason.value === value)?.label ??
    getTreatment(value)?.name ??
    value
  );
}
