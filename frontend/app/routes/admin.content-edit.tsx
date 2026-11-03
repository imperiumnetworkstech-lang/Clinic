import { CONTENT_TYPE_LABELS, slugify } from '@edc/shared';
import { ArrowLeft, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { contentBadges, HISTORY_LABELS } from '../components/admin/contentStatus';
import { AdminShell } from '../components/AdminShell';
import { Button } from '../components/ui/Button';
import { Badge, Skeleton } from '../components/ui/primitives';
import { ApiError, contentApi, type ContentDetail, type ContentKind } from '../lib/admin-api';
import { cn } from '../lib/cn';
import { treatments } from '../lib/treatments';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Edit content | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

/* ------------------------------------------------------------------ form <-> data */

const toParagraphs = (text: string) =>
  text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
const toLines = (text: string) =>
  text
    .split('\n')
    .map((part) => part.trim())
    .filter(Boolean);
const strings = (value: unknown) => (Array.isArray(value) ? (value as string[]) : []);
const text = (value: unknown) => (typeof value === 'string' ? value : '');

interface BlogForm {
  kind: 'blog_post';
  title: string;
  metaTitle: string;
  metaDescription: string;
  excerpt: string;
  category: string;
  publishedAt: string;
  relatedTreatments: string[];
  sections: Array<{ heading: string; paragraphs: string; list: string }>;
  references: string;
}
interface FaqForm {
  kind: 'faq';
  question: string;
  answer: string;
}
interface TreatmentForm {
  kind: 'treatment';
  metaTitle: string;
  metaDescription: string;
  summary: string;
  whoFor: string;
  steps: Array<{ title: string; text: string }>;
  aftercare: string;
  faqs: Array<{ q: string; a: string }>;
}
type Form = BlogForm | FaqForm | TreatmentForm;
/** Any field of any form (the forms share no conflicting names apart from `kind`). */
type FormPatch = Partial<
  Omit<BlogForm, 'kind'> & Omit<FaqForm, 'kind'> & Omit<TreatmentForm, 'kind'>
>;

const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());

function toForm(kind: ContentKind, data: Record<string, unknown> | null): Form {
  const d = data ?? {};
  if (kind === 'faq') {
    return { kind, question: text(d.question), answer: strings(d.answerParagraphs).join('\n\n') };
  }
  if (kind === 'treatment') {
    return {
      kind,
      metaTitle: text(d.metaTitle),
      metaDescription: text(d.metaDescription),
      summary: text(d.summary),
      whoFor: strings(d.whoFor).join('\n'),
      steps: (d.steps as TreatmentForm['steps'] | undefined) ?? [],
      aftercare: strings(d.aftercare).join('\n'),
      faqs: (d.faqs as TreatmentForm['faqs'] | undefined) ?? [],
    };
  }
  const sections =
    (d.sections as
      Array<{ heading: string; paragraphs?: string[]; list?: string[] }> | undefined) ?? [];
  const references = (d.references as Array<{ label: string; url: string }> | undefined) ?? [];
  return {
    kind,
    title: text(d.title),
    metaTitle: text(d.metaTitle),
    metaDescription: text(d.metaDescription),
    excerpt: text(d.excerpt),
    category: text(d.category) || 'Everyday care',
    publishedAt: text(d.publishedAt) || today(),
    relatedTreatments: strings(d.relatedTreatments),
    sections: sections.length
      ? sections.map((section) => ({
          heading: section.heading,
          paragraphs: (section.paragraphs ?? []).join('\n\n'),
          list: (section.list ?? []).join('\n'),
        }))
      : [{ heading: '', paragraphs: '', list: '' }],
    references: references.map((ref) => `${ref.label} | ${ref.url}`).join('\n'),
  };
}

