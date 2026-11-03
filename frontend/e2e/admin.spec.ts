import { expect, test } from '@playwright/test';
import { signIn } from './auth';
import { DEMO_STAFF, goaDate } from './demo';

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

/**
 * Phase 5 exit check: the owner signs in with two-step verification, books a visit for a new
 * patient, checks them in, completes the visit, invoices it and takes payment.
 */
test('owner signs in with 2FA, completes a visit, invoices and takes payment', async ({ page }) => {
  // 1. Password, then one-time authenticator setup.
  await signIn(page, DEMO_STAFF.owner);
  await expect(page.getByRole('heading', { name: /^Hello/ })).toBeVisible();

  // 2. Register a patient.
  await page.getByRole('link', { name: 'Patients', exact: true }).click();
  await page.getByRole('button', { name: 'Register patient' }).click();
  const register = page.getByRole('dialog');
  await register.getByLabel('Full name').fill('Demo Patient Visit');
  await register.getByLabel('Mobile number').fill('9876500088');
  await register.getByRole('button', { name: 'Register patient' }).click();
  await expect(page.getByRole('heading', { name: 'Demo Patient Visit' })).toBeVisible();
  const recordUrl = page.url();

  // 3. Book today at noon, confirmed straight away.
  await page.getByRole('button', { name: 'Book appointment' }).click();
  const book = page.getByRole('dialog');
  await book.getByLabel('Date').fill(goaDate());
  await book.getByLabel('Time').fill('12:00');
  await book.getByRole('button', { name: 'Book and confirm' }).click();
  await expect(page.getByText(/^Booked and confirmed: APT-\d+\.$/)).toBeVisible();

  // 4. Front desk flow on the day list: check in, then complete.
  await page.getByRole('link', { name: 'Day list' }).click();
  const visit = page.locator('article', { hasText: 'Demo Patient Visit' });
  await visit.getByRole('button', { name: 'Check in' }).click();
  await expect(visit.getByText('Checked in', { exact: true })).toBeVisible();
  await visit.getByRole('button', { name: 'Mark completed' }).click();
  await expect(visit.getByText('Completed', { exact: true })).toBeVisible();

  // 5. Invoice the visit and take full payment in cash.
  await page.goto(recordUrl);
  await page.getByRole('button', { name: 'New invoice' }).click();
  const invoice = page.getByRole('dialog');
  await invoice.getByLabel('Treatment').fill('Check-up & cleaning');
  await invoice.getByLabel('Rate (₹)').fill('800');
  await expect(invoice.getByText('₹800')).toBeVisible();
  await invoice.getByRole('button', { name: 'Create invoice' }).click();
  await expect(page.getByText('Invoice created.')).toBeVisible();
  await expect(page.getByText('Unpaid', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Record payment' }).click();
  const payment = page.getByRole('dialog');
  await expect(payment.getByLabel('Amount received (₹)')).toHaveValue('800');
  await payment.getByLabel('Cash').check();
  await payment.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText(/^Payment recorded: RCT-\d+\./)).toBeVisible();
  await expect(page.getByText('Paid', { exact: true })).toBeVisible();
  await expect(page.getByText('Nothing due')).toBeVisible();

  // 6. The day's cash-up shows it.
  await page.getByRole('link', { name: 'Billing' }).click();
  await expect(page.getByText('₹800').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'No balances due' })).toBeVisible();
});
