import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

/**
 * One overlay for every screen size: a bottom sheet in the phone thumb zone, a centred
 * dialog from 768px. Radix handles focus trapping, Escape, scroll lock and labelling.
 */
export function Sheet({ open, onOpenChange, title, description, children, className }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="sheet-overlay fixed inset-0 z-50 bg-neutral-950/55 backdrop-blur-[2px]" />
        <Dialog.Content
          className={cn(
            'sheet-content fixed inset-x-0 bottom-0 z-50 max-h-[90dvh] overflow-y-auto rounded-t-[28px] bg-white px-6 pt-3 pb-[calc(1.5rem+env(safe-area-inset-bottom))] text-neutral-950 shadow-2xl outline-none',
            'md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:w-full md:max-w-[30rem] md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-[28px] md:p-8',
            className,
          )}
          {...(description ? {} : { 'aria-describedby': undefined })}
        >
          <div
            aria-hidden="true"
            className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-neutral-200 md:hidden"
          />
          <div className="flex items-start justify-between gap-4">
            <div>
              <Dialog.Title className="font-display text-2xl font-bold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1.5 text-muted">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-muted hover:bg-neutral-100"
              aria-label="Close"
            >
              <X size={22} />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function SheetSectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mt-6 text-sm font-semibold tracking-wide text-muted uppercase">{children}</p>
  );
}
