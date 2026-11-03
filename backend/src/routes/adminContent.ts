import {
  CONTENT_SCHEMAS,
  CONTENT_TYPES,
  contentCreateBody,
  contentDraftBody,
  contentReviewBody,
  contentTitle,
  type ContentType,
} from '@edc/shared';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { sequelize } from '../db/sequelize.js';
import { badRequest, HttpError, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import { CmsEntry, CmsRevision, User, type CmsAction } from '../models/index.js';
import { audit } from '../services/audit.js';

/**
 * Website content editing. Writers save drafts and submit them; a dentist (cms.review)
 * approves or asks for changes; the owner (cms.publish) publishes approved drafts. Nothing
 * medical reaches the public site without a dentist's approval.
 */
export const adminContentRouter = Router();

adminContentRouter.use(requireStaff);

function validData(type: ContentType, data: unknown) {
  const parsed = CONTENT_SCHEMAS[type].safeParse(data);
  if (!parsed.success) {
    throw badRequest(
      'invalid_content',
      'Some fields need attention.',
      parsed.error.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    );
  }
  return parsed.data as Record<string, unknown>;
}

async function findEntry(id: unknown) {
  const entry = await CmsEntry.findByPk(z.uuid().parse(id));
  if (!entry) throw notFound('content_not_found', 'Content not found.');
  return entry;
}

async function record(
  req: Request,
  entry: CmsEntry,
  action: CmsAction,
  extra: { data?: Record<string, unknown> | null; note?: string } = {},
) {
  await CmsRevision.create({
    entryId: entry.id,
    action,
    data: extra.data ?? null,
    note: extra.note ?? '',
    actorId: staffPrincipal(req).id,
  });
  await audit(req, {
    action: `content.${action}`,
    entity: 'cms_entry',
    entityId: entry.id,
    meta: { type: entry.type },
  });
}

function summary(entry: CmsEntry) {
  return {
    id: entry.id,
    type: entry.type,
    slug: entry.slug,
    title: contentTitle(entry.type, entry.draftData ?? entry.publishedData),
    sortOrder: entry.sortOrder,
    live: Boolean(entry.publishedData) && !entry.archived,
    archived: entry.archived,
    publishedAt: entry.publishedAt,
    publishedReviewed: entry.publishedReviewed,
    draftStatus: entry.draftStatus,
    draftUpdatedAt: entry.draftUpdatedAt,
    reviewNote: entry.reviewNote,
  };
}

const listQuery = z.object({ type: z.enum(CONTENT_TYPES).optional() });

adminContentRouter.get('/content', requirePermission('cms.write'), async (req, res) => {
  const { type } = listQuery.parse(req.query);
  const entries = await CmsEntry.findAll({
    where: type ? { type } : {},
    order: [
      ['type', 'ASC'],
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  res.json(entries.map(summary));
});

adminContentRouter.get('/content/:id', requirePermission('cms.write'), async (req, res) => {
  const entry = await findEntry(req.params.id);
  const revisions = await CmsRevision.findAll({
    where: { entryId: entry.id },
    include: [{ model: User, as: 'actor', attributes: ['id', 'name'] }],
    attributes: ['id', 'action', 'note', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 30,
  });
  res.json({
    ...summary(entry),
    publishedData: entry.publishedData,
    draftData: entry.draftData,
    history: revisions.map((revision) => ({
      id: revision.id,
      action: revision.action,
      note: revision.note,
      by: revision.actor?.name ?? 'System',
      at: revision.createdAt,
    })),
  });
});

/** New blog articles and FAQs start as drafts. Treatment pages are a fixed set. */
adminContentRouter.post('/content', requirePermission('cms.write'), async (req, res) => {
  const body = contentCreateBody.parse(req.body);
  const data = validData(body.type, body.data);
  if (await CmsEntry.findOne({ where: { type: body.type, slug: body.slug } })) {
    throw new HttpError(409, 'slug_taken', 'That web address is already used.');
  }
  const last = (await CmsEntry.max('sortOrder', { where: { type: body.type } })) as number | null;
  const entry = await CmsEntry.create({
    type: body.type,
    slug: body.slug,
    sortOrder: (last ?? -1) + 1,
    draftData: data,
    draftStatus: 'editing',
    draftUpdatedAt: new Date(),
    draftUpdatedBy: staffPrincipal(req).id,
  });
  await record(req, entry, 'created', { data });
  res.status(201).json({ id: entry.id });
});

adminContentRouter.put('/content/:id/draft', requirePermission('cms.write'), async (req, res) => {
  const entry = await findEntry(req.params.id);
  const data = validData(entry.type, contentDraftBody.parse(req.body).data);
  await entry.update({
    draftData: data,
    draftStatus: 'editing',
    draftUpdatedAt: new Date(),
    draftUpdatedBy: staffPrincipal(req).id,
    reviewNote: '',
    reviewedBy: null,
    reviewedAt: null,
  });
  await record(req, entry, 'saved', { data });
  res.json(summary(entry));
});

adminContentRouter.delete(
  '/content/:id/draft',
  requirePermission('cms.write'),
  async (req, res) => {
    const entry = await findEntry(req.params.id);
    if (!entry.draftData) throw badRequest('no_draft', 'There is no draft to discard.');
    if (!entry.publishedData) {
      throw badRequest('never_published', 'This item has never been published; keep editing it.');
    }
    await entry.update({ draftData: null, draftStatus: null, reviewNote: '' });
    await record(req, entry, 'discarded');
    res.json(summary(entry));
  },
);

adminContentRouter.post('/content/:id/submit', requirePermission('cms.write'), async (req, res) => {
  const entry = await findEntry(req.params.id);
  if (!entry.draftData || !['editing', 'changes_requested'].includes(entry.draftStatus ?? '')) {
    throw badRequest('nothing_to_submit', 'Save your changes before sending them for review.');
  }
  await entry.update({ draftStatus: 'in_review' });
  await record(req, entry, 'submitted');
  res.json(summary(entry));
});

adminContentRouter.post(
  '/content/:id/review',
  requirePermission('cms.review'),
  async (req, res) => {
    const { decision, note } = contentReviewBody.parse(req.body);
    const entry = await findEntry(req.params.id);
    if (entry.draftStatus !== 'in_review') {
      throw badRequest('not_in_review', 'This draft is not waiting for review.');
    }
    if (decision === 'changes' && !note) {
      throw badRequest('note_required', 'Say what needs to change.');
    }
    await entry.update({
      draftStatus: decision === 'approve' ? 'approved' : 'changes_requested',
      reviewNote: note,
      reviewedBy: staffPrincipal(req).id,
      reviewedAt: new Date(),
    });
    await record(req, entry, decision === 'approve' ? 'approved' : 'changes_requested', { note });
    res.json(summary(entry));
  },
);

/** A dentist confirms the copy that is already live (e.g. content imported before review). */
adminContentRouter.post(
  '/content/:id/approve-live',
  requirePermission('cms.review'),
  async (req, res) => {
    const entry = await findEntry(req.params.id);
    if (!entry.publishedData) throw badRequest('not_live', 'Nothing is live yet.');
    await entry.update({ publishedReviewed: true });
    await record(req, entry, 'live_approved');
    res.json(summary(entry));
  },
);

adminContentRouter.post(
  '/content/:id/publish',
  requirePermission('cms.publish'),
  async (req, res) => {
    const entry = await findEntry(req.params.id);
    if (!entry.draftData || entry.draftStatus !== 'approved') {
      throw badRequest('not_approved', 'A dentist must approve this draft before it’s published.');
    }
    const data = entry.draftData;
    await sequelize.transaction(async (transaction) => {
      await entry.update(
        {
          publishedData: data,
          publishedAt: new Date(),
          publishedBy: staffPrincipal(req).id,
          publishedReviewed: true,
          archived: false,
          draftData: null,
          draftStatus: null,
          reviewNote: '',
        },
        { transaction },
      );
    });
    await record(req, entry, 'published', { data });
    res.json(summary(entry));
  },
);

adminContentRouter.post(
  '/content/:id/unpublish',
  requirePermission('cms.publish'),
  async (req, res) => {
    const entry = await findEntry(req.params.id);
    if (entry.type === 'treatment') {
      throw badRequest('cannot_unpublish', 'Treatment pages stay live; edit their copy instead.');
    }
    if (!entry.publishedData || entry.archived) throw badRequest('not_live', 'This isn’t live.');
    await entry.update({ archived: true });
    await record(req, entry, 'unpublished');
    res.json(summary(entry));
  },
);

adminContentRouter.post(
  '/content/:id/restore',
  requirePermission('cms.publish'),
  async (req, res) => {
    const entry = await findEntry(req.params.id);
    if (!entry.archived) throw badRequest('not_archived', 'This is already live.');
    await entry.update({ archived: false });
    await record(req, entry, 'restored');
    res.json(summary(entry));
  },
);

/** Public read of live content for the website. Short shared caching; never drafts. */
export const publicContentRouter = Router();

publicContentRouter.get('/content/:type', async (req, res) => {
  const type = z.enum(CONTENT_TYPES).parse(req.params.type);
  const entries = await CmsEntry.findAll({
    where: { type, archived: false },
    attributes: ['slug', 'sortOrder', 'publishedData', 'publishedAt', 'publishedReviewed'],
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
  });
  res.set('Cache-Control', 'public, max-age=60, s-maxage=300, stale-while-revalidate=600');
  res.json(
    entries
      .filter((entry) => entry.publishedData)
      .map((entry) => ({
        slug: entry.slug,
        data: entry.publishedData,
        publishedAt: entry.publishedAt,
        reviewed: entry.publishedReviewed,
      })),
  );
});
