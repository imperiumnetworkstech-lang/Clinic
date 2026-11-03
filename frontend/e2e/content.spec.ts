import { expect, test } from '@playwright/test';
import { signIn } from './auth';
import { DEMO_STAFF } from './demo';

test.use({ viewport: { width: 1280, height: 900 }, isMobile: false, hasTouch: false });

/**
 * CMS workflow: an edit stays off the live page until a dentist approves it and the owner
 * publishes. (The demo owner holds both the review and publish permissions.)
 */
test('edited treatment copy goes live only after review and publishing', async ({ page }) => {
  const summary = 'Demo summary: whitening lightens stains safely under a dentist’s care.';

  await signIn(page, DEMO_STAFF.owner);
  await page.goto('/admin/content?tab=treatment');
  await expect(page.getByRole('tab', { name: /Treatment pages/ })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page
    .getByRole('link', { name: /Teeth Whitening/ })
    .first()
    .click();

  await page.getByLabel('Summary').fill(summary);
  await page.getByRole('button', { name: 'Save draft' }).click();
  await expect(page.getByText('Draft saved. The live page hasn’t changed.')).toBeVisible();

  const live = await page.context().newPage();
  await live.goto('/treatments/teeth-whitening');
  await expect(live.getByText(summary)).toHaveCount(0);

  await page.getByRole('button', { name: 'Send for review' }).click();
  await expect(page.getByText('Sent to a dentist for review.')).toBeVisible();
  await expect(page.getByLabel('Summary')).toBeDisabled();

  await page.getByRole('button', { name: 'Approve', exact: true }).click();
  await expect(page.getByText('Approved. The owner can now publish it.')).toBeVisible();
  await page.getByRole('button', { name: 'Publish' }).click();
  await expect(page.getByText(/^Published\./)).toBeVisible();
  await expect(page.getByText('Live', { exact: true })).toBeVisible();

  await live.reload();
  await expect(live.getByText(summary)).toBeVisible();
  await expect(page.getByText('Published', { exact: true })).toBeVisible();
});
