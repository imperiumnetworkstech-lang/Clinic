import { FileWarning } from 'lucide-react';
import type { ReactNode } from 'react';
import { container } from '../lib/ui';
import { PageHeader } from './PageHeader';

/** Shared layout for legal pages; drafts carry a visible notice until reviewed. */
export function LegalPage({
  title,
  path,
  updated,
  draft,
  children,
}: {
  title: string;
  path: string;
  updated: string;
  draft?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <PageHeader
        crumbs={[{ name: title, path }]}
        title={title}
        intro={`Last updated ${updated}`}
      />
      <section className={`${container} py-12 md:py-16`}>
        {draft && (
          <p className="mb-8 flex max-w-3xl gap-3 rounded-2xl bg-[#FFF5EA] p-4 text-[0.95rem] text-[#6A4100]">
            <FileWarning size={20} className="mt-0.5 shrink-0" />
            Draft pending review by the clinic and its legal adviser before the site launches.
          </p>
        )}
        <div className="max-w-3xl space-y-4 leading-relaxed [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-2">
          {children}
        </div>
      </section>
    </>
  );
}
