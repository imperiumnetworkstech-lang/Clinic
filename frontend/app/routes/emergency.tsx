import { AlertTriangle, Phone } from 'lucide-react';
import { WhatsAppIcon } from '../components/icons';
import { OpenNowBadge } from '../components/OpenNowBadge';
import { PageHeader } from '../components/PageHeader';
import { ButtonLink } from '../components/ui/Button';
import { phones, whatsappLink } from '../lib/clinic';
import { pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Emergency Dentist in Mapusa & Candolim, Goa | Expressions',
    description:
      'Toothache, a broken or knocked-out tooth, or swelling? Call or WhatsApp Expressions Dental Clinic for the earliest appointment.',
    path: '/emergency-dentist-goa',
  });
}

const SITUATIONS = [
  {
    title: 'Severe toothache',
    text: 'Call us for the earliest slot. Until then, rinse with warm salt water and avoid very hot, cold or sweet food on that side.',
  },
  {
    title: 'Knocked-out tooth',
    text: 'Pick it up by the crown, not the root. Rinse it gently without scrubbing, keep it in milk or inside your cheek, and come in as quickly as possible.',
  },
  {
    title: 'Broken or chipped tooth',
    text: 'Save any pieces, rinse your mouth, and use a cold compress on the cheek if there is swelling.',
  },
  {
    title: 'Swelling or abscess',
    text: 'Call us the same day. Facial swelling with fever, or difficulty breathing or swallowing, needs a hospital emergency department immediately.',
  },
];

export default function Emergency() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Dental emergencies', path: '/emergency-dentist-goa' }]}
        title="Dental emergency? We’ll see you as soon as we can"
        intro="Call or WhatsApp us and tell us what happened. We’ll find you the earliest possible appointment."
      >
        <div className="mt-5">
          <OpenNowBadge branchId="mapusa" />
        </div>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {phones.map((phone) => (
            <ButtonLink key={phone.href} href={phone.href} size="lg">
              <Phone size={18} />
              Call {phone.display}
            </ButtonLink>
          ))}
          <ButtonLink
            href={whatsappLink(
              'Hello, I have a dental emergency and need the earliest appointment.',
            )}
            external
            variant="whatsapp"
            size="lg"
          >
            <WhatsAppIcon size={20} />
            WhatsApp
          </ButtonLink>
        </div>
      </PageHeader>

      <section className={`${container} py-12 md:py-16`}>
        <h2 className="text-[clamp(1.5rem,1.2rem+1vw,2.1rem)] font-bold">
          What to do until you see us
        </h2>
        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {SITUATIONS.map((item) => (
            <article key={item.title} className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
              <h3 className="text-lg font-bold">{item.title}</h3>
              <p className="mt-2 text-muted">{item.text}</p>
            </article>
          ))}
        </div>
        <p className="mt-8 flex gap-3 rounded-2xl bg-[#FEF4F3] p-5 text-[#720308]">
          <AlertTriangle size={20} className="mt-0.5 shrink-0" />
          <span>
            This is general first-aid guidance, not a diagnosis. For heavy bleeding that won’t stop,
            a facial injury, or swelling that affects breathing or swallowing, go to the nearest
            hospital emergency department.
          </span>
        </p>
      </section>
    </>
  );
}
