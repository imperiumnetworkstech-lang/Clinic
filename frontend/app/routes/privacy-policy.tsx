import { LegalPage } from '../components/LegalPage';
import { email, primaryPhone } from '../lib/clinic';
import { pageMeta } from '../lib/seo';

export function meta() {
  return pageMeta({
    title: 'Privacy Policy | Expressions Dental Clinic',
    description:
      'How Expressions Dental Clinic collects, uses and protects your personal information.',
    path: '/privacy-policy',
  });
}

/** Written to India's Digital Personal Data Protection Act, 2023. Draft until legal review. */
export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy policy" path="/privacy-policy" updated="3 November 2026" draft>
      <p>
        Expressions Dental Clinic (“we”, “us”) respects your privacy. This policy explains what
        personal data we collect through this website, why, and the choices you have, in line with
        India’s Digital Personal Data Protection Act, 2023.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Appointment requests:</strong> the patient’s name, your mobile number, who the
          appointment is for, the clinic, your preferred date and time, the reason for the visit and
          any note you add.
        </li>
        <li>
          <strong>Technical data:</strong> your IP address and basic device information, used to
          keep the website secure and to prevent abuse.
        </li>
        <li>
          <strong>Preferences on this device:</strong> accessibility settings (text size, contrast)
          are stored only in your browser.
        </li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To contact you by phone or WhatsApp and arrange the appointment you asked for.</li>
        <li>To keep a record of your request and of your consent.</li>
        <li>To protect the website and our patients from misuse.</li>
      </ul>
      <p>
        We do not sell your data, and we do not use it for marketing unless you separately agree. We
        do not use advertising or analytics cookies.
      </p>

      <h2>Consent and withdrawal</h2>
      <p>
        We process your request on the basis of your consent, given with the checkbox on the booking
        form. You can withdraw consent at any time by contacting us. Withdrawal does not affect
        processing already carried out.
      </p>

      <h2>How long we keep it</h2>
      <p>
        We keep appointment requests only as long as needed to arrange your care and to meet legal
        or regulatory record-keeping duties. Requests that do not lead to a visit are deleted after
        a limited period.
      </p>

      <h2>Who can see it</h2>
      <p>
        Only authorised clinic staff, through a secure staff system with individual accounts and
        two-step sign-in for owners and doctors. Our hosting providers process data on our behalf
        under contract and only on our instructions.
      </p>

      <h2>Your rights</h2>
      <ul>
        <li>Ask for a summary of the personal data we hold about you.</li>
        <li>Ask us to correct, complete, update or erase it.</li>
        <li>Nominate another person to exercise these rights on your behalf.</li>
        <li>
          Raise a grievance with us, and with the Data Protection Board of India if unresolved.
        </li>
      </ul>

      <h2>Contact</h2>
      <p>
        For privacy questions or requests, email{' '}
        <a href={`mailto:${email}`} className="font-semibold text-link underline">
          {email}
        </a>{' '}
        or call{' '}
        <a href={primaryPhone.href} className="font-semibold text-link underline">
          {primaryPhone.display}
        </a>
        .
      </p>
    </LegalPage>
  );
}
