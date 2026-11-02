import { z } from 'zod';

const E164 = /^\+[1-9]\d{7,14}$/;

/**
 * Normalises phone input to E.164. Bare 10-digit Indian mobiles (and 0-prefixed ones) get
 * +91; anything else must already carry a country code so international patients work.
 */
export function normalisePhone(input: string): string {
  const compact = input.replace(/[\s\-().]/g, '');
  if (/^[6-9]\d{9}$/.test(compact)) return `+91${compact}`;
  if (/^0[6-9]\d{9}$/.test(compact)) return `+91${compact.slice(1)}`;
  if (/^00[1-9]\d{7,14}$/.test(compact)) return `+${compact.slice(2)}`;
  return compact;
}

export const phoneSchema = z
  .string()
  .trim()
  .min(8)
  .max(20)
  .transform(normalisePhone)
  .refine((value) => E164.test(value), { message: 'Enter a valid mobile number' });

export const emailSchema = z.email().trim().toLowerCase().max(254);

export const uuidSchema = z.uuid();

/** Staff password policy: length beats composition rules (NIST SP 800-63B). */
export const passwordSchema = z
  .string()
  .min(12, 'Use at least 12 characters')
  .max(128, 'Use at most 128 characters');

export const otpCodeSchema = z.string().regex(/^\d{6}$/, 'Enter the 6-digit code');
