import { ArrowRight, Info, Phone } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { Badge } from '../components/ui/primitives';
import { primaryPhone } from '../lib/clinic';
import { cn } from '../lib/cn';
import { pageMeta } from '../lib/seo';
import { getSymptom, SYMPTOMS, URGENCY_COPY } from '../lib/symptoms';
import { getTreatment, treatmentHref } from '../lib/treatments';
import { button, container } from '../lib/ui';
import type { Route } from './+types/symptom-checker';

export function meta() {
  return pageMeta({
    title: 'What’s Bothering You? Dental Symptom Guide | Expressions',
    description:
      'Toothache, bleeding gums, a broken tooth or stains? See which treatments might help and how soon to book. General guidance, not a diagnosis.',
    path: '/symptom-checker',
  });
}

export function loader({ request }: Route.LoaderArgs) {
  const selected = getSymptom(new URL(request.url).searchParams.get('s'));
  return { selected: selected?.id ?? null };
}

/** Works without JavaScript: every choice is a link, and the result is server-rendered. */
export default function SymptomChecker({ loaderData }: Route.ComponentProps) {
  const symptom = getSymptom(loaderData.selected);
  const urgency = symptom ? URGENCY_COPY[symptom.urgency] : null;
  const treatments = symptom?.treatments.map(getTreatment).filter((t) => t !== undefined) ?? [];

  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Symptom guide', path: '/symptom-checker' }]}
        title="What’s bothering you?"
        intro="Choose what you’re experiencing to see which treatments might help and how soon to see us."
      />

      <section className={`${container} grid gap-10 py-12 md:py-16 lg:grid-cols-[22rem_1fr]`}>
        <nav aria-label="Symptoms">
          <ul className="grid gap-2">
            {SYMPTOMS.map((item) => (
              <li key={item.id}>
                <Link
                  to={`?s=${item.id}`}
                  preventScrollReset
                  replace
                  aria-current={item.id === symptom?.id ? 'true' : undefined}
                  className={cn(
                    'flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 font-semibold ring-1 transition',
                    item.id === symptom?.id
                      ? 'bg-primary-50 text-primary-800 ring-2 ring-primary-600'
                      : 'bg-white ring-neutral-200 hover:bg-neutral-50',
                  )}
                >
                  {item.label}
                  <ArrowRight size={18} aria-hidden="true" className="shrink-0 text-neutral-400" />
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* On phones the answer goes above the list once a symptom is chosen. */}
        <div aria-live="polite" className={symptom ? 'order-first lg:order-none' : undefined}>
          {symptom && urgency ? (
            <article className="rounded-[2rem] bg-white p-7 ring-1 ring-neutral-200 sm:p-9">
              <Badge tone={urgency.tone}>{urgency.label}</Badge>
              <h2 className="mt-4 text-2xl font-bold">{symptom.label}</h2>
              <p className="mt-3 text-lg text-muted">{symptom.advice}</p>

              <h3 className="mt-8 font-bold">Treatments your dentist may discuss</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {treatments.map((treatment) => (
                  <li key={treatment.slug}>
                    <Link
                      to={treatmentHref(treatment.slug)}
                      viewTransition
                      className="flex min-h-12 items-center justify-between rounded-2xl bg-surface px-4 font-semibold hover:text-primary-700"
                    >
                      {treatment.name}
                      <ArrowRight size={16} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to={`/book?treatment=${symptom.reason}`}
                  viewTransition
                  className={button.primary}
                >
                  Book an appointment
                </Link>
                <a href={primaryPhone.href} className={button.secondary}>
                  <Phone size={18} className="text-primary-600" />
                  Call {primaryPhone.display}
                </a>
              </div>
            </article>
          ) : (
            <div className="grid min-h-64 place-items-center rounded-[2rem] border border-dashed border-neutral-300 p-8 text-center text-muted">
              Choose a symptom to see what might help.
            </div>
          )}

          <p className="mt-6 flex gap-3 rounded-2xl bg-surface p-4 text-sm text-muted">
            <Info size={18} className="mt-0.5 shrink-0" />
            <span>
              This guide is general information, not a diagnosis. Only an examination can tell what
              is causing your symptoms.{' '}
              <Link to="/medical-disclaimer" className="font-semibold text-link underline">
                Medical disclaimer
              </Link>
            </span>
          </p>
        </div>
      </section>
    </>
  );
}
