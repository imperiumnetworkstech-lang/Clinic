import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { OUTBOX } from '../playwright.config';
import { DEMO_STAFF, goaDate } from './demo';

const RECEPTIONIST = DEMO_STAFF.receptionist;

const freeSlot = (page: Page, except?: string) =>
  page
    .locator(
      `label:has(input[name="slotStart"]:not(:disabled)${except ? `:not([value="${except}"])` : ''})`,
    )
    .first();

function signInLink(email: string): string | null {
  const lines = readFileSync(OUTBOX, 'utf8').trim().split('\n').filter(Boolean);
  for (const line of lines.reverse()) {
    const message = JSON.parse(line) as { to: string; text: string };
    const link =
      message.to === email ? message.text.match(/https?:\/\/\S+\/portal\/verify\?token=\S+/) : null;
    if (link) return link[0].replace(/^https?:\/\/[^/]+/, '');
  }
  return null;
}

test('patient books, front desk confirms, patient reschedules then cancels', async ({
  page,
  browser,
}) => {
  const email = `demo.e2e.${Date.now()}@example.test`;

  // 1. Patient books a live slot.
  await page.goto('/book');
  await page.getByLabel('What is the visit for?').selectOption('checkup');
  await page.locator('input[name="branch"][value="mapusa"]').check();
  await page.getByRole('button', { name: 'Continue' }).click();

  const slot = freeSlot(page);
  await slot.click();
  const slotStart = await slot.locator('input').inputValue();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByLabel('Patient’s full name').fill('Demo Patient E2E');
  await page.getByLabel('Mobile number (WhatsApp)').fill('9876500077');
  await page.getByLabel(/^Email/).fill(email);
  await page.locator('input[name="consent"]').check();
  await page.getByRole('button', { name: 'Book this time' }).click();

  await expect(page.getByRole('heading', { name: 'Your time is held' })).toBeVisible();
  const reference = (await page.locator('strong', { hasText: /^APT-\d+$/ }).textContent()) ?? '';
  expect(reference).toMatch(/^APT-\d+$/);

  // 2. Front desk confirms it from the day view.
  const staff = await browser.newPage({ baseURL: 'http://localhost:5173' });
  await staff.goto('/admin/login');
  await staff.getByLabel('Email').fill(RECEPTIONIST.email);
  await staff.getByLabel('Password').fill(RECEPTIONIST.password);
  await staff.getByRole('button', { name: 'Continue' }).click();
  await staff.waitForURL('**/admin');
  await staff.goto('/admin/appointments');
  await staff.locator('#day').fill(goaDate(slotStart));
  const row = staff.locator('article', { hasText: reference });
  await expect(row.getByText('To confirm')).toBeVisible();
  await row.getByRole('button', { name: 'Confirm' }).click();
  await expect(row.getByText('Confirmed', { exact: true })).toBeVisible();
  await expect(row.getByText(/Send confirmation|Quiet hours: send after 8 am/)).toBeVisible();
  await staff.close();

  // 3. Patient signs in with the emailed link and sees the confirmed visit.
  await page.goto('/portal/login');
  await page.getByLabel('Email you booked with').fill(email);
  await page.getByRole('button', { name: 'Email me a sign-in link' }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  let link: string | null = null;
  await expect.poll(() => (link = signInLink(email))).not.toBeNull();
  await page.goto(link ?? '');
  await page.waitForURL('**/portal');
  const card = page.locator('article', { hasText: reference });
  await expect(card.getByText('Confirmed', { exact: true })).toBeVisible();

  // 4. Patient moves it to another free time; it goes back to the front desk to confirm.
  await card.getByRole('button', { name: 'Change time' }).click();
  await freeSlot(page, slotStart).click();
  await card.getByRole('button', { name: 'Move to this time' }).click();
  await expect(page.getByText(/^Moved to /)).toBeVisible();
  await expect(card.getByText('Awaiting confirmation')).toBeVisible();

  // 5. Patient cancels it.
  await card.getByRole('button', { name: 'Cancel appointment' }).click();
  await card.getByRole('button', { name: 'Yes, cancel it' }).click();
  await expect(page.getByText('Your appointment has been cancelled.')).toBeVisible();
  await expect(
    page.locator('article', { hasText: reference }).getByText('Cancelled', { exact: true }),
  ).toBeVisible();
});
