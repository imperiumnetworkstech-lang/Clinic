import type { BlogPostContent, ContentType, FaqContent, TreatmentContent } from '@edc/shared';
import clinicData from '../../../content/clinic.json';
import { apiOrigin } from './api.server';
import { posts as bundledPosts, type BlogPost } from './blog';
import { getTreatment, type Treatment } from './treatments';

/**
 * Published website content from the CMS (Admin → Content). Results are cached briefly in the
 * server process. If the API can't be reached, pages fall back to the copy bundled with the
 * site (content/*.json), so the public site never goes blank.
 */
interface Published<T> {
  slug: string;
  data: T;
  publishedAt: string;
  reviewed: boolean;
}

/** How long published content is reused before asking the API again (tests set 0). */
const TTL_MS = Number(process.env.CONTENT_CACHE_MS ?? 60_000);
const cache = new Map<ContentType, { at: number; value: Array<Published<unknown>> }>();

async function published<T>(type: ContentType): Promise<Array<Published<T>> | null> {
  const hit = cache.get(type);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as Array<Published<T>>;
  const origin = apiOrigin();
  if (!origin) return null;
  try {
    const response = await fetch(`${origin}/api/v1/public/content/${type}`, {
      signal: AbortSignal.timeout(2500),
    });
    if (!response.ok) return (hit?.value as Array<Published<T>> | undefined) ?? null;
    const value = (await response.json()) as Array<Published<T>>;
    cache.set(type, { at: Date.now(), value });
    return value;
  } catch {
    return (hit?.value as Array<Published<T>> | undefined) ?? null;
  }
}

/** Live blog articles, newest first. */
export async function loadPosts(): Promise<BlogPost[]> {
  const live = await published<BlogPostContent>('blog_post');
  const list: BlogPost[] = live
    ? live.map(({ slug, data }) => ({
        ...data,
        slug,
        legacyPath: bundledPosts.find((post) => post.slug === slug)?.legacyPath ?? '',
      }))
    : bundledPosts;
  return [...list].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

export async function loadFaqs(): Promise<FaqContent[]> {
  const live = await published<FaqContent>('faq');
  return live
    ? live.map(({ data }) => data)
    : clinicData.faqs.map((faq) => ({
        question: faq.question,
        answerParagraphs: faq.answerParagraphs,
      }));
}

/** A treatment page: structure from the code, copy from the CMS when it's available. */
export async function loadTreatment(slug: string | undefined): Promise<Treatment | undefined> {
  const base = getTreatment(slug);
  if (!base) return undefined;
  const live = await published<TreatmentContent>('treatment');
  const copy = live?.find((entry) => entry.slug === base.slug)?.data;
  return copy ? { ...base, ...copy } : base;
}
