import { authenticator } from 'otplib';
import QRCode from 'qrcode';
import { env } from '../config/env.js';
import { decrypt, encrypt } from '../lib/crypto.js';

authenticator.options = { window: 1, step: 30 };

export interface TotpEnrolment {
  secretEnc: string;
  otpauthUrl: string;
  qrCodeDataUrl: string;
}

export async function createEnrolment(accountName: string): Promise<TotpEnrolment> {
  const secret = authenticator.generateSecret();
  const otpauthUrl = authenticator.keyuri(accountName, env.TOTP_ISSUER, secret);
  return {
    secretEnc: encrypt(secret),
    otpauthUrl,
    qrCodeDataUrl: await QRCode.toDataURL(otpauthUrl),
  };
}

/**
 * Verifies a code and returns the time step it belongs to, or null. Callers persist the step
 * and reject codes whose step is not newer, which blocks replay of an intercepted code.
 */
export function verifyTotp(
  secretEnc: string,
  code: string,
  lastUsedStep: number | null,
): number | null {
  const delta = authenticator.checkDelta(code, decrypt(secretEnc));
  if (delta === null) return null;
  const step = Math.floor(Date.now() / 30_000) + delta;
  if (lastUsedStep !== null && step <= lastUsedStep) return null;
  return step;
}
