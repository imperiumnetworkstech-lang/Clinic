import { ExternalLink, PenLine, Quote, Star } from 'lucide-react';
import clinicData from '../../../content/clinic.json';
import { PageHeader } from '../components/PageHeader';
import { ButtonLink } from '../components/ui/Button';
import { googleRating, testimonials } from '../lib/clinic';
import { pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Patient Reviews | Expressions Dental Clinic, Goa',
    description: `What patients say about Expressions Dental Clinic. Rated ${googleRating.rating} from ${googleRating.count} Google reviews for our Duler (Mapusa) clinic.`,
    path: '/reviews',
  });
}

const WRITE_REVIEW = `https://search.google.com/local/writereview?placeid=${clinicData.locations[0]?.googlePlaceId}`;

/** Themes Google shows most often in the clinic's reviews (read 2026-11-03). */
const THEMES = [
  'Pain-free experience',
  'At-home atmosphere',
  'Reasonable fees',
  'Explanation of options',
];

function Stars() {
  return (
    <span className="flex text-amber-400" aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={18} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

export default function Reviews() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Reviews', path: '/reviews' }]}
        title="What our patients say"
        intro="Kind words from local families and visitors from abroad. Read every review on Google."
      >
        <div className="mt-6 flex flex-wrap items-center gap-4">
          <a
            href={googleRating.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-2xl bg-white px-5 py-3 ring-1 ring-neutral-200 transition hover:ring-neutral-300"
          >
            <span className="font-display text-4xl font-bold">{googleRating.rating}</span>
            <span>
              <Stars />
              <span className="mt-0.5 flex items-center gap-1 text-sm text-muted">
                {googleRating.count} Google reviews · Duler clinic
                <ExternalLink size={14} aria-hidden="true" />
              </span>
            </span>
          </a>
          <ButtonLink href={WRITE_REVIEW} external variant="secondary">
            <PenLine size={18} className="text-primary-600" />
            Write a review
          </ButtonLink>
        </div>
      </PageHeader>

      <section className={`${container} py-12 md:py-16`}>
        <h2 className="text-xl font-bold">Mentioned most often on Google</h2>
        <ul className="mt-4 flex flex-wrap gap-2">
          {THEMES.map((theme) => (
            <li
              key={theme}
              className="rounded-full bg-primary-50 px-4 py-2 font-semibold text-primary-700"
            >
              {theme}
            </li>
          ))}
        </ul>

        <h2 className="mt-12 text-xl font-bold">Patient stories</h2>
        <ul className="mt-6 grid gap-5 md:grid-cols-2">
          {testimonials.map((testimonial) => (
            <li
              key={testimonial.name}
              className="flex flex-col rounded-3xl bg-white p-7 ring-1 ring-neutral-200/80 sm:p-8"
            >
              <Quote size={28} className="text-primary-200" fill="currentColor" strokeWidth={0} />
              <blockquote className="mt-4 flex-1 text-[1.05rem] leading-relaxed text-neutral-800">
                {testimonial.quote}
              </blockquote>
              <p className="mt-6">
                <span className="block font-semibold">{testimonial.name}</span>
                <span className="block text-sm text-muted">{testimonial.location}</span>
              </p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Testimonials are shared by patients and published as received.
        </p>
      </section>
    </>
  );
}