function toData(form: Form): Record<string, unknown> {
  if (form.kind === 'faq')
    return { question: form.question, answerParagraphs: toParagraphs(form.answer) };
  if (form.kind === 'treatment') {
    return {
      metaTitle: form.metaTitle,
      metaDescription: form.metaDescription,
      summary: form.summary,
      whoFor: toLines(form.whoFor),
      steps: form.steps.filter((step) => step.title || step.text),
      aftercare: toLines(form.aftercare),
      faqs: form.faqs.filter((faq) => faq.q || faq.a),
    };
  }
  return {
    title: form.title,
    metaTitle: form.metaTitle,
    metaDescription: form.metaDescription,
    excerpt: form.excerpt,
    category: form.category,
    publishedAt: form.publishedAt,
    relatedTreatments: form.relatedTreatments,
    sections: form.sections.map((section) => {
      const paragraphs = toParagraphs(section.paragraphs);
      const list = toLines(section.list);
      return {
        heading: section.heading,
        ...(paragraphs.length ? { paragraphs } : {}),
        ...(list.length ? { list } : {}),
      };
    }),
    references: toLines(form.references).map((row) => {
      const [label = '', url = ''] = row.split('|').map((part) => part.trim());
      return { label, url };
    }),
  };
}

/* ------------------------------------------------------------------ inputs */

const inputClass =
  'mt-1 block w-full rounded-xl bg-white px-3 py-2 ring-1 ring-neutral-300 outline-none focus:ring-2 focus:ring-secondary-500 disabled:bg-neutral-50';

function Field({
  label,
  hint,
  value,
  onChange,
  max,
  rows,
  disabled,
  type = 'text',
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (value: string) => void;
  max?: number;
  rows?: number;
  disabled?: boolean;
  type?: string;
}) {
  const over = max !== undefined && value.length > max;
  return (
    <label className="block text-sm font-semibold">
      <span className="flex justify-between gap-3">
        {label}
        {max !== undefined && (
          <span className={cn('font-normal tabular-nums', over ? 'text-[#B60411]' : 'text-muted')}>
            {value.length}/{max}
          </span>
        )}
      </span>
      {hint && <span className="block font-normal text-muted">{hint}</span>}
      {rows ? (
        <textarea
          rows={rows}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'font-normal')}
        />
      ) : (
        <input
          type={type}
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
          className={cn(inputClass, 'min-h-11 font-normal')}
        />
      )}
    </label>
  );
}

function Group({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <fieldset className="space-y-4 rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{title}</h2>
        {action}
      </div>
      {children}
    </fieldset>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full text-neutral-600 hover:bg-neutral-100"
    >
      <Trash2 size={18} />
    </button>
  );
}

function SeoFields({
  form,
  set,
  disabled,
}: {
  form: BlogForm | TreatmentForm;
  set: (patch: FormPatch) => void;
  disabled: boolean;
}) {
  return (
    <Group title="Search engines">
      <Field
        label="Page title in Google"
        max={70}
        value={form.metaTitle}
        onChange={(metaTitle) => set({ metaTitle })}
        disabled={disabled}
      />
      <Field
        label="Description in Google"
        max={170}
        rows={2}
        value={form.metaDescription}
        onChange={(metaDescription) => set({ metaDescription })}
        disabled={disabled}
      />
    </Group>
  );
}

