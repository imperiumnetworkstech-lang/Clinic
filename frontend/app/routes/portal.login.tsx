import { MailCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Button } from '../components/ui/Button';
import { primaryPhone } from '../lib/clinic';
import { PortalError, portalApi } from '../lib/portal-api';
import { pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Sign in to My Appointments | Expressions Dental Clinic',
    description: 'See or cancel your appointments at Expressions Dental Clinic.',
    path: '/portal/login',
    noindex: true,
  });
}

/** Patients sign in with a one-time link sent to the email they gave when booking. */
export default function PortalLogin() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [error, setError] = useState('');

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setState('sending');
    try {
      await portalApi.requestLink(email.trim());
      setState('sent');
    } catch (caught) {
      setState('idle');
      setError(
        caught instanceof PortalError && caught.code === 'email_unavailable'
          ? `Online sign-in isn’t available right now. Please call us on ${primaryPhone.display}.`
          : caught instanceof PortalError && caught.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : 'We couldn’t send the link just now. Please try again.',
      );
    }
  };

  return (
    <>
      <PageHeader
        crumbs={[{ name: 'My appointments', path: '/portal/login' }]}
        title="My appointments"
        intro="See your upcoming visits or cancel one. We email you a secure sign-in link, no password needed."
      />
      <section className={`${container} py-10 md:py-16`}>
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-7 ring-1 ring-neutral-200 sm:p-9">
          {state === 'sent' ? (
            <div role="status" className="text-center">
              <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary-50 text-primary-700">
                <MailCheck size={28} />
              </span>
              <h2 className="mt-4 text-xl font-bold">Check your email</h2>
              <p className="mt-2 text-muted">
                If <strong className="text-neutral-950">{email}</strong> is on a booking with us,
                you’ll get a sign-in link in a minute. It works once and expires in 15 minutes.
              </p>
              <button
                type="button"
                onClick={() => setState('idle')}
                className="mt-5 inline-flex min-h-11 items-center font-semibold text-link hover:underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={submit} noValidate={false}>
              <label htmlFor="portal-email" className="block font-semibold">
                Email you booked with
              </label>
              <input
                id="portal-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'portal-email-error' : undefined}
                className="mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-neutral-300 transition outline-none focus:ring-2 focus:ring-secondary-500"
              />
              {error && (
                <p
                  id="portal-email-error"
                  role="alert"
                  className="mt-2 text-sm font-medium text-[#B60411]"
                >
                  {error}
                </p>
              )}
              <Button
                type="submit"
                size="lg"
                className="mt-5 w-full"
                disabled={state === 'sending'}
              >
                {state === 'sending' ? 'Sending…' : 'Email me a sign-in link'}
              </Button>
              <p className="mt-5 text-sm text-muted">
                Booked without an email, or booked by phone? Call us on{' '}
                <a href={primaryPhone.href} className="font-semibold text-link underline">
                  {primaryPhone.display}
                </a>{' '}
                or{' '}
                <Link to="/book" className="font-semibold text-link underline">
                  book online
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </section>
    </>
  );
}
