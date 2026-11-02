import { CalendarX, Sparkles, Stethoscope } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { AccessibilityPanel } from '../components/AccessibilityPanel';
import { WhatsAppIcon } from '../components/icons';
import { Accordion } from '../components/ui/Accordion';
import { Button, ButtonLink } from '../components/ui/Button';
import {
  Badge,
  Card,
  EmptyState,
  IconTile,
  SectionHeading,
  Skeleton,
  TextField,
} from '../components/ui/primitives';
import { Sheet } from '../components/ui/Sheet';
import { container } from '../lib/ui';

/** Dev-only component gallery (not built in production): every UI primitive in one place. */
export function meta() {
  return [{ title: 'UI gallery (dev)' }, { name: 'robots', content: 'noindex, nofollow' }];
}

const SCALES = ['primary', 'secondary', 'neutral'] as const;
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-neutral-200 py-10">
      <h2 className="text-xl font-bold">{title}</h2>
      <div className="mt-6">{children}</div>
    </section>
  );
}

export default function UiGallery() {
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <div className={`${container} py-12`}>
      <SectionHeading
        as="h1"
        id="gallery-title"
        kicker="Design system"
        title="Component gallery"
        intro="Development only. Tokens and components from docs/DESIGN_SYSTEM.md."
      />

      <Section title="Colour scales">
        <div className="space-y-3">
          {SCALES.map((scale) => (
            <div key={scale} className="grid grid-cols-11 gap-1.5">
              {STEPS.map((step) => (
                <div key={step} className="text-center text-[0.65rem] text-muted">
                  <div
                    className="h-12 rounded-lg ring-1 ring-black/5"
                    style={{ background: `var(--color-${scale}-${step})` }}
                  />
                  {scale.slice(0, 3)}-{step}
                </div>
              ))}
            </div>
          ))}
        </div>
      </Section>

      <Section title="Typography">
        <p className="font-display text-[clamp(2.4rem,1.6rem+3.6vw,4.25rem)] leading-none font-extrabold tracking-[-0.035em]">
          Display
        </p>
        <h1 className="mt-4 text-[clamp(2rem,1.5rem+2.2vw,3.25rem)] font-bold">Heading 1</h1>
        <h2 className="mt-2 text-[clamp(1.625rem,1.3rem+1.4vw,2.5rem)] font-bold">Heading 2</h2>
        <h3 className="mt-2 text-[clamp(1.25rem,1.1rem+0.7vw,1.625rem)] font-bold">Heading 3</h3>
        <p className="mt-3 max-w-prose text-lg text-muted">
          Lead text: from check-ups and root canals to implants and smile makeovers.
        </p>
        <p className="mt-2 max-w-prose">
          Body text at 17px with 1.65 line height. <a className="text-link underline">A link</a>.
        </p>
      </Section>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="whatsapp">
            <WhatsAppIcon size={20} />
            WhatsApp
          </Button>
          <Button size="sm">Small</Button>
          <Button size="lg">Large</Button>
          <Button disabled>Disabled</Button>
          <ButtonLink href="#" variant="secondary">
            Link as button
          </ButtonLink>
        </div>
        <div className="mt-4 flex flex-wrap gap-3 rounded-3xl bg-primary-600 p-6">
          <Button variant="onBrand">On brand</Button>
          <Button variant="onBrandGhost">On brand ghost</Button>
        </div>
      </Section>

      <Section title="Badges, tiles, cards">
        <div className="flex flex-wrap gap-2">
          <Badge>Brand</Badge>
          <Badge tone="info">Info</Badge>
          <Badge tone="neutral">Neutral</Badge>
          <Badge tone="success">Open now</Badge>
          <Badge tone="warning">Closes soon</Badge>
        </div>
        <div className="mt-6 grid gap-5 sm:grid-cols-3">
          <Card>
            <IconTile icon={Stethoscope} />
            <h3 className="mt-4 text-lg font-bold">Card</h3>
            <p className="mt-1 text-muted">Soft shadow, 24px radius.</p>
          </Card>
          <Card>
            <IconTile icon={Sparkles} tone="info" />
            <h3 className="mt-4 text-lg font-bold">Info tone</h3>
          </Card>
          <Card>
            <Skeleton className="h-12 w-12" />
            <Skeleton className="mt-4 h-5 w-2/3" />
            <Skeleton className="mt-2 h-4 w-full" />
          </Card>
        </div>
      </Section>

      <Section title="Form fields">
        <div className="grid max-w-xl gap-5">
          <TextField label="Full name" autoComplete="name" />
          <TextField
            label="Mobile number"
            hint="We’ll WhatsApp your confirmation"
            inputMode="tel"
            autoComplete="tel"
          />
          <TextField label="Email" error="Enter a valid email address" defaultValue="name@" />
        </div>
      </Section>

      <Section title="Accordion">
        <Accordion
          className="max-w-2xl"
          items={[
            { id: 'a', title: 'Does a root canal hurt?', content: 'Answer text goes here.' },
            { id: 'b', title: 'How many visits does it take?', content: 'Answer text.' },
          ]}
        />
      </Section>

      <Section title="Sheet and empty state">
        <Button variant="secondary" onClick={() => setSheetOpen(true)}>
          Open sheet
        </Button>
        <Sheet
          open={sheetOpen}
          onOpenChange={setSheetOpen}
          title="Accessibility"
          description="Bottom sheet on phones, centred dialog from 768px."
        >
          <AccessibilityPanel />
        </Sheet>
        <div className="mt-6 max-w-xl">
          <EmptyState
            icon={CalendarX}
            title="No upcoming appointments"
            action={<Button size="sm">Book an appointment</Button>}
          >
            When you book, your next visit will appear here.
          </EmptyState>
        </div>
      </Section>
    </div>
  );
}
