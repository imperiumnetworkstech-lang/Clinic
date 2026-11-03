import { CONTENT_TYPE_LABELS } from '@edc/shared';
import { ChevronRight, FilePlus2, Newspaper } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { contentBadges } from '../components/admin/contentStatus';
import { AdminShell } from '../components/AdminShell';
import { ButtonLink } from '../components/ui/Button';
import { Badge, EmptyState, Skeleton } from '../components/ui/primitives';
import { contentApi, type ContentKind, type ContentSummary } from '../lib/admin-api';
import { cn } from '../lib/cn';
import { container } from '../lib/ui';
import { useStaff } from '../lib/use-staff';

export function meta() {
  return [
    { title: 'Website content | Expressions Dental admin' },
    { name: 'robots', content: 'noindex, nofollow' },
  ];
}

const TABS: Array<{ value: ContentKind | 'attention'; label: string }> = [
  { value: 'attention', label: 'Needs attention' },
  { value: 'blog_post', label: 'Blog' },
  { value: 'faq', label: 'FAQs' },
  { value: 'treatment', label: 'Treatment pages' },
];

const needsAttention = (entry: ContentSummary) =>
  (entry.live && !entry.publishedReviewed) ||
  entry.draftStatus === 'in_review' ||
  entry.draftStatus === 'approved' ||
  entry.draftStatus === 'changes_requested';

/** Blog articles, FAQs and treatment page copy, with their review and publishing state. */
export default function AdminContent() {
  const { me, can, problem } = useStaff();
  const [params, setParams] = useSearchParams();
  const tab = (params.get('tab') as (typeof TABS)[number]['value'] | null) ?? 'attention';
  const [entries, setEntries] = useState<ContentSummary[] | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setEntries(await contentApi.list());
    } catch (caught) {
      setError(problem(caught));
      setEntries([]);
    }
  }, [problem]);

  useEffect(() => {
    if (me) void load();
  }, [me, load]);

  const shown =
    entries?.filter((entry) =>
      tab === 'attention' ? needsAttention(entry) : entry.type === tab,
    ) ?? null;
  const counts = (value: (typeof TABS)[number]['value']) =>
    entries?.filter((entry) =>
      value === 'attention' ? needsAttention(entry) : entry.type === value,
    ).length ?? 0;

  return (
    <AdminShell me={me}>
      <main className={`${container} py-8`}>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">Website content</h1>
            <p className="mt-1 max-w-2xl text-muted">
              Edits are saved as drafts. A dentist approves medical content before the owner
              publishes it; the live page doesn’t change until then.
            </p>
          </div>
          {can('cms.write') && (
            <div className="flex flex-wrap gap-2">
              <ButtonLink href="/admin/content/new?type=blog_post" size="sm">
                <FilePlus2 size={16} />
                New article
              </ButtonLink>
              <ButtonLink href="/admin/content/new?type=faq" size="sm" variant="secondary">
                <FilePlus2 size={16} />
                New FAQ
              </ButtonLink>
            </div>
          )}
        </div>

        <div
          className="mt-6 flex gap-2 overflow-x-auto pb-1"
          role="tablist"
          aria-label="Content type"
        >
          {TABS.map((entry) => (
            <button
              key={entry.value}
              type="button"
              role="tab"
              aria-selected={tab === entry.value}
              onClick={() => setParams({ tab: entry.value }, { replace: true })}
              className={cn(
                'min-h-11 shrink-0 rounded-full px-4 font-semibold ring-1 transition',
                tab === entry.value
                  ? 'bg-neutral-950 text-white ring-neutral-950'
                  : 'bg-white ring-neutral-200 hover:bg-neutral-50',
              )}
            >
              {entry.label}
              {entries && <span className="ml-1.5 opacity-70">{counts(entry.value)}</span>}
            </button>
          ))}
        </div>

        {error && (
          <p role="alert" className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]">
            {error}
          </p>
        )}

        <ul className="mt-6 divide-y divide-neutral-200 overflow-hidden rounded-3xl bg-white ring-1 ring-neutral-200">
          {shown === null && (
            <li className="p-5">
              <Skeleton className="h-10 w-full" />
            </li>
          )}
          {shown?.map((entry) => (
            <li key={entry.id}>
              <Link
                to={`/admin/content/${entry.id}`}
                className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-neutral-50 sm:px-6"
              >
                <span className="min-w-0 flex-1 basis-60">
                  <span className="block font-semibold">{entry.title || entry.slug}</span>
                  <span className="block text-sm text-muted">
                    {CONTENT_TYPE_LABELS[entry.type]} · {entry.slug}
                  </span>
                  {entry.draftStatus === 'changes_requested' && entry.reviewNote && (
                    <span className="mt-1 block text-sm text-[#865402]">“{entry.reviewNote}”</span>
                  )}
                </span>
                <span className="flex flex-wrap gap-2">
                  {contentBadges(entry).map((badge) => (
                    <Badge key={badge.label} tone={badge.tone}>
                      {badge.label}
                    </Badge>
                  ))}
                </span>
                <ChevronRight size={18} className="shrink-0 text-neutral-400" />
              </Link>
            </li>
          ))}
        </ul>
        {shown?.length === 0 && !error && (
          <div className="mt-4">
            <EmptyState
              icon={Newspaper}
              title={tab === 'attention' ? 'Nothing waiting' : 'Nothing here yet'}
            >
              {tab === 'attention'
                ? 'No drafts are waiting for review or publishing, and all live copy is reviewed.'
                : 'Create the first one with the buttons above.'}
            </EmptyState>
          </div>
        )}
      </main>
    </AdminShell>
  );
}
