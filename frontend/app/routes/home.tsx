import clinic from '../../../content/clinic.json';
import type { Route } from './+types/home';

const phones = clinic.clinic.contact.phones;
const whatsapp = clinic.clinic.contact.whatsapp.replace('+', '');

export function meta(_: Route.MetaArgs) {
  return [
    { title: `${clinic.clinic.name} — Mapusa & Candolim, Goa` },
    { name: 'description', content: 'Dental clinic in Duler, Mapusa and Candolim, Goa.' },
  ];
}

/**
 * Pre-launch holding page with real contact details from content/clinic.json.
 * Phase 2 replaces it with the app shell; Phase 3 with the full home page.
 */
export default function Home() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:py-24">
      <img
        src="/images/original/logo.png"
        alt={clinic.clinic.name}
        width={250}
        height={88}
        className="rounded-lg"
      />
      <h1 className="mt-10 text-4xl font-bold tracking-tight sm:text-5xl">{clinic.clinic.name}</h1>
      <p className="mt-4 text-lg text-muted">Our new website is on its way.</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <a
          href={`tel:${phones[1]?.e164 ?? phones[0]?.e164}`}
          className="inline-flex min-h-11 items-center rounded-lg bg-brand px-5 font-semibold text-brand-contrast"
        >
          Call us
        </a>
        <a
          href={`https://wa.me/${whatsapp}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-border px-5 font-semibold"
        >
          WhatsApp us
        </a>
      </div>

      <section className="mt-12 grid gap-6 sm:grid-cols-2" aria-label="Our clinics">
        {clinic.locations.map((location) => (
          <article key={location.id} className="rounded-xl bg-surface p-6">
            <h2 className="text-lg font-semibold">{location.name}</h2>
            <p className="mt-2 text-muted">
              {'addressOnGoogle' in location ? location.addressOnGoogle : location.addressOnWebsite}
            </p>
            <a
              className="mt-3 inline-block text-link underline"
              href={`https://www.google.com/maps/search/?api=1&query=${location.geo.lat},${location.geo.lng}&query_place_id=${location.googlePlaceId}`}
            >
              Get directions
            </a>
          </article>
        ))}
      </section>

      <p className="mt-12 text-sm text-muted">
        {phones.map((phone) => phone.display).join(' · ')} · {clinic.clinic.contact.email}
      </p>
    </main>
  );
}
