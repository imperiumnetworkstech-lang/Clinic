import type { ContentSummary } from '../../lib/admin-api';

type Tone = 'brand' | 'info' | 'success' | 'neutral' | 'warning';

/** Badges describing where an entry stands: the live copy, then any draft in progress. */
export function contentBadges(entry: ContentSummary): Array<{ label: string; tone: Tone }> {
  const badges: Array<{ label: string; tone: Tone }> = [];
  if (entry.archived) badges.push({ label: 'Unpublished', tone: 'neutral' });
  else if (entry.live)
    badges.push(
      entry.publishedReviewed
        ? { label: 'Live', tone: 'success' }
        : { label: 'Live · not reviewed', tone: 'warning' },
    );
  else badges.push({ label: 'Not published', tone: 'neutral' });

  const draft: Record<NonNullable<ContentSummary['draftStatus']>, { label: string; tone: Tone }> = {
    editing: { label: 'Draft', tone: 'info' },
    in_review: { label: 'Waiting for review', tone: 'brand' },
    changes_requested: { label: 'Changes requested', tone: 'warning' },
    approved: { label: 'Approved, ready to publish', tone: 'success' },
  };
  if (entry.draftStatus) badges.push(draft[entry.draftStatus]);
  return badges;
}

export const HISTORY_LABELS: Record<string, string> = {
  imported: 'Imported from the old site copy',
  created: 'Created',
  saved: 'Draft saved',
  submitted: 'Sent for review',
  approved: 'Approved by a dentist',
  changes_requested: 'Changes requested',
  published: 'Published',
  unpublished: 'Unpublished',
  restored: 'Put back live',
  discarded: 'Draft discarded',
  live_approved: 'Live copy approved by a dentist',
};
