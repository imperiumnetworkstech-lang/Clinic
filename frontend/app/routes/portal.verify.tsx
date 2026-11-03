import { Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { portalApi } from '../lib/portal-api';
import { pageMeta } from '../lib/seo';
import { container } from '../lib/ui';

export function meta() {
  return pageMeta({
    title: 'Signing in | Expressions Dental Clinic',
    description: 'Signing in to My Appointments.',
    path: '/portal/verify',
    noindex: true,
  });
}

/**
 * Landing page for the emailed link. The token is read once, removed from the address bar
 * and exchanged for a session, so it never lingers in history or reaches analytics.
 */
export default function PortalVerify() {
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    window.history.replaceState(null, '', '/portal/verify');
    if (!token) {
      setFailed(true);
      return;
    }
    portalApi
      .verify(token)
      .then(() => navigate('/portal', { replace: true }))
      .catch(() => setFailed(true));
  }, [navigate]);

  return (
    <>
      <PageHeader
        crumbs={[{ name: 'My appointments', path: '/portal/login' }]}
        title="My appointments"
      />
      <section className={`${container} py-10 md:py-16`}>
        <div className="mx-auto max-w-md rounded-[2rem] bg-white p-7 text-center ring-1 ring-neutral-200 sm:p-9">
          {failed ? (
            <div role="alert">
              <h2 className="text-xl font-bold">This link has expired</h2>
              <p className="mt-2 text-muted">
                Sign-in links work once and only for 15 minutes. Ask for a new one below.
              </p>
              <Link
                to="/portal/login"
                className="mt-5 inline-flex min-h-11 items-center font-semibold text-link hover:underline"
              >
                Send me a new link
              </Link>
            </div>
          ) : (
            <p role="status" className="flex items-center justify-center gap-2 text-muted">
              <Loader2 size={20} className="animate-spin motion-reduce:animate-none" />
              Signing you in…
            </p>
          )}
        </div>
      </section>
    </>
  );
}
