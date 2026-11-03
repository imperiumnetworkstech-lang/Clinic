import { ArrowRight, Clock } from 'lucide-react';
import { Link } from 'react-router';
import { PageHeader } from '../components/PageHeader';
import { formatPublished, postHref, readingMinutes } from '../lib/blog';
import { loadPosts } from '../lib/content.server';
import { pageMeta } from '../lib/seo';
import { container } from '../lib/ui';
import type { Route } from './+types/blog';

export function meta() {
  return pageMeta({
    title: 'Dental Care Guides | Expressions Dental Clinic Blog',
    description:
      'Practical, plain-language guides to looking after your teeth and gums from Expressions Dental Clinic, Goa.',
    path: '/blog',
  });
}

export async function loader() {
  const posts = await loadPosts();
  return {
    posts: posts.map((post) => ({
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      category: post.category,
      publishedAt: post.publishedAt,
      minutes: readingMinutes(post),
    })),
  };
}

export default function Blog({ loaderData }: Route.ComponentProps) {
  const { posts } = loaderData;
  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Dental care guides', path: '/blog' }]}
        title="Dental care guides"
        intro="Plain-language advice for looking after your teeth and gums between visits."
      />
      <section className={`${container} py-12 md:py-16`}>
        <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                to={postHref(post.slug)}
                prefetch="intent"
                viewTransition
                className="group flex h-full flex-col rounded-3xl bg-white p-7 ring-1 ring-neutral-200 transition hover:ring-neutral-300"
              >
                <span className="text-sm font-bold tracking-[0.12em] text-primary-600 uppercase">
                  {post.category}
                </span>
                <h2 className="mt-3 text-xl font-bold group-hover:text-primary-700">
                  {post.title}
                </h2>
                <p className="mt-3 flex-1 text-muted">{post.excerpt}</p>
                <span className="mt-6 flex items-center justify-between text-sm text-muted">
                  <span className="flex items-center gap-1.5">
                    <Clock size={14} aria-hidden="true" />
                    {post.minutes} min read · {formatPublished(post.publishedAt)}
                  </span>
                  <ArrowRight
                    size={18}
                    aria-hidden="true"
                    className="text-neutral-400 transition group-hover:translate-x-0.5 group-hover:text-primary-600"
                  />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
