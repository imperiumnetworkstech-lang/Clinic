import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  timingSafeEqual,
} from 'node:crypto';
import { env } from '../config/env.js';

const KEY_VERSION = 'v1';
const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'base64');

/**
 * AES-256-GCM field encryption. Output format: `v1:<iv>:<tag>:<ciphertext>` (base64url parts),
 * so the key can be rotated later by introducing v2 and re-encrypting in a migration.
 */
export function encrypt(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [KEY_VERSION, iv, tag, ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join(':');
}

export function decrypt(payload: string): string {
  const [version, iv, tag, ciphertext] = payload.split(':');
  if (version !== KEY_VERSION || !iv || !tag || !ciphertext) {
    throw new Error('Unsupported encrypted payload');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function hmac(value: string): string {
  return createHmac('sha256', env.HMAC_SECRET).update(value).digest('hex');
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function randomNumericCode(digits = 6): string {
  return randomInt(0, 10 ** digits)
    .toString()
    .padStart(digits, '0');
}
