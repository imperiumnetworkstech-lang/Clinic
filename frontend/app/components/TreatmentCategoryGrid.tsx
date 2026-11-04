import { ChevronRight, Sparkles, Stethoscope } from 'lucide-react';
import type { ComponentType } from 'react';
import { Link } from 'react-router';
import { revealDelay } from '../lib/reveal';
import { treatmentCategories, treatmentHref, type CategoryId } from '../lib/treatments';
import { ToothIcon } from './icons';

const CATEGORY_STYLE: Record<
  CategoryId,
  { icon: ComponentType<{ size?: number }>; tint: string; iconTint: string }
> = {
  'general-treatments': {
    icon: ToothIcon,
    tint: 'from-secondary-50',
    iconTint: 'bg-secondary-100 text-secondary-700',
  },
  'advanced-treatments': {
    icon: Stethoscope,
    tint: 'from-neutral-100',
    iconTint: 'bg-neutral-200 text-neutral-800',
  },
  'cosmetic-treatments': {
    icon: Sparkles,
    tint: 'from-primary-50',
    iconTint: 'bg-primary-100 text-primary-700',
  },
};

/** The three treatment categories with every treatment linking to its own page. */
export function TreatmentCategoryGrid({ headingLevel = 'h3' }: { headingLevel?: 'h2' | 'h3' }) {
  const Heading = headingLevel;
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {treatmentCategories.map((category, index) => {
        const style = CATEGORY_STYLE[category.id];
        const Icon = style.icon;
        return (
          <article
            key={category.id}
            id={category.slug}
            data-reveal
            style={revealDelay(index, 120)}
            className={`group/card flex scroll-mt-28 flex-col rounded-[1.75rem] bg-gradient-to-b ${style.tint} to-white to-40% p-7 ring-1 ring-neutral-200/80 transition duration-300 hover:-translate-y-1.5 hover:shadow-[0_24px_48px_-28px_rgb(31_36_43/0.35)] sm:p-8`}
          >
            <span
              className={`grid size-12 place-items-center rounded-2xl transition duration-300 group-hover/card:-rotate-6 group-hover/card:scale-110 ${style.iconTint}`}
            >
              <Icon size={24} />
            </span>
            <Heading className="mt-5 text-xl font-bold">{category.title}</Heading>
            <p className="mt-2 text-muted">{category.blurb}</p>
            <ul className="mt-6 -mx-3 divide-y divide-neutral-200/80 border-t border-neutral-200/80">
              {category.treatments.map((treatment) => (
                <li key={treatment.slug}>
                  <Link
                    to={treatmentHref(treatment.slug)}
                    prefetch="intent"
                    viewTransition
                    className="group flex min-h-12 items-center justify-between gap-3 rounded-xl px-3 font-semibold transition hover:bg-white hover:text-primary-700"
                  >
                    {treatment.name}
                    <ChevronRight
                      size={18}
                      aria-hidden="true"
                      className="shrink-0 text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </article>
        );
      })}
    </div>
  );
}
