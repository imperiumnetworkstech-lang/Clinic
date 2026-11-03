import { ArrowRight, HeartHandshake, MessageCircleQuestion, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router';
import clinicData from '../../../content/clinic.json';
import { PageHeader } from '../components/PageHeader';
import { Picture, type ImageName } from '../components/Picture';
import { Card, IconTile } from '../components/ui/primitives';
import { googleRating } from '../lib/clinic';
import { pageMeta } from '../lib/seo';
import { button, container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'About Expressions Dental Clinic | Mapusa & Candolim, Goa',
    description:
      'A modern, comfortable dental clinic in North Goa where every option is explained clearly. Meet our clinic and the way we care for patients.',
    path: '/about',
  });
}

/** The clinic's own words from its previous website (first paragraph duplicates the intro). */
const STORY = clinicData.clinic.legacyAbout.slice(2);

const PHOTOS: Array<{ name: ImageName; alt: string }> = [
  { name: 'photo-38', alt: 'Dentist smiling at the consultation desk' },
  { name: 'photo-47', alt: 'Dentist standing beside the dental chair' },
  { name: 'photo-62', alt: 'Dentist explaining with a dental model at the desk' },
  { name: 'photo-42', alt: 'Shop front of Expressions Dental Clinic in Duler, Mapusa' },
];

const PROMISES = [
  {
    icon: MessageCircleQuestion,
    title: 'We explain first',
    text: 'You’ll understand the cause of the problem and your options before any treatment begins.',
  },
  {
    icon: HeartHandshake,
    title: 'Comfort matters',
    text: 'A calm clinic and a team that knows how to put nervous patients at ease.',
  },
  {
    icon: ShieldCheck,
    title: 'Careful, modern care',
    text: 'Treatment planned around your needs in a modern dental office.',
  },
];

export default function About() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'About us', path: '/about' }]}
        title="About Expressions Dental Clinic"
        intro={clinicData.clinic.legacyIntro}
      />

      <section className={`${container} grid items-center gap-12 py-12 md:py-20 lg:grid-cols-2`}>
        <div className="space-y-5 text-lg leading-relaxed">
          {STORY.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <p className="text-base text-muted">
            Patients rate our Duler clinic{' '}
            <a
              href={googleRating.href}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-link underline"
            >
              {googleRating.rating}★ from {googleRating.count} Google reviews
            </a>
            .
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {PHOTOS.map((photo, index) => (
            <Picture
              key={photo.name}
              name={photo.name}
              alt={photo.alt}
              sizes="(min-width: 1024px) 300px, 45vw"
              className={index % 2 === 1 ? 'translate-y-8' : ''}
              imgClassName="aspect-[3/4] w-full rounded-3xl object-cover"
            />
          ))}
        </div>
      </section>

      <section className="bg-surface py-16 md:py-20">
        <div className={container}>
          <h2 className="text-[clamp(1.75rem,1.3rem+1.6vw,2.6rem)] font-bold">
            How we look after you
          </h2>
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {PROMISES.map((item) => (
              <Card key={item.title}>
                <IconTile icon={item.icon} />
                <h3 className="mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-2 text-muted">{item.text}</p>
              </Card>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link to="/book" viewTransition className={button.primary}>
              Book an appointment
              <ArrowRight size={18} />
            </Link>
            <Link to="/treatments" viewTransition className={button.secondary}>
              See our treatments
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
