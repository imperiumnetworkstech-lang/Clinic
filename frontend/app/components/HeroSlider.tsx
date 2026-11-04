import { ArrowRight, MapPin, Pause, Play, Star } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { WhatsAppIcon } from './icons';
import { Picture, type ImageName } from './Picture';
import { branches, googleRating, whatsappLink } from '../lib/clinic';
import { treatmentCount } from '../lib/treatments';
import { button, container } from '../lib/ui';

/** How long each photo stays up; the progress bar's CSS animation is the single clock. */
const SLIDE_MS = 6500;

const GENERAL_ENQUIRY = 'Hello Expressions Dental Clinic, I would like to book an appointment.';

/** Captions are the recurring themes of the clinic's Google reviews, not new claims. */
const SLIDES: Array<{ image: ImageName; alt: string; caption: string; focus: string }> = [
  {
    image: 'slider-1',
    alt: 'A dentist treating a patient in the dental chair at Expressions Dental Clinic',
    caption: 'A pain-free experience',
    focus: 'object-[70%_center]',
  },
  {
    image: 'photo-56',
    alt: 'The dentist explaining an X-ray to two patients at his desk',
    caption: 'Options explained clearly',
    focus: 'object-[75%_center]',
  },
  {
    image: 'slider-2',
    alt: 'The dentist showing a dental model to two patients',
    caption: 'Questions answered before we begin',
    focus: 'object-[55%_30%]',
  },
  {
    image: 'slider-3',
    alt: 'The dentist smiling at his desk in the clinic',
    caption: 'A friendly, at-home atmosphere',
    focus: 'object-[65%_30%]',
  },
];

