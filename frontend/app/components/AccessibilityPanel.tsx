import { Contrast, Type } from 'lucide-react';
import { useAccessibilitySettings, type TextSize } from '../lib/accessibility';
import { cn } from '../lib/cn';

const SIZES: Array<{ value: TextSize; label: string; sample: string }> = [
  { value: 'normal', label: 'Normal', sample: 'text-base' },
  { value: 'large', label: 'Large', sample: 'text-lg' },
  { value: 'larger', label: 'Larger', sample: 'text-xl' },
];

/** Text size and high-contrast controls; used in the More sheet and the footer dialog. */
export function AccessibilityPanel() {
  const { settings, update } = useAccessibilitySettings();

  return (
    <div className="mt-3 space-y-4">
      <fieldset>
        <legend className="flex items-center gap-2 font-semibold">
          <Type size={18} className="text-primary-600" />
          Text size
        </legend>
        <div className="mt-3 grid grid-cols-3 gap-2" role="radiogroup" aria-label="Text size">
          {SIZES.map((size) => {
            const selected = settings.textSize === size.value;
            return (
              <button
                key={size.value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => update({ textSize: size.value })}
                className={cn(
                  'flex min-h-14 flex-col items-center justify-center rounded-2xl font-semibold ring-1 transition',
                  selected
                    ? 'bg-primary-50 text-primary-700 ring-2 ring-primary-600'
                    : 'bg-white ring-neutral-200 hover:bg-neutral-50',
                )}
              >
                <span className={cn('leading-none', size.sample)} aria-hidden="true">
                  Aa
                </span>
                <span className="mt-1 text-xs">{size.label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <button
        type="button"
        role="switch"
        aria-checked={settings.highContrast}
        onClick={() => update({ highContrast: !settings.highContrast })}
        className="flex min-h-14 w-full items-center justify-between gap-4 rounded-2xl bg-white px-4 font-semibold ring-1 ring-neutral-200 hover:bg-neutral-50"
      >
        <span className="flex items-center gap-2">
          <Contrast size={18} className="text-primary-600" />
          High contrast
        </span>
        <span
          aria-hidden="true"
          className={cn(
            'relative h-7 w-12 rounded-full transition',
            settings.highContrast ? 'bg-primary-600' : 'bg-neutral-300',
          )}
        >
          <span
            className={cn(
              'absolute top-1 left-1 size-5 rounded-full bg-white shadow transition-transform',
              settings.highContrast && 'translate-x-5',
            )}
          />
        </span>
      </button>
    </div>
  );
}
