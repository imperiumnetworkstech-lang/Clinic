import { ArrowRight, CalendarPlus, CheckCircle2, Info, Phone } from 'lucide-react';
import type { ReactNode } from 'react';
import { data, Link, redirect } from 'react-router';
import { WhatsAppIcon } from '../components/icons';
import { JsonLd } from '../components/JsonLd';
import { PageHeader } from '../components/PageHeader';
import { Accordion } from '../components/ui/Accordion';
import { primaryPhone, whatsappLink } from '../lib/clinic';
import { loadTreatment } from '../lib/content.server';
import { legacyRedirect } from '../lib/redirects';
import { faqSchema, pageMeta, procedureSchema } from '../lib/seo';
import { CATEGORIES, getTreatment, treatmentHref } from '../lib/treatments';
import { button, container } from '../lib/ui';
import type { Route } from './+types/treatment';

export async function loader({ params, request }: Route.LoaderArgs) {
  const treatment = await loadTreatment(params.slug);
  if (!treatment) {
    const moved = legacyRedirect(new URL(request.url).pathname);
    if (moved) throw redirect(moved.to, moved.status);
    throw data(null, { status: 404 });
  }
  return { treatment };
}

export function meta({ data: loaded }: Route.MetaArgs) {
  const treatment = loaded?.treatment;
  if (!treatment) return [{ title: 'Treatment not found' }];
  return pageMeta({
    title: treatment.metaTitle,
    description: treatment.metaDescription,
    path: treatmentHref(treatment.slug),
  });
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-10 first:border-t-0 first:pt-0">
      <h2 className="text-[clamp(1.4rem,1.2rem+0.8vw,1.85rem)] font-bold">{title}</h2>
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function TreatmentPage({ loaderData }: Route.ComponentProps) {
  const { treatment } = loaderData;
  const category = CATEGORIES[treatment.category];
  const related = treatment.related.map(getTreatment).filter((item) => item !== undefined);
  const bookHref = `/book?treatment=${treatment.slug}`;

  return (
    <>
      <JsonLd
        data={[
          procedureSchema(treatment),
          ...(treatment.faqs.length ? [faqSchema(treatment.faqs)] : []),
        ]}
      />
      <PageHeader
        crumbs={[
          { name: 'Treatments', path: '/treatments' },
          { name: treatment.name, path: treatmentHref(treatment.slug) },
        ]}
        title={treatment.name}
        intro={treatment.summary}
      >
        <p className="mt-4 text-sm font-semibold text-primary-700">{category.title}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to={bookHref} viewTransition className={button.primary}>
            <CalendarPlus size={18} />
            Book a consultation
          </Link>
          <a
            href={whatsappLink(`Hello, I have a question about ${treatment.name}.`)}
            target="_blank"
            rel="noopener noreferrer"
            className={button.secondary}
          >
            <WhatsAppIcon size={20} className="text-[#128C4A]" />
            Ask a question
          </a>
        </div>
      </PageHeader>

      <div className={`${container} grid gap-12 py-12 md:py-16 lg:grid-cols-[1fr_20rem]`}>
        <article className="max-w-3xl">
          <Section title="Who it’s for">
            <ul className="grid gap-3 sm:grid-cols-2">
              {treatment.whoFor.map((item) => (
                <li key={item} className="flex gap-3 rounded-2xl bg-surface p-4">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-primary-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="What happens">
            <ol className="relative space-y-6 border-l-2 border-primary-100 pl-8">
              {treatment.steps.map((step, index) => (
                <li key={step.title} className="relative">
                  <span className="absolute top-0 -left-[2.65rem] grid size-8 place-items-center rounded-full bg-primary-600 text-sm font-bold text-white ring-4 ring-white">
                    {index + 1}
                  </span>
                  <h3 className="text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 text-muted">{step.text}</p>
                </li>
              ))}
            </ol>
          </Section>

          <Section title="Aftercare">
            <ul className="space-y-3">
              {treatment.aftercare.map((item) => (
                <li key={item} className="flex gap-3">
                  <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-secondary-600" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </Section>

          {treatment.faqs.length > 0 && (
            <Section title="Common questions">
              <Accordion
                items={treatment.faqs.map((faq, index) => ({
                  id: `faq-${index}`,
                  title: faq.q,
                  content: faq.a,
                }))}
              />
            </Section>
          )}

          <p className="mt-4 flex gap-3 rounded-2xl bg-surface p-4 text-sm text-muted">
            <Info size={18} className="mt-0.5 shrink-0" />
            <span>
              This page explains the treatment in general terms. Your dentist will advise on what is
              right for you after an examination.{' '}
              <Link to="/medical-disclaimer" className="font-semibold text-link underline">
                Medical disclaimer
              </Link>
            </span>
          </p>
        </article>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white">
            <h2 className="text-xl font-bold">Talk to us about {treatment.name.toLowerCase()}</h2>
            <p className="mt-2 text-primary-50">
              We’ll examine your teeth and explain your options before any treatment.
            </p>
            <div className="mt-5 grid gap-3">
              <Link to={bookHref} viewTransition className={button.onBrand}>
                Book a consultation
              </Link>
              <a href={primaryPhone.href} className={button.onBrandGhost}>
                <Phone size={18} />
                {primaryPhone.display}
              </a>
            </div>
          </div>

          {related.length > 0 && (
            <div className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
              <h2 className="text-lg font-bold">Related treatments</h2>
              <ul className="mt-3 -mx-2">
                {related.map((item) => (
                  <li key={item.slug}>
                    <Link
                      to={treatmentHref(item.slug)}
                      prefetch="intent"
                      viewTransition
                      className="flex min-h-11 items-center justify-between rounded-xl px-2 font-semibold hover:bg-neutral-50 hover:text-primary-700"
                    >
                      {item.name}
                      <ArrowRight size={16} className="text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </>
  );
}