export function HeroSlider() {
  const [active, setActive] = useState(0);
  // Nothing moves until the client has checked the visitor's motion preference.
  const [canAutoplay, setCanAutoplay] = useState(false);
  const [paused, setPaused] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setCanAutoplay(!query.matches);
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  const running = canAutoplay && !paused && !hovered;
  const next = () => setActive((index) => (index + 1) % SLIDES.length);
  const caption = SLIDES[active]?.caption ?? '';

  return (
    <section
      id="top"
      aria-labelledby="hero-title"
      aria-roledescription="carousel"
      className="relative isolate overflow-hidden bg-neutral-950 text-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {SLIDES.map((slide, index) =>
        // The first photo is the LCP image; the rest load after hydration so they never compete.
        index === 0 || mounted ? (
          <div
            key={slide.image}
            aria-hidden={index !== active}
            className={`absolute inset-0 -z-20 transition-opacity duration-[1400ms] ease-[var(--ease-out-soft)] ${
              index === active ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <Picture
              name={slide.image}
              alt={slide.alt}
              sizes="100vw"
              priority={index === 0}
              className="block size-full"
              imgClassName={`hero-photo size-full object-cover ${slide.focus} ${
                index % 2 === 1 ? 'hero-photo-alt' : ''
              } ${mounted && index === active ? 'is-active' : ''}`}
            />
          </div>
        ) : null,
      )}

      {/* Legibility: darkest where the text sits (bottom on phones, left on desktops). */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-t from-neutral-950 via-neutral-950/70 to-neutral-950/25 lg:bg-gradient-to-r lg:from-neutral-950/90 lg:via-neutral-950/60 lg:to-neutral-950/5"
      />
      <div
        aria-hidden="true"
        className="hero-glow absolute -top-40 -left-40 -z-10 hidden size-[34rem] rounded-full bg-primary-600/15 blur-3xl lg:block"
      />

      <div
        className={`${container} relative flex min-h-[40rem] flex-col justify-end pt-36 pb-6 sm:min-h-[42rem] lg:min-h-[48rem] lg:justify-center lg:pt-16 lg:pb-32`}
      >
        <div className="max-w-2xl">
          <p
            className="hero-rise inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/20 backdrop-blur-md"
            style={{ animationDelay: '0ms' }}
          >
            <MapPin size={15} />
            Duler, Mapusa · Candolim, Goa
          </p>
          <h1
            id="hero-title"
            className="hero-rise-still mt-6 text-[clamp(2.4rem,1.6rem+3.6vw,4.5rem)] leading-[1.04] font-extrabold tracking-[-0.035em]"
          >
            Gentle, modern dentistry for{' '}
            <span className="hero-shimmer bg-gradient-to-r from-primary-300 via-primary-200 to-primary-300 bg-[length:200%_auto] bg-clip-text text-transparent">
              the whole family
            </span>
          </h1>
          <p
            className="hero-rise mt-6 max-w-xl text-[clamp(1.075rem,1rem+0.35vw,1.25rem)] leading-relaxed text-white/85"
            style={{ animationDelay: '120ms' }}
          >
            From check-ups and root canals to implants and smile makeovers, we explain every option
            clearly and treat you comfortably at our two clinics in North Goa.
          </p>

          <div
            className="hero-rise mt-9 flex flex-col gap-3 sm:flex-row"
            style={{ animationDelay: '220ms' }}
          >
            <Link to="/book" prefetch="intent" viewTransition className={button.primary}>
              Book an appointment
              <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappLink(GENERAL_ENQUIRY)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${button.onBrandGhost} backdrop-blur-md`}
            >
              <WhatsAppIcon size={20} />
              WhatsApp us
            </a>
          </div>

          <dl
            className="hero-rise mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/20 pt-7"
            style={{ animationDelay: '320ms' }}
          >
            <div>
              <dt className="text-sm text-white/70">Google rating</dt>
              <dd className="mt-1 flex items-center gap-1.5 font-display text-2xl font-bold">
                {googleRating.rating}
                <Star size={18} className="text-amber-400" fill="currentColor" strokeWidth={0} />
              </dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Treatments</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{treatmentCount}</dd>
            </div>
            <div>
              <dt className="text-sm text-white/70">Clinics in Goa</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{branches.length}</dd>
            </div>
          </dl>
        </div>

        {/* Slide controls: caption, one progress bar per photo, and a pause button (WCAG 2.2.2). */}
        <div className="mt-10 flex items-center gap-4 lg:absolute lg:inset-x-8 lg:bottom-8 lg:mt-0">
          <div className="min-w-0 flex-1">
            <p className="flex items-baseline gap-3 text-sm" aria-live="polite">
              <span className="font-display font-bold tabular-nums text-white/60">
                {String(active + 1).padStart(2, '0')} / {String(SLIDES.length).padStart(2, '0')}
              </span>
              <span key={active} className="hero-caption truncate font-semibold">
                {caption}
                <span className="font-normal text-white/60"> · from our Google reviews</span>
              </span>
            </p>
            <div className="mt-3 flex gap-2">
              {SLIDES.map((slide, index) => (
                <button
                  key={slide.image}
                  type="button"
                  onClick={() => setActive(index)}
                  aria-label={`Show photo ${index + 1}: ${slide.caption}`}
                  aria-current={index === active}
                  className="group relative -my-5 flex h-11 flex-1 items-center"
                >
                  <span className="relative block h-1 w-full overflow-hidden rounded-full bg-white/25 transition-colors group-hover:bg-white/40">
                    <span
                      key={index === active ? `run-${active}` : 'idle'}
                      className={`absolute inset-y-0 left-0 rounded-full bg-white ${
                        index < active ? 'w-full' : index === active ? '' : 'w-0'
                      } ${index === active && canAutoplay ? 'hero-progress' : ''} ${
                        index === active && !canAutoplay ? 'w-full' : ''
                      }`}
                      style={
                        index === active && canAutoplay
                          ? {
                              animationDuration: `${SLIDE_MS}ms`,
                              animationPlayState: running ? 'running' : 'paused',
                            }
                          : undefined
                      }
                      onAnimationEnd={index === active ? next : undefined}
                    />
                  </span>
                </button>
              ))}
            </div>
          </div>
          {canAutoplay ? (
            <button
              type="button"
              onClick={() => setPaused((value) => !value)}
              aria-label={paused ? 'Play the photo slideshow' : 'Pause the photo slideshow'}
              className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/25 backdrop-blur-md transition-colors hover:bg-white/20"
            >
              {paused ? <Play size={18} fill="currentColor" /> : <Pause size={18} />}
            </button>
          ) : null}
        </div>

        <a
          href={googleRating.href}
          target="_blank"
          rel="noopener noreferrer"
          className="hero-float absolute right-8 bottom-32 hidden items-center gap-3 rounded-2xl bg-white/95 px-4 py-3 text-neutral-900 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] ring-1 ring-white/40 backdrop-blur xl:flex"
        >
          <span className="grid size-11 place-items-center rounded-xl bg-primary-50 font-display text-lg font-bold text-primary-700">
            {googleRating.rating}
          </span>
          <span>
            <span className="flex text-amber-400" aria-hidden="true">
              {Array.from({ length: 5 }, (_, i) => (
                <Star key={i} size={16} fill="currentColor" strokeWidth={0} />
              ))}
            </span>
            <span className="mt-0.5 block text-sm font-medium text-neutral-700">
              {googleRating.count} Google reviews
            </span>
          </span>
        </a>
      </div>
    </section>
  );
}
