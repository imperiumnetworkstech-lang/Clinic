import {
  ArrowRight,
  BadgeIndianRupee,
  HeartHandshake,
  House,
  MapPin,
  MessageCircleQuestion,
  Navigation,
  Phone,
  Quote,
  Star,
} from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '../components/icons';
import { Picture, type ImageName } from '../components/Picture';
import { HeroSlider } from '../components/HeroSlider';
import { TreatmentMarquee } from '../components/TreatmentMarquee';
import { TreatmentCategoryGrid } from '../components/TreatmentCategoryGrid';
import { JsonLd } from '../components/JsonLd';
import { SectionHeading } from '../components/ui/primitives';
import {
  branches,
  CLINIC_NAME,
  googleRating,
  primaryPhone,
  testimonials,
  whatsappLink,
} from '../lib/clinic';
import { revealDelay } from '../lib/reveal';
import { dentistSchemas, organizationSchema, pageMeta, websiteSchema } from '../lib/seo';
import { useScrollReveal } from '../lib/useScrollReveal';
import { button, container } from '../lib/ui';
import type { Route } from './+types/home';

export function meta(_: Route.MetaArgs) {
  return pageMeta({
    title: `${CLINIC_NAME} | Dentist in Mapusa & Candolim, Goa`,
    description:
      'Family, advanced and cosmetic dentistry at our clinics in Duler (Mapusa) and Candolim, Goa. Book online, on WhatsApp or call +91 96570 61122.',
    path: '/',
  });
}

function Stars({ className = '' }: { className?: string }) {
  return (
    <span className={`flex text-amber-400 ${className}`} aria-hidden="true">
      {Array.from({ length: 5 }, (_, i) => (
        <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
      ))}
    </span>
  );
}

/* ---------------------------------------------------------------- review themes */

const THEMES: Array<{ icon: ComponentType<{ size?: number }>; title: string; text: string }> = [
  {
    icon: HeartHandshake,
    title: 'Pain-free experience',
    text: 'Patients often say their treatment was far more comfortable than they expected.',
  },
  {
    icon: MessageCircleQuestion,
    title: 'Options explained clearly',
    text: 'Reviewers mention that we explain the root cause and the options before treating.',
  },
  {
    icon: House,
    title: 'An at-home atmosphere',
    text: 'Long-time patients describe a friendly clinic and courteous, well-behaved staff.',
  },
  {
    icon: BadgeIndianRupee,
    title: 'Reasonable fees',
    text: 'Patients, including visitors from abroad, describe our fees as fair and reasonable.',
  },
];