function BlogFields({
  form,
  set,
  disabled,
}: {
  form: BlogForm;
  set: (patch: FormPatch) => void;
  disabled: boolean;
}) {
  const setSection = (index: number, patch: Partial<BlogForm['sections'][number]>) =>
    set({
      sections: form.sections.map((section, i) =>
        i === index ? { ...section, ...patch } : section,
      ),
    });
  return (
    <>
      <Group title="Article">
        <Field
          label="Title"
          max={140}
          value={form.title}
          onChange={(title) => set({ title })}
          disabled={disabled}
        />
        <Field
          label="Introduction"
          hint="Shown under the title and on the blog list."
          max={400}
          rows={3}
          value={form.excerpt}
          onChange={(excerpt) => set({ excerpt })}
          disabled={disabled}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Category"
            max={60}
            value={form.category}
            onChange={(category) => set({ category })}
            disabled={disabled}
          />
          <Field
            label="Date shown"
            type="date"
            value={form.publishedAt}
            onChange={(publishedAt) => set({ publishedAt })}
            disabled={disabled}
          />
        </div>
      </Group>
      <Group
        title="Sections"
        action={
          !disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                set({ sections: [...form.sections, { heading: '', paragraphs: '', list: '' }] })
              }
            >
              <Plus size={16} />
              Add section
            </Button>
          )
        }
      >
        {form.sections.map((section, index) => (
          <div key={index} className="space-y-3 rounded-2xl bg-surface p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Field
                  label={`Section ${index + 1} heading`}
                  max={140}
                  value={section.heading}
                  onChange={(heading) => setSection(index, { heading })}
                  disabled={disabled}
                />
              </div>
              {!disabled && form.sections.length > 1 && (
                <RemoveButton
                  label={`Remove section ${index + 1}`}
                  onClick={() => set({ sections: form.sections.filter((_, i) => i !== index) })}
                />
              )}
            </div>
            <Field
              label="Paragraphs"
              hint="Leave a blank line between paragraphs."
              rows={6}
              value={section.paragraphs}
              onChange={(paragraphs) => setSection(index, { paragraphs })}
              disabled={disabled}
            />
            <Field
              label="Bullet points (optional)"
              hint="One per line."
              rows={3}
              value={section.list}
              onChange={(list) => setSection(index, { list })}
              disabled={disabled}
            />
          </div>
        ))}
      </Group>
      <Group title="Related and sources">
        <fieldset>
          <legend className="text-sm font-semibold">Related treatments (up to 6)</legend>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {treatments.map((treatment) => {
              const checked = form.relatedTreatments.includes(treatment.slug);
              return (
                <label key={treatment.slug} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || (!checked && form.relatedTreatments.length >= 6)}
                    onChange={() =>
                      set({
                        relatedTreatments: checked
                          ? form.relatedTreatments.filter((slug) => slug !== treatment.slug)
                          : [...form.relatedTreatments, treatment.slug],
                      })
                    }
                    className="size-5 accent-primary-600"
                  />
                  {treatment.name}
                </label>
              );
            })}
          </div>
        </fieldset>
        <Field
          label="References"
          hint="One per line: Source name | https://link"
          rows={3}
          value={form.references}
          onChange={(references) => set({ references })}
          disabled={disabled}
        />
      </Group>
      <SeoFields form={form} set={set} disabled={disabled} />
    </>
  );
}

