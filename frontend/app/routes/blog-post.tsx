import { ArrowRight, CalendarPlus, Clock, ExternalLink, Info } from 'lucide-react';
import { data, Link } from 'react-router';
import { JsonLd } from '../components/JsonLd';
import { PageHeader } from '../components/PageHeader';
import { formatPublished, postHref, readingMinutes, sectionId } from '../lib/blog';
import { loadPosts } from '../lib/content.server';
import { articleSchema, pageMeta } from '../lib/seo';
import { getTreatment, treatmentHref } from '../lib/treatments';
import { button, container } from '../lib/ui';
import type { Route } from './+types/blog-post';

export async function loader({ params }: Route.LoaderArgs) {
  const posts = await loadPosts();
  const post = posts.find((entry) => entry.slug === params.slug);
  if (!post) throw data(null, { status: 404 });
  const more = posts
    .filter((other) => other.slug !== post.slug)
    .slice(0, 2)
    .map((other) => ({ slug: other.slug, title: other.title, category: other.category }));
  return { post, more };
}

export function meta({ data: loaded }: Route.MetaArgs) {
  const post = loaded?.post;
  if (!post) return [{ title: 'Article not found' }];
  return pageMeta({
    title: post.metaTitle,
    description: post.metaDescription,
    path: postHref(post.slug),
  });
}

export default function BlogPost({ loaderData }: Route.ComponentProps) {
  const { post, more } = loaderData;
  const related = post.relatedTreatments.map(getTreatment).filter((t) => t !== undefined);

  return (
    <>
      <JsonLd data={articleSchema(post)} />
      <PageHeader
        crumbs={[
          { name: 'Dental care guides', path: '/blog' },
          { name: post.title, path: postHref(post.slug) },
        ]}
        title={post.title}
        intro={post.excerpt}
      >
        <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="font-semibold text-primary-700">{post.category}</span>
          <span aria-hidden="true">·</span>
          <time dateTime={post.publishedAt}>{formatPublished(post.publishedAt)}</time>
          <span aria-hidden="true">·</span>
          <span className="flex items-center gap-1">
            <Clock size={14} aria-hidden="true" />
            {readingMinutes(post)} min read
          </span>
          <span aria-hidden="true">·</span>
          <span>By the Expressions Dental Clinic team</span>
        </p>
      </PageHeader>

      <div className={`${container} grid gap-12 py-12 md:py-16 lg:grid-cols-[1fr_18rem]`}>
        <article className="max-w-3xl text-[1.0625rem] leading-relaxed">
          {post.sections.map((section) => (
            <section
              key={section.heading}
              id={sectionId(section.heading)}
              className="mt-10 scroll-mt-28 first:mt-0"
            >
              <h2 className="text-[clamp(1.35rem,1.2rem+0.6vw,1.75rem)] font-bold">
                {section.heading}
              </h2>
              {section.paragraphs?.map((paragraph) => (
                <p key={paragraph} className="mt-4">
                  {paragraph}
                </p>
              ))}
              {section.list && (
                <ul className="mt-4 space-y-2 pl-5 [&>li]:list-disc [&>li]:marker:text-primary-500">
                  {section.list.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}

          {post.references.length > 0 && (
            <section className="mt-12 border-t border-neutral-200 pt-8">
              <h2 className="text-lg font-bold">Sources</h2>
              <ul className="mt-3 space-y-2 text-[0.95rem]">
                {post.references.map((reference) => (
                  <li key={reference.url}>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 items-center gap-1.5 font-semibold text-link hover:underline"
                    >
                      {reference.label}
                      <ExternalLink size={14} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <p className="mt-8 flex gap-3 rounded-2xl bg-surface p-4 text-sm text-muted">
            <Info size={18} className="mt-0.5 shrink-0" />
            <span>
              General information, not personal medical advice.{' '}
              <Link to="/medical-disclaimer" className="font-semibold text-link underline">
                Medical disclaimer
              </Link>
            </span>
          </p>
        </article>

        <aside className="space-y-6 lg:sticky lg:top-28 lg:self-start">
          <nav
            aria-label="On this page"
            className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200"
          >
            <h2 className="text-sm font-bold tracking-wide text-muted uppercase">On this page</h2>
            <ol className="mt-3 space-y-1">
              {post.sections.map((section) => (
                <li key={section.heading}>
                  <a
                    href={`#${sectionId(section.heading)}`}
                    className="flex min-h-10 items-center font-medium hover:text-primary-700"
                  >
                    {section.heading}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="rounded-3xl bg-gradient-to-br from-primary-600 to-primary-800 p-6 text-white">
            <h2 className="text-lg font-bold">Due for a check-up?</h2>
            <p className="mt-2 text-primary-50">We’ll check your teeth, gums and whole mouth.</p>
            <Link
              to="/book?treatment=checkup"
              viewTransition
              className={`${button.onBrand} mt-4 w-full`}
            >
              <CalendarPlus size={18} />
              Book a check-up
            </Link>
          </div>

          {related.length > 0 && (
            <div className="rounded-3xl bg-white p-6 ring-1 ring-neutral-200">
              <h2 className="text-lg font-bold">Related treatments</h2>
              <ul className="mt-3 -mx-2">
                {related.map((treatment) => (
                  <li key={treatment.slug}>
                    <Link
                      to={treatmentHref(treatment.slug)}
                      viewTransition
                      className="flex min-h-11 items-center justify-between rounded-xl px-2 font-semibold hover:bg-neutral-50 hover:text-primary-700"
                    >
                      {treatment.name}
                      <ArrowRight size={16} className="text-neutral-400" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      {more.length > 0 && (
        <section className="bg-surface py-12">
          <div className={container}>
            <h2 className="text-xl font-bold">More guides</h2>
            <ul className="mt-5 grid gap-4 md:grid-cols-2">
              {more.map((other) => (
                <li key={other.slug}>
                  <Link
                    to={postHref(other.slug)}
                    viewTransition
                    className="flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-white px-5 font-semibold ring-1 ring-neutral-200 hover:text-primary-700"
                  >
                    {other.title}
                    <ArrowRight size={18} aria-hidden="true" className="shrink-0" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
