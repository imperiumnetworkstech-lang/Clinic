import { beforeAll, describe, expect, it } from 'vitest';
import { api, loginWithEnrolment, loginWithoutMfa } from './helpers.js';

type Session = Pick<Awaited<ReturnType<typeof loginWithoutMfa>>, 'client' | 'accessToken'>;
const bearer = (session: { accessToken: string }) => `Bearer ${session.accessToken}`;

let doctor: Session;
let owner: Session;
let desk: Session;

beforeAll(async () => {
  doctor = await loginWithEnrolment('doctor');
  owner = await loginWithEnrolment('super_admin');
  desk = await loginWithoutMfa('receptionist');
});

const publicList = async (type: string) =>
  (await api().get(`/api/v1/public/content/${type}`)).body as Array<{
    slug: string;
    data: Record<string, unknown>;
    reviewed: boolean;
  }>;

const article = (title: string) => ({
  title,
  metaTitle: `${title} | Expressions Dental`,
  metaDescription: 'A short guide written for the clinic’s patients.',
  excerpt: 'What to expect and how to look after your teeth.',
  category: 'Everyday care',
  publishedAt: '2026-11-03',
  relatedTreatments: ['tooth-scaling'],
  sections: [{ heading: 'Why it matters', paragraphs: ['Clean teeth stay healthy.'] }],
  references: [],
});

describe('content import', () => {
  it('publishes the bundled site content, marked as not yet reviewed', async () => {
    const [blog, faqs, treatments] = await Promise.all([
      publicList('blog_post'),
      publicList('faq'),
      publicList('treatment'),
    ]);
    expect(blog).toHaveLength(3);
    expect(faqs).toHaveLength(15);
    expect(treatments).toHaveLength(18);
    expect(treatments.find((t) => t.slug === 'root-canal-treatment')?.data.summary).toMatch(/pulp/);
    expect(blog.every((post) => post.reviewed === false)).toBe(true);
  });
});

describe('editorial workflow', () => {
  it('needs a dentist’s approval and the owner to publish a new article', async () => {
    const created = await doctor.client
      .post('/api/v1/admin/content')
      .set('Authorization', bearer(doctor))
      .send({
        type: 'blog_post',
        slug: 'demo-flossing-guide',
        data: article('Demo flossing guide'),
      });
    expect(created.status).toBe(201);
    const id = created.body.id as string;
    expect((await publicList('blog_post')).map((p) => p.slug)).not.toContain('demo-flossing-guide');

    const early = await owner.client
      .post(`/api/v1/admin/content/${id}/publish`)
      .set('Authorization', bearer(owner));
    expect(early.body.code).toBe('not_approved');

    await doctor.client
      .post(`/api/v1/admin/content/${id}/submit`)
      .set('Authorization', bearer(doctor))
      .expect(200);
    const noNote = await doctor.client
      .post(`/api/v1/admin/content/${id}/review`)
      .set('Authorization', bearer(doctor))
      .send({ decision: 'changes' });
    expect(noNote.body.code).toBe('note_required');
    await doctor.client
      .post(`/api/v1/admin/content/${id}/review`)
      .set('Authorization', bearer(doctor))
      .send({ decision: 'approve' })
      .expect(200);

    const doctorPublish = await doctor.client
      .post(`/api/v1/admin/content/${id}/publish`)
      .set('Authorization', bearer(doctor));
    expect(doctorPublish.status).toBe(403);

    const published = await owner.client
      .post(`/api/v1/admin/content/${id}/publish`)
      .set('Authorization', bearer(owner));
    expect(published.body).toMatchObject({
      live: true,
      publishedReviewed: true,
      draftStatus: null,
    });
    const live = (await publicList('blog_post')).find((p) => p.slug === 'demo-flossing-guide');
    expect(live?.reviewed).toBe(true);

    const detail = await owner.client
      .get(`/api/v1/admin/content/${id}`)
      .set('Authorization', bearer(owner));
    expect(detail.body.history.map((h: { action: string }) => h.action)).toEqual([
      'published',
      'approved',
      'submitted',
      'created',
    ]);

    await owner.client
      .post(`/api/v1/admin/content/${id}/unpublish`)
      .set('Authorization', bearer(owner))
      .expect(200);
    expect((await publicList('blog_post')).map((p) => p.slug)).not.toContain('demo-flossing-guide');
    await owner.client
      .post(`/api/v1/admin/content/${id}/restore`)
      .set('Authorization', bearer(owner))
      .expect(200);
  });

  it('keeps the live treatment copy until an edited draft is approved and published', async () => {
    const list = await doctor.client
      .get('/api/v1/admin/content?type=treatment')
      .set('Authorization', bearer(doctor));
    const entry = list.body.find((e: { slug: string }) => e.slug === 'teeth-whitening');
    const detail = await doctor.client
      .get(`/api/v1/admin/content/${entry.id}`)
      .set('Authorization', bearer(doctor));
    const live = detail.body.publishedData as Record<string, unknown>;

    const invalid = await doctor.client
      .put(`/api/v1/admin/content/${entry.id}/draft`)
      .set('Authorization', bearer(doctor))
      .send({ data: { ...live, summary: '' } });
    expect(invalid.status).toBe(400);
    expect(invalid.body.details[0].path).toBe('summary');

    await doctor.client
      .put(`/api/v1/admin/content/${entry.id}/draft`)
      .set('Authorization', bearer(doctor))
      .send({ data: { ...live, summary: 'Demo edited summary for review.' } })
      .expect(200);
    const stillLive = (await publicList('treatment')).find((t) => t.slug === 'teeth-whitening');
    expect(stillLive?.data.summary).toBe(live.summary);

    const unpublish = await owner.client
      .post(`/api/v1/admin/content/${entry.id}/unpublish`)
      .set('Authorization', bearer(owner));
    expect(unpublish.body.code).toBe('cannot_unpublish');

    await doctor.client
      .delete(`/api/v1/admin/content/${entry.id}/draft`)
      .set('Authorization', bearer(doctor))
      .expect(200);
  });

  it('lets a dentist approve copy that is already live', async () => {
    const list = await doctor.client
      .get('/api/v1/admin/content?type=faq')
      .set('Authorization', bearer(doctor));
    const first = list.body[0];
    expect(first.publishedReviewed).toBe(false);
    const approved = await doctor.client
      .post(`/api/v1/admin/content/${first.id}/approve-live`)
      .set('Authorization', bearer(doctor));
    expect(approved.body.publishedReviewed).toBe(true);
  });

  it('keeps the editor away from staff without content rights', async () => {
    const res = await desk.client.get('/api/v1/admin/content').set('Authorization', bearer(desk));
    expect(res.status).toBe(403);
  });
});
