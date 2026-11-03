import { Link } from 'react-router';
import { LegalPage } from '../components/LegalPage';
import { pageMeta } from '../lib/seo';

export function meta() {
  return pageMeta({
    title: 'Medical Disclaimer | Expressions Dental Clinic',
    description:
      'The information on this website is general and is not a substitute for a dental examination.',
    path: '/medical-disclaimer',
  });
}

export default function MedicalDisclaimer() {
  return (
    <LegalPage
      title="Medical disclaimer"
      path="/medical-disclaimer"
      updated="3 November 2026"
      draft
    >
      <p>
        The information on this website, including the treatment pages and FAQs, is general
        information about dental care. It is not a diagnosis and is not a substitute for an
        examination and personal advice from a qualified dentist.
      </p>
      <p>
        Every patient is different. Whether a treatment is suitable for you, how many visits it
        needs and how you recover depend on your own oral health and medical history, which your
        dentist will assess in person.
      </p>
      <p>
        If you have severe pain, swelling, bleeding that will not stop, or an injury to the face or
        jaw, contact us straight away or go to the nearest hospital emergency department. See our{' '}
        <Link to="/emergency-dentist-goa" className="font-semibold text-link underline">
          dental emergency guidance
        </Link>
        .
      </p>
      <p>
        We review this content regularly, but dental knowledge changes. If you notice something that
        seems out of date, please let us know.
      </p>
    </LegalPage>
  );
}
