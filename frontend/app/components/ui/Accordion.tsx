import * as RadixAccordion from '@radix-ui/react-accordion';
import { Plus } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '../../lib/cn';

export interface AccordionItemData {
  id: string;
  title: ReactNode;
  content: ReactNode;
}

/**
 * FAQ-style disclosure list. Content stays in the server-rendered HTML (forceMount + hidden),
 * so search engines and FAQPage schema can read every answer.
 */
export function Accordion({
  items,
  className,
}: {
  items: AccordionItemData[];
  className?: string;
}) {
  return (
    <RadixAccordion.Root
      type="multiple"
      className={cn('divide-y divide-neutral-200/80 border-y border-neutral-200/80', className)}
    >
      {items.map((item) => (
        <RadixAccordion.Item key={item.id} value={item.id}>
          <RadixAccordion.Header>
            <RadixAccordion.Trigger className="group flex min-h-14 w-full items-center justify-between gap-4 py-4 text-left font-semibold">
              {item.title}
              <Plus
                size={20}
                aria-hidden="true"
                className="shrink-0 text-neutral-400 transition duration-200 group-data-[state=open]:rotate-45"
              />
            </RadixAccordion.Trigger>
          </RadixAccordion.Header>
          <RadixAccordion.Content
            forceMount
            className="pb-4 text-[0.975rem] leading-relaxed text-muted data-[state=closed]:hidden"
          >
            {item.content}
          </RadixAccordion.Content>
        </RadixAccordion.Item>
      ))}
    </RadixAccordion.Root>
  );
}
