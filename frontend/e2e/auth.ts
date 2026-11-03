import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { expect, type Page } from '@playwright/test';
import { authenticator } from 'otplib';

/**
 * Staff sign-in for tests, including two-step verification. The first sign-in of an owner or
 * doctor enrols an authenticator; its key is kept in a temp file so later specs in the same
 * run can produce codes. The API refuses a code twice, so a repeat sign-in waits for the next.
 */
const keyFile = (email: string) => path.join(tmpdir(), `edc-e2e-totp-${email}.txt`);

async function freshCode(secret: string) {
  // Use a code from a time step no earlier sign-in can have used.
  await new Promise((resolve) => setTimeout(resolve, (authenticator.timeRemaining() + 1) * 1000));
  return authenticator.generate(secret);
}

export async function signIn(page: Page, account: { email: string; password: string }) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(account.email);
  await page.getByLabel('Password').fill(account.password);
  await page.getByRole('button', { name: 'Continue' }).click();

  const setup = page.getByRole('heading', { name: 'Set up two-step sign-in' });
  const verify = page.getByRole('heading', { name: 'Enter your code' });
  await expect(setup.or(verify).or(page.getByRole('heading', { name: /^Hello/ }))).toBeVisible();

  if (await setup.isVisible()) {
    const secret = ((await page.locator('code').textContent()) ?? '').trim();
    writeFileSync(keyFile(account.email), secret);
    await page.getByLabel('6-digit code').fill(authenticator.generate(secret));
    await page.getByRole('button', { name: 'Finish setup and sign in' }).click();
  } else if (await verify.isVisible()) {
    const secret = readFileSync(keyFile(account.email), 'utf8').trim();
    await page.getByLabel('6-digit code').fill(await freshCode(secret));
    await page.getByRole('button', { name: 'Sign in' }).click();
  }
  await page.waitForURL('**/admin');
  await expect(page.getByRole('heading', { name: /^Hello/ })).toBeVisible();
}