function TreatmentFields({
  form,
  set,
  disabled,
}: {
  form: TreatmentForm;
  set: (patch: FormPatch) => void;
  disabled: boolean;
}) {
  return (
    <>
      <Group title="Page copy">
        <Field
          label="Summary"
          hint="The introduction at the top of the page."
          max={800}
          rows={4}
          value={form.summary}
          onChange={(summary) => set({ summary })}
          disabled={disabled}
        />
        <Field
          label="Who it’s for"
          hint="One point per line."
          rows={5}
          value={form.whoFor}
          onChange={(whoFor) => set({ whoFor })}
          disabled={disabled}
        />
        <Field
          label="Aftercare"
          hint="One point per line."
          rows={4}
          value={form.aftercare}
          onChange={(aftercare) => set({ aftercare })}
          disabled={disabled}
        />
      </Group>
      <Group
        title="What happens, step by step"
        action={
          !disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ steps: [...form.steps, { title: '', text: '' }] })}
            >
              <Plus size={16} />
              Add step
            </Button>
          )
        }
      >
        {form.steps.map((step, index) => (
          <div key={index} className="flex items-start gap-2 rounded-2xl bg-surface p-4">
            <div className="flex-1 space-y-3">
              <Field
                label={`Step ${index + 1}`}
                max={100}
                value={step.title}
                onChange={(title) =>
                  set({ steps: form.steps.map((s, i) => (i === index ? { ...s, title } : s)) })
                }
                disabled={disabled}
              />
              <Field
                label="What happens"
                max={600}
                rows={2}
                value={step.text}
                onChange={(value) =>
                  set({
                    steps: form.steps.map((s, i) => (i === index ? { ...s, text: value } : s)),
                  })
                }
                disabled={disabled}
              />
            </div>
            {!disabled && (
              <RemoveButton
                label={`Remove step ${index + 1}`}
                onClick={() => set({ steps: form.steps.filter((_, i) => i !== index) })}
              />
            )}
          </div>
        ))}
      </Group>
      <Group
        title="Questions on this page"
        action={
          !disabled && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => set({ faqs: [...form.faqs, { q: '', a: '' }] })}
            >
              <Plus size={16} />
              Add question
            </Button>
          )
        }
      >
        {form.faqs.map((faq, index) => (
          <div key={index} className="flex items-start gap-2 rounded-2xl bg-surface p-4">
            <div className="flex-1 space-y-3">
              <Field
                label={`Question ${index + 1}`}
                max={200}
                value={faq.q}
                onChange={(q) =>
                  set({ faqs: form.faqs.map((f, i) => (i === index ? { ...f, q } : f)) })
                }
                disabled={disabled}
              />
              <Field
                label="Answer"
                max={1500}
                rows={3}
                value={faq.a}
                onChange={(a) =>
                  set({ faqs: form.faqs.map((f, i) => (i === index ? { ...f, a } : f)) })
                }
                disabled={disabled}
              />
            </div>
            {!disabled && (
              <RemoveButton
                label={`Remove question ${index + 1}`}
                onClick={() => set({ faqs: form.faqs.filter((_, i) => i !== index) })}
              />
            )}
          </div>
        ))}
      </Group>
      <SeoFields form={form} set={set} disabled={disabled} />
    </>
  );
}

/* ------------------------------------------------------------------ page */

const livePath = (entry: { type: ContentKind; slug: string }) =>
  entry.type === 'blog_post'
    ? `/blog/${entry.slug}`
    : entry.type === 'treatment'
      ? `/treatments/${entry.slug}`
      : '/faq';

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

