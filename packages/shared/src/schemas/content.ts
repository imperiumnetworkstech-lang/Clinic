import { z } from 'zod';

/**
 * Website content edited in the admin (CMS). Each type's data mirrors the shape the public
 * pages already render, so content/*.json imports one-to-one and stays the offline fallback.
 */

export const CONTENT_TYPES = ['blog_post', 'faq', 'treatment'] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  blog_post: 'Blog article',
  faq: 'FAQ',
  treatment: 'Treatment page',
};

const line = (max: number) => z.string().trim().min(1).max(max);

export const blogPostContent = z.object({
  title: line(140),
  metaTitle: line(70),
  metaDescription: line(170),
  excerpt: line(400),
  category: line(60),
  publishedAt: z.iso.date(),
  relatedTreatments: z.array(z.string().max(80)).max(6).default([]),
  sections: z
    .array(
      z.object({
        heading: line(140),
        paragraphs: z.array(line(3000)).max(20).optional(),
        list: z.array(line(500)).max(30).optional(),
      }),
    )
    .min(1)
    .max(30),
  references: z
    .array(z.object({ label: line(200), url: z.url().max(500) }))
    .max(20)
    .default([]),
});

export const faqContent = z.object({
  question: line(200),
  answerParagraphs: z.array(line(3000)).min(1).max(10),
});

/** Only the page copy of a treatment is editable; name, URL and category stay in code. */
export const treatmentContent = z.object({
  metaTitle: line(70),
  metaDescription: line(170),
  summary: line(800),
  whoFor: z.array(line(300)).max(12),
  steps: z.array(z.object({ title: line(100), text: line(600) })).max(12),
  aftercare: z.array(line(300)).max(12),
  faqs: z.array(z.object({ q: line(200), a: line(1500) })).max(12),
});

export const CONTENT_SCHEMAS = {
  blog_post: blogPostContent,
  faq: faqContent,
  treatment: treatmentContent,
} as const;

export type BlogPostContent = z.infer<typeof blogPostContent>;
export type FaqContent = z.infer<typeof faqContent>;
export type TreatmentContent = z.infer<typeof treatmentContent>;
export type ContentData = BlogPostContent | FaqContent | TreatmentContent;

export const slugSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase words joined by hyphens');

export const contentCreateBody = z.object({
  type: z.enum(['blog_post', 'faq']),
  slug: slugSchema,
  data: z.record(z.string(), z.unknown()),
});

export const contentDraftBody = z.object({ data: z.record(z.string(), z.unknown()) });

export const contentReviewBody = z.object({
  decision: z.enum(['approve', 'changes']),
  note: z.string().trim().max(500).default(''),
});

export const DRAFT_STATUSES = ['editing', 'in_review', 'changes_requested', 'approved'] as const;
export type DraftStatus = (typeof DRAFT_STATUSES)[number];

/** The page title for any content entry (for lists and history). */
export function contentTitle(type: ContentType, data: unknown): string {
  const record = (data ?? {}) as Record<string, unknown>;
  const value =
    type === 'faq' ? record.question : type === 'blog_post' ? record.title : record.metaTitle;
  return typeof value === 'string' ? value : '';
}

export const slugify = (text: string) =>
  text
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 80);
