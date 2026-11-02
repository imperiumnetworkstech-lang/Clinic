import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { AccessibilityPanel } from '../app/components/AccessibilityPanel';
import { ConsentBanner, ConsentSettingsLink } from '../app/components/ConsentBanner';
import { ButtonLink } from '../app/components/ui/Button';
import { Sheet } from '../app/components/ui/Sheet';
import { ACCESSIBILITY_BOOT_SCRIPT } from '../app/lib/accessibility';

describe('AccessibilityPanel', () => {
  it('applies and remembers text size and high contrast', async () => {
    const user = userEvent.setup();
    render(<AccessibilityPanel />);

    await user.click(screen.getByRole('radio', { name: /larger/i }));
    expect(document.documentElement.dataset.textSize).toBe('larger');
    expect(screen.getByRole('radio', { name: /larger/i })).toHaveAttribute('aria-checked', 'true');

    await user.click(screen.getByRole('switch', { name: /high contrast/i }));
    expect(document.documentElement.dataset.contrast).toBe('high');

    expect(JSON.parse(localStorage.getItem('edc-a11y') ?? '{}')).toEqual({
      textSize: 'larger',
      highContrast: true,
    });

    await user.click(screen.getByRole('radio', { name: /normal/i }));
    expect(document.documentElement.dataset.textSize).toBeUndefined();
  });

  it('boot script restores saved settings before React loads', () => {
    localStorage.setItem('edc-a11y', JSON.stringify({ textSize: 'large', highContrast: true }));
    new Function(ACCESSIBILITY_BOOT_SCRIPT)();
    expect(document.documentElement.dataset.textSize).toBe('large');
    expect(document.documentElement.dataset.contrast).toBe('high');
  });

  it('boot script survives corrupted storage', () => {
    localStorage.setItem('edc-a11y', '{not json');
    expect(() => new Function(ACCESSIBILITY_BOOT_SCRIPT)()).not.toThrow();
  });
});

describe('Sheet', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button onClick={() => setOpen(true)}>Open</button>
        <Sheet open={open} onOpenChange={setOpen} title="Book an appointment" description="Desc">
          <p>Body</p>
        </Sheet>
      </>
    );
  }

  it('opens as a labelled dialog and closes with the close button', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog', { name: 'Book an appointment' });
    expect(dialog).toHaveAccessibleDescription('Desc');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('ButtonLink', () => {
  it('opens external links safely in a new tab', () => {
    render(
      <ButtonLink href="https://wa.me/1" external>
        WhatsApp
      </ButtonLink>,
    );
    const link = screen.getByRole('link', { name: 'WhatsApp' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
});

describe('ConsentBanner', () => {
  it('shows nothing while analytics are not configured', () => {
    const { container } = render(
      <>
        <ConsentBanner />
        <ConsentSettingsLink />
      </>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