function ReviewThemes() {
  return (
    <section aria-labelledby="why-title" className="bg-surface py-20 md:py-28">
      <div className={container}>
        <div data-reveal>
          <SectionHeading
            id="why-title"
            kicker="Why patients choose us"
            title="What people mention most in their reviews"
            intro="These are the themes that come up again and again in our Google reviews."
          />
        </div>
        <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {THEMES.map(({ icon: Icon, title, text }, index) => (
            <li
              key={title}
              data-reveal
              style={revealDelay(index)}
              className="group rounded-3xl bg-white p-7 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgb(31_36_43/0.3)] shadow-[0_1px_2px_rgb(31_36_43/0.04),0_12px_32px_-20px_rgb(31_36_43/0.25)] ring-1 ring-neutral-200/70"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary-50 text-primary-600 transition duration-300 group-hover:-rotate-6 group-hover:scale-110 group-hover:bg-primary-600 group-hover:text-white">
                <Icon size={24} />
              </span>
              <h3 className="mt-5 text-lg font-bold">{title}</h3>
              <p className="mt-2 text-[0.975rem] text-muted">{text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- treatments */

function Treatments() {
  return (
    <section id="treatments" aria-labelledby="treatments-title" className="py-20 md:py-28">
      <div className={container}>
        <div data-reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="treatments-title"
            kicker="Treatments"
            title="Complete dental care under one roof"
            intro="Everything from routine check-ups to implants and smile makeovers."
          />
          <Link
            to="/treatments"
            prefetch="intent"
            viewTransition
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-link hover:underline"
          >
            All treatments explained
            <ArrowRight size={18} />
          </Link>
        </div>
        <div className="mt-12">
          <TreatmentCategoryGrid />
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- clinic photos */

const PHOTOS: Array<{ name: ImageName; alt: string; caption: string; className: string }> = [
  {
    name: 'photo-41',
    alt: 'Dentist in scrubs pointing at the Expressions Dental Clinic sign',
    caption: 'Welcome to Expressions',
    className: 'col-span-2 row-span-2 md:col-span-1',
  },
  {
    name: 'photo-60',
    alt: 'Dentist reviewing a dental X-ray on a laptop at the consultation desk',
    caption: 'X-rays reviewed with you',
    className: 'col-span-2 md:col-span-2',
  },
  {
    name: 'photo-47',
    alt: 'Dentist standing beside the dental chair in the treatment room',
    caption: 'Modern treatment rooms',
    className: 'col-span-1',
  },
  {
    name: 'photo-42',
    alt: 'Shop front of Expressions Dental Clinic in Duler, Mapusa',
    caption: 'Our Duler clinic',
    className: 'col-span-1',
  },
];

function ClinicPhotos() {
  return (
    <section id="clinic" aria-labelledby="clinic-title" className="bg-surface py-20 md:py-28">
      <div className={container}>
        <div data-reveal>
          <SectionHeading
            id="clinic-title"
            kicker="Our clinic"
            title="A calm, modern space to look after your smile"
            intro="Real photos from our clinic: no stock images, no actors."
          />
        </div>
        <div className="mt-12 grid auto-rows-[11rem] grid-cols-2 gap-4 sm:auto-rows-[14rem] md:grid-cols-3 md:gap-5">
          {PHOTOS.map((photo, index) => (
            <figure
              key={photo.name}
              data-reveal="zoom"
              style={revealDelay(index, 110)}
              className={`group relative overflow-hidden rounded-3xl bg-neutral-200 ${photo.className}`}
            >
              <Picture
                name={photo.name}
                alt={photo.alt}
                sizes="(min-width: 768px) 33vw, 50vw"
                className="block h-full"
                imgClassName="h-full w-full object-cover transition duration-700 group-hover:scale-110"
              />
              <figcaption className="absolute inset-x-3 bottom-3 rounded-full bg-white/90 px-4 py-2 text-sm font-semibold backdrop-blur transition duration-300 group-hover:-translate-y-1 group-hover:bg-white sm:inset-x-auto sm:left-3">
                {photo.caption}
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- testimonials */

function Testimonials() {
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="py-20 md:py-28">
      <div className={container}>
        <div data-reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <SectionHeading
            id="reviews-title"
            kicker="Patient stories"
            title="Patients who come back year after year"
            intro="Locals and visitors from abroad trust us with their family’s dental care."
          />
          <a
            href={googleRating.href}
            target="_blank"
            rel="noopener noreferrer"
            className="flex shrink-0 items-center gap-3 rounded-2xl bg-white px-5 py-3 ring-1 ring-neutral-200 transition duration-300 hover:-translate-y-1 hover:shadow-lg hover:ring-neutral-300"
          >
            <span className="font-display text-3xl font-bold">{googleRating.rating}</span>
            <span>
              <Stars />
              <span className="mt-0.5 block text-sm text-muted">
                Read all {googleRating.count} reviews on Google
              </span>
            </span>
          </a>
        </div>

        <ul className="mt-12 grid gap-5 md:grid-cols-2">
          {testimonials.map((testimonial, index) => (
            <li
              key={testimonial.name}
              data-reveal={index % 2 === 0 ? 'left' : 'right'}
              style={revealDelay(Math.floor(index / 2), 120)}
              className="group flex flex-col rounded-3xl bg-white p-7 ring-1 ring-neutral-200/80 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgb(31_36_43/0.3)] hover:ring-primary-200 sm:p-8"
            >
              <Quote
                size={28}
                className="text-primary-200 transition duration-300 group-hover:scale-125 group-hover:text-primary-400"
                fill="currentColor"
                strokeWidth={0}
              />
              <blockquote className="mt-4 flex-1 text-[1.05rem] leading-relaxed text-neutral-800">
                {testimonial.quote}
              </blockquote>
              <p className="mt-6 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-full bg-primary-50 font-bold text-primary-700">
                  {testimonial.name.charAt(0)}
                </span>
                <span>
                  <span className="block font-semibold">{testimonial.name}</span>
                  <span className="block text-sm text-muted">{testimonial.location}</span>
                </span>
              </p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- locations */

function Locations() {
  return (
    <section id="locations" aria-labelledby="locations-title" className="bg-surface py-20 md:py-28">
      <div className={container}>
        <div data-reveal>
          <SectionHeading
            id="locations-title"
            kicker="Visit us"
            title="Two clinics in North Goa"
            intro="Choose the clinic closest to you. Call or WhatsApp before you visit."
          />
        </div>
        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {branches.map((branch, index) => (
            <article
              key={branch.id}
              data-reveal={index % 2 === 0 ? 'left' : 'right'}
              className="group flex flex-col rounded-3xl bg-white p-7 ring-1 ring-neutral-200/80 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-24px_rgb(31_36_43/0.3)] sm:p-8"
            >
              <span className="grid size-12 place-items-center rounded-2xl bg-primary-50 text-primary-600 transition duration-300 group-hover:-translate-y-1 group-hover:bg-primary-600 group-hover:text-white">
                <MapPin size={24} />
              </span>
              <h3 className="mt-5 text-xl font-bold">{branch.shortName}</h3>
              <p className="mt-2 flex-1 leading-relaxed text-muted">{branch.address}</p>
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                <a
                  href={branch.directionsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${button.secondary} px-4`}
                >
                  <Navigation size={18} className="text-primary-600" />
                  Directions
                </a>
                <a href={primaryPhone.href} className={`${button.secondary} px-4`}>
                  <Phone size={18} className="text-primary-600" />
                  Call
                </a>
                <a
                  href={whatsappLink(
                    `Hello Expressions Dental Clinic, I'd like to book an appointment at your ${branch.shortName} clinic.`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${button.secondary} px-4`}
                >
                  <WhatsAppIcon size={18} className="text-[#128C4A]" />
                  WhatsApp
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- final CTA */

function FinalCta() {
  return (
    <section aria-labelledby="cta-title" className="py-20 md:py-28">
      <div className={container}>
        <div
          data-reveal="zoom"
          className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary-600 via-primary-600 to-primary-800 px-6 py-14 text-center text-white sm:px-12 md:py-20"
        >
          <div
            aria-hidden="true"
            className="float-slow absolute -top-24 -right-24 size-72 rounded-full bg-white/10 blur-2xl"
          />
          <div
            aria-hidden="true"
            className="float-slower absolute -bottom-28 -left-16 size-72 rounded-full bg-secondary-400/20 blur-2xl"
          />
          <h2
            id="cta-title"
            className="relative mx-auto max-w-2xl text-[clamp(1.9rem,1.4rem+2vw,3rem)] leading-tight font-bold"
          >
            Toothache, or just due for a check-up?
          </h2>
          <p className="relative mx-auto mt-4 max-w-xl text-lg text-primary-50">
            Send us a message and we’ll find you the earliest convenient time.
          </p>
          <div className="relative mt-9 flex flex-col justify-center gap-3 sm:flex-row">
            <Link to="/book" prefetch="intent" viewTransition className={button.onBrand}>
              Book an appointment
            </Link>
            <a href={primaryPhone.href} className={button.onBrandGhost}>
              <Phone size={18} />
              Call {primaryPhone.display}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  useScrollReveal();
  return (
    <>
      <JsonLd data={[organizationSchema(), websiteSchema(), ...dentistSchemas()]} />
      <HeroSlider />
      <TreatmentMarquee />
      <ReviewThemes />
      <Treatments />
      <ClinicPhotos />
      <Testimonials />
      <Locations />
      <FinalCta />
    </>
  );
}
