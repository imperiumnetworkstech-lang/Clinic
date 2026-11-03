import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { WhatsAppIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { TreatmentCategoryGrid } from '../components/TreatmentCategoryGrid';
import { whatsappLink } from '../lib/clinic';
import { pageMeta } from '../lib/seo';
import { treatmentCount } from '../lib/treatments';
import { button, container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Dental Treatments in Mapusa & Candolim, Goa | Expressions',
    description: `All ${treatmentCount} treatments we offer, from check-ups, fillings and root canals to implants, braces, veneers and teeth whitening.`,
    path: '/treatments',
  });
}

export default function Treatments() {
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Treatments', path: '/treatments' }]}
        title="Dental treatments"
        intro={`${treatmentCount} treatments across general, advanced and cosmetic dentistry. Choose one to see what it involves, who it’s for and how to look after your teeth afterwards.`}
      />
      <section className={`${container} py-12 md:py-16`}>
        <TreatmentCategoryGrid headingLevel="h2" />
        <div className="mt-12 flex flex-col items-start justify-between gap-6 rounded-[2rem] bg-gradient-to-br from-primary-50 to-secondary-50 p-8 md:flex-row md:items-center md:p-10">
          <div>
            <h2 className="text-2xl font-bold">Not sure which treatment you need?</h2>
            <p className="mt-2 max-w-xl text-muted">
              Book a check-up, or tell us what’s bothering you. We’ll explain your options before
              anything is done.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link to="/book" viewTransition className={button.primary}>
              Book a check-up
              <ArrowRight size={18} />
            </Link>
            <a
              href={whatsappLink('Hello, I am not sure which treatment I need. Can you help?')}
              target="_blank"
              rel="noopener noreferrer"
              className={button.secondary}
            >
              <WhatsAppIcon size={20} className="text-[#128C4A]" />
              Ask on WhatsApp
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
