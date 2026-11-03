import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_SCHEMAS, slugify, type ContentType } from '@edc/shared';
import { CmsEntry, CmsRevision } from '../../models/index.js';
import { sequelize } from '../sequelize.js';

const contentDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../../content',
);

const readJson = async <T>(file: string) =>
  JSON.parse(await readFile(path.join(contentDir, file), 'utf8')) as T;

interface Item {
  type: ContentType;
  slug: string;
  sortOrder: number;
  data: Record<string, unknown>;
}

/** The site's current content from content/*.json, in the CMS shape for each type. */
export async function bundledContent(): Promise<Item[]> {
  const blog = await readJson<{ posts: Array<Record<string, unknown> & { slug: string }> }>(
    'blog.json',
  );
  const clinic = await readJson<{ faqs: Array<{ question: string; answerParagraphs: string[] }> }>(
    'clinic.json',
  );
  const treatments = await readJson<{
    treatments: Array<Record<string, unknown> & { slug: string }>;
  }>('treatments.json');

  const items: Item[] = [
    ...blog.posts.map(({ slug, legacyPath: _legacy, ...data }, index) => ({
      type: 'blog_post' as const,
      slug,
      sortOrder: index,
      data,
    })),
    ...clinic.faqs.map((faq, index) => ({
      type: 'faq' as const,
      slug: slugify(faq.question),
      sortOrder: index,
      data: { question: faq.question, answerParagraphs: faq.answerParagraphs },
    })),
    ...treatments.treatments.map((treatment, index) => ({
      type: 'treatment' as const,
      slug: treatment.slug,
      sortOrder: index,
      data: {
        metaTitle: treatment.metaTitle,
        metaDescription: treatment.metaDescription,
        summary: treatment.summary,
        whoFor: treatment.whoFor,
        steps: treatment.steps,
        aftercare: treatment.aftercare,
        faqs: treatment.faqs,
      },
    })),
  ];
  return items.map((item) => ({ ...item, data: CONTENT_SCHEMAS[item.type].parse(item.data) }));
}

/**
 * Imports the bundled content as live entries the first time only, so later edits in the
 * admin are never overwritten. Imported copy is marked "not yet reviewed by a dentist".
 */
export async function importContent(): Promise<number> {
  const items = await bundledContent();
  let imported = 0;
  await sequelize.transaction(async (transaction) => {
    for (const item of items) {
      const [entry, created] = await CmsEntry.findOrCreate({
        where: { type: item.type, slug: item.slug },
        defaults: {
          type: item.type,
          slug: item.slug,
          sortOrder: item.sortOrder,
          publishedData: item.data,
          publishedAt: new Date(),
          publishedReviewed: false,
        },
        transaction,
      });
      if (!created) continue;
      imported += 1;
      await CmsRevision.create(
        { entryId: entry.id, action: 'imported', data: item.data, actorId: null },
        { transaction },
      );
    }
  });
  return imported;
}