export default function AdminContentEdit() {
  const { id = 'new' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { me, can, problem } = useStaff();
  const isNew = id === 'new';
  const newKind: ContentKind = params.get('type') === 'faq' ? 'faq' : 'blog_post';

  const [entry, setEntry] = useState<ContentDetail | null>(null);
  const [form, setForm] = useState<Form | null>(isNew ? toForm(newKind, null) : null);
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (isNew) return;
    try {
      const detail = await contentApi.get(id);
      setEntry(detail);
      setForm(toForm(detail.type, detail.draftData ?? detail.publishedData));
    } catch (caught) {
      setErrors([problem(caught, 'Could not load this content.')]);
    }
  }, [id, isNew, problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const kind: ContentKind = entry?.type ?? newKind;
  const base = entry ? (entry.draftData ?? entry.publishedData) : null;
  const dirty = useMemo(
    () =>
      form
        ? JSON.stringify(toData(form)) !== JSON.stringify(base ? toData(toForm(kind, base)) : null)
        : false,
    [form, base, kind],
  );
  const canWrite = can('cms.write');
  const editable = canWrite && entry?.draftStatus !== 'in_review';

  const set = (patch: FormPatch) =>
    setForm((current) => (current ? ({ ...current, ...patch } as Form) : current));

  const run = async (action: () => Promise<unknown>, done: string) => {
    setBusy(true);
    setErrors([]);
    setMessage('');
    try {
      await action();
      setMessage(done);
      await load();
    } catch (caught) {
      setErrors(
        caught instanceof ApiError && caught.fieldErrors.length
          ? caught.fieldErrors.map((issue) => `${issue.path || 'Form'}: ${issue.message}`)
          : [problem(caught, 'Something went wrong.')],
      );
    } finally {
      setBusy(false);
    }
  };

  const save = () => {
    if (!form) return Promise.resolve();
    if (isNew) {
      return run(async () => {
        const title =
          form.kind === 'faq' ? form.question : form.kind === 'blog_post' ? form.title : '';
        const created = await contentApi.create(
          kind as 'blog_post' | 'faq',
          slug || slugify(title),
          toData(form),
        );
        navigate(`/admin/content/${created.id}`, { replace: true });
      }, 'Draft created.');
    }
    return run(
      () => contentApi.saveDraft(id, toData(form)),
      'Draft saved. The live page hasn’t changed.',
    );
  };

  const title =
    form?.kind === 'faq'
      ? form.question
      : form?.kind === 'blog_post'
        ? form.title
        : (entry?.title ?? '');
  const autoSlug = slugTouched ? slug : slugify(title);

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <Link
          to="/admin/content"
          className="inline-flex min-h-11 items-center gap-2 font-semibold text-link hover:underline"
        >
          <ArrowLeft size={18} />
          All content
        </Link>

        {!form ? (
          <Skeleton className="mt-4 h-60 rounded-3xl" />
        ) : (
          <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_20rem]">
            <div className="space-y-6">
              <header>
                <p className="text-sm text-muted">{CONTENT_TYPE_LABELS[kind]}</p>
                <h1 className="text-2xl font-bold sm:text-3xl">
                  {title ||
                    (isNew ? `New ${CONTENT_TYPE_LABELS[kind].toLowerCase()}` : entry?.slug)}
                </h1>
                {entry && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {contentBadges(entry).map((badge) => (
                      <Badge key={badge.label} tone={badge.tone}>
                        {badge.label}
                      </Badge>
                    ))}
                  </div>
                )}
                {entry?.draftStatus === 'changes_requested' && entry.reviewNote && (
                  <p className="mt-4 rounded-2xl bg-[#FFF5EA] p-4 text-[#6A4100]">
                    <strong>Dentist’s note:</strong> {entry.reviewNote}
                  </p>
                )}
                {entry?.draftStatus === 'in_review' && (
                  <p className="mt-4 rounded-2xl bg-surface p-4 text-muted">
                    This draft is with a dentist for review, so it can’t be edited right now.
                  </p>
                )}
              </header>

              {isNew && (
                <Group title="Web address">
                  <Field
                    label="Address"
                    hint={
                      kind === 'blog_post'
                        ? `expressionsdentalclinic.com/blog/${autoSlug || '…'}`
                        : 'Used to identify the question.'
                    }
                    value={autoSlug}
                    onChange={(value) => {
                      setSlugTouched(true);
                      setSlug(slugify(value));
                    }}
                  />
                </Group>
              )}

              {form.kind === 'faq' && (
                <Group title="Question">
                  <Field
                    label="Question"
                    max={200}
                    value={form.question}
                    onChange={(question) => set({ question })}
                    disabled={!editable}
                  />
                  <Field
                    label="Answer"
                    hint="Leave a blank line between paragraphs."
                    rows={8}
                    value={form.answer}
                    onChange={(answer) => set({ answer })}
                    disabled={!editable}
                  />
                </Group>
              )}
              {form.kind === 'blog_post' && (
                <BlogFields form={form} set={set} disabled={!editable} />
              )}
              {form.kind === 'treatment' && (
                <TreatmentFields form={form} set={set} disabled={!editable} />
              )}
            </div>

            <aside className="space-y-4 lg:sticky lg:top-32 lg:self-start">
              <section className="space-y-3 rounded-3xl bg-white p-5 ring-1 ring-neutral-200">
                <h2 className="font-bold">Actions</h2>
                {message && (
                  <p
                    role="status"
                    className="rounded-2xl bg-[#E8F7EE] p-3 text-sm font-medium text-[#0B5E31]"
                  >
                    {message}
                  </p>
                )}
                {errors.length > 0 && (
                  <ul
                    role="alert"
                    className="space-y-1 rounded-2xl bg-[#FEF4F3] p-3 text-sm font-medium text-[#92020B]"
                  >
                    {errors.map((error) => (
                      <li key={error}>{error}</li>
                    ))}
                  </ul>
                )}

                {editable && (
                  <Button
                    className="w-full"
                    disabled={busy || (!dirty && !isNew)}
                    onClick={() => void save()}
                  >
                    {isNew ? 'Create draft' : 'Save draft'}
                  </Button>
                )}
                {entry &&
                  canWrite &&
                  entry.draftData &&
                  ['editing', 'changes_requested'].includes(entry.draftStatus ?? '') && (
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={busy || dirty}
                      onClick={() =>
                        void run(() => contentApi.submit(entry.id), 'Sent to a dentist for review.')
                      }
                    >
                      Send for review
                    </Button>
                  )}
                {dirty && entry?.draftData && (
                  <p className="text-sm text-muted">
                    Save your changes before sending them for review.
                  </p>
                )}

                {entry && can('cms.review') && entry.draftStatus === 'in_review' && (
                  <div className="space-y-2 rounded-2xl bg-surface p-3">
                    <p className="text-sm font-semibold">Dentist review</p>
                    <Button
                      className="w-full"
                      disabled={busy}
                      onClick={() =>
                        void run(
                          () => contentApi.review(entry.id, 'approve', note),
                          'Approved. The owner can now publish it.',
                        )
                      }
                    >
                      Approve
                    </Button>
                    <label className="block text-sm font-semibold">
                      What needs to change?
                      <textarea
                        rows={3}
                        maxLength={500}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        className={inputClass}
                      />
                    </label>
                    <Button
                      className="w-full"
                      variant="secondary"
                      disabled={busy || !note.trim()}
                      onClick={() =>
                        void run(
                          () => contentApi.review(entry.id, 'changes', note),
                          'Sent back with your note.',
                        )
                      }
                    >
                      Ask for changes
                    </Button>
                  </div>
                )}

                {entry && can('cms.publish') && entry.draftStatus === 'approved' && (
                  <Button
                    className="w-full"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => contentApi.publish(entry.id),
                        'Published. The website shows it within a few minutes.',
                      )
                    }
                  >
                    Publish
                  </Button>
                )}
                {entry && can('cms.review') && entry.live && !entry.publishedReviewed && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(
                        () => contentApi.approveLive(entry.id),
                        'Live copy marked as reviewed.',
                      )
                    }
                  >
                    Approve the live copy as it is
                  </Button>
                )}
                {entry &&
                  canWrite &&
                  entry.draftData &&
                  entry.publishedData &&
                  entry.draftStatus !== 'in_review' && (
                    <Button
                      className="w-full"
                      variant="ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(() => contentApi.discard(entry.id), 'Draft discarded.')
                      }
                    >
                      Discard draft
                    </Button>
                  )}
                {entry && can('cms.publish') && entry.type !== 'treatment' && entry.live && (
                  <Button
                    className="w-full"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      void run(() => contentApi.unpublish(entry.id), 'Taken off the website.')
                    }
                  >
                    Unpublish
                  </Button>
                )}
                {entry && can('cms.publish') && entry.archived && (
                  <Button
                    className="w-full"
                    variant="secondary"
                    disabled={busy}
                    onClick={() =>
                      void run(() => contentApi.restore(entry.id), 'Back on the website.')
                    }
                  >
                    Put back live
                  </Button>
                )}
                {entry?.live && (
                  <a
                    href={livePath(entry)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-link hover:underline"
                  >
                    <ExternalLink size={16} />
                    View the live page
                  </a>
                )}
              </section>

              {entry && (
                <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200">
                  <h2 className="font-bold">History</h2>
                  <ol className="mt-3 space-y-3 text-sm">
                    {entry.history.map((event) => (
                      <li key={event.id}>
                        <p className="font-semibold">
                          {HISTORY_LABELS[event.action] ?? event.action}
                        </p>
                        <p className="text-muted">
                          {event.by} · {when(event.at)}
                        </p>
                        {event.note && <p className="mt-1 text-muted">“{event.note}”</p>}
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </aside>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
