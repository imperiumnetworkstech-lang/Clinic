import { CalendarClock, FileText, MessageCircle, Plane, Quote } from 'lucide-react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { ButtonLink } from '../components/ui/Button';
import { Card, IconTile } from '../components/ui/primitives';
import { email, testimonials, whatsappLink } from '../lib/clinic';
import { pageMeta } from '../lib/seo';
import { button, container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Dental Treatment in Goa for Visitors | Expressions Dental',
    description:
      'Visiting Goa? Plan dental treatment around your stay at our Candolim and Duler (Mapusa) clinics. Message us before you travel.',
    path: '/international-patients',
  });
}

const STEPS = [
  {
    icon: MessageCircle,
    title: 'Message us before you travel',
    text: 'Tell us what you’d like done and roughly when you’ll be in Goa. If you have recent X-rays, photos or a treatment plan from your dentist at home, send them on WhatsApp or by email.',
  },
  {
    icon: CalendarClock,
    title: 'A plan that fits your stay',
    text: 'After an examination we explain your options and which treatments can be finished during your visit. Some, like implants, need healing time between stages; we’ll be clear about that up front.',
  },
  {
    icon: FileText,
    title: 'Notes to take home',
    text: 'Ask us for a summary of the treatment you received, so your dentist at home knows exactly what was done.',
  },
];

/** International patients: three of the four testimonials on the old site came from UK visitors. */
const visitorStories = testimonials.filter((t) => /london|essex|kent/i.test(t.location));

export default function International() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'International patients', path: '/international-patients' }]}
        title="Dental care during your stay in Goa"
        intro="Many of our patients are visitors who come back year after year. Our Candolim clinic is on the beach road, and our main clinic is in Duler, Mapusa."
      >
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <ButtonLink
            href={whatsappLink(
              'Hello Expressions Dental Clinic, I will be visiting Goa and would like to plan some dental treatment.',
            )}
            external
            variant="whatsapp"
          >
            <WhatsAppIcon size={20} />
            WhatsApp +91 96570 61122
          </ButtonLink>
          <ButtonLink href={`mailto:${email}`} variant="secondary">
            Email us
          </ButtonLink>
        </div>
      </PageHeader>

      <section className={`${container} py-12 md:py-16`}>
        <h2 className="flex items-center gap-3 text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] font-bold">
          <Plane size={28} className="text-primary-600" aria-hidden="true" />
          How it works
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-3">
          {STEPS.map((step, index) => (
            <Card key={step.title}>
              <IconTile icon={step.icon} />
              <p className="mt-5 text-sm font-bold text-primary-600">Step {index + 1}</p>
              <h3 className="mt-1 text-lg font-bold">{step.title}</h3>
              <p className="mt-2 text-muted">{step.text}</p>
            </Card>
          ))}
        </div>

        <div className="mt-8 rounded-3xl bg-surface p-6 text-[0.95rem]">
          <p>
            <strong>Calling from abroad?</strong> Dial <strong>+91 96570 61122</strong> or{' '}
            <strong>+91 96570 41122</strong>. WhatsApp is usually the easiest way to reach us before
            you arrive.
          </p>
        </div>

        {visitorStories.length > 0 && (
          <>
            <h2 className="mt-14 text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] font-bold">
              From visitors who’ve been treated here
            </h2>
            <ul className="mt-6 grid gap-5 md:grid-cols-3">
              {visitorStories.map((story) => (
                <li key={story.name} className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
                  <Quote
                    size={24}
                    className="text-primary-200"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                  <blockquote className="mt-3 line-clamp-6 text-neutral-800">
                    {story.quote}
                  </blockquote>
                  <p className="mt-4 font-semibold">
                    {story.name} <span className="font-normal text-muted">· {story.location}</span>
                  </p>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-12 flex flex-wrap gap-3">
          <Link to="/treatments" viewTransition className={button.secondary}>
            Browse treatments
          </Link>
          <Link to="/contact" viewTransition className={button.secondary}>
            Clinic locations & hours
          </Link>
        </div>
      </section>
    </>
  );
}
