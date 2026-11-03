import { useEffect, useState } from 'react';
import { openStatus, weeklyHours } from '../lib/hours';
import { Badge } from './ui/primitives';

/**
 * Live "Open now" status in Goa time. Computed in the browser only, so cached HTML can never
 * show a stale status; nothing renders until then.
 */
export function OpenNowBadge({ branchId }: { branchId: string }) {
  const [label, setLabel] = useState<{ open: boolean; text: string } | null>(null);

  useEffect(() => {
    const hours = weeklyHours(branchId);
    if (!hours) return;
    const update = () => {
      const status = openStatus(hours);
      setLabel({ open: status.open, text: status.label });
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [branchId]);

  if (!label) return null;
  return (
    <Badge tone={label.open ? 'success' : 'neutral'} aria-live="polite">
      <span
        aria-hidden="true"
        className={
          label.open ? 'size-2 rounded-full bg-[#128C4A]' : 'size-2 rounded-full bg-neutral-400'
        }
      />
      {label.text}
    </Badge>
  );
}
