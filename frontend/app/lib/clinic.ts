import clinicData from '../../../content/clinic.json';

/**
 * Typed, display-ready view of content/clinic.json — the single source of truth for clinic
 * facts. Nothing here is invented: every value comes from the legacy site, the clinic's
 * Google Business Profile, or a client decision recorded in docs/BUILD_PLAN.md.
 */
export const clinic = clinicData.clinic;

export const CLINIC_NAME = clinic.name;

export const phones = clinic.contact.phones.map((phone) => ({
  display: phone.display,
  href: `tel:${phone.e164}`,
}));

/** The number used for click-to-call and WhatsApp on the legacy site and Google profile. */
export const primaryPhone = {
  display: '+91 96570 61122',
  href: 'tel:+919657061122',
};

export const email = clinic.contact.email;

const WHATSAPP_NUMBER = clinic.contact.whatsapp.replace('+', '');

export function whatsappLink(message: string): string {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

export const googleRating = {
  rating: clinic.googleRating.rating,
  count: clinic.googleRating.reviewCount,
  href: clinic.social.googleBusinessProfile,
};

export const social = [
  { label: 'Facebook', href: clinic.social.facebook },
  { label: 'YouTube', href: clinic.social.youtube },
  { label: 'X (Twitter)', href: clinic.social.twitter },
] as const;

export interface Branch {
  id: string;
  shortName: string;
  name: string;
  address: string;
  directionsHref: string;
}

export const branches: Branch[] = clinicData.locations.map((location) => ({
  id: location.id,
  shortName: location.id === 'mapusa' ? 'Duler, Mapusa' : 'Candolim',
  name: location.name,
  address: ('addressOnGoogle' in location && location.addressOnGoogle) || location.addressOnWebsite,
  directionsHref: `https://www.google.com/maps/search/?api=1&query=${location.geo.lat},${location.geo.lng}&query_place_id=${location.googlePlaceId}`,
}));

export const testimonials = clinicData.testimonials.map((testimonial) => ({
  quote: testimonial.quote,
  name: testimonial.name,
  location: testimonial.location,
}));
