import blogData from '../../../content/blog.json';

export interface BlogSection {
  heading: string;
  paragraphs?: string[];
  list?: string[];
}

export interface BlogPost {
  slug: string;
  legacyPath: string;
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  relatedTreatments: string[];
  sections: BlogSection[];
  references: Array<{ label: string; url: string }>;
}

export const posts = blogData.posts as BlogPost[];

/** Articles must be approved by a clinic dentist before launch. */
export const BLOG_CONTENT_STATUS = blogData.reviewStatus;

export const getPost = (slug: string | undefined) => posts.find((post) => post.slug === slug);

export const postHref = (slug: string) => `/blog/${slug}`;

export const sectionId = (heading: string) =>
  heading
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

/** Reading time at ~200 words per minute, never less than one minute. */
export function readingMinutes(post: BlogPost): number {
  const text = [
    post.excerpt,
    ...post.sections.flatMap((section) => [
      section.heading,
      ...(section.paragraphs ?? []),
      ...(section.list ?? []),
    ]),
  ].join(' ');
  return Math.max(1, Math.round(text.split(/\s+/).length / 200));
}

export function formatPublished(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}
