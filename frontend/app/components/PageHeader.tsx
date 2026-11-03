import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { breadcrumbSchema } from '../lib/seo';
import { container } from '../lib/ui';
import { JsonLd } from './JsonLd';

export interface Crumb {
  name: string;
  path: string;
}

/** Inner-page header: breadcrumb trail (with BreadcrumbList schema), the page's one h1, intro. */
export function PageHeader({
  crumbs,
  title,
  intro,
  children,
}: {
  crumbs: Crumb[];
  title: string;
  intro?: ReactNode;
  children?: ReactNode;
}) {
  const trail = [{ name: 'Home', path: '/' }, ...crumbs];
  return (
    <section className="relative overflow-hidden border-b border-neutral-200/70">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_90%_-20%,var(--color-primary-50),transparent_60%),radial-gradient(40rem_24rem_at_-10%_40%,var(--color-secondary-50),transparent_60%)]"
      />
      <div className={`${container} relative py-10 md:py-16`}>
        <JsonLd data={breadcrumbSchema(trail)} />
        <nav aria-label="Breadcrumb">
          <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
            {trail.map((crumb, index) => (
              <li key={crumb.path} className="flex items-center gap-1">
                {index > 0 && <ChevronRight size={14} aria-hidden="true" />}
                {index === trail.length - 1 ? (
                  <span aria-current="page" className="font-medium text-neutral-800">
                    {crumb.name}
                  </span>
                ) : (
                  <Link
                    to={crumb.path}
                    viewTransition
                    className="hover:text-primary-700 hover:underline"
                  >
                    {crumb.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <h1 className="mt-5 max-w-3xl text-[clamp(2rem,1.5rem+2.2vw,3.25rem)] leading-[1.08] font-extrabold tracking-[-0.03em]">
          {title}
        </h1>
        {intro && (
          <p className="mt-4 max-w-2xl text-[clamp(1.05rem,1rem+0.3vw,1.2rem)] text-muted">
            {intro}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
