import { pino } from 'pino';
import { env, isProduction } from '../config/env.js';

/**
 * Paths redacted from every log line. PHI and secrets must never reach logs: request bodies
 * are not logged at all, and these cover headers plus anything passed explicitly.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  '*.password',
  '*.passwordHash',
  '*.code',
  '*.phone',
  '*.email',
  '*.token',
  '*.accessToken',
  '*.refreshToken',
  '*.mfaToken',
];

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: { paths: REDACT_PATHS, censor: '[redacted]' },
  ...(isProduction || env.NODE_ENV === 'test'
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),
});

if (isProduction && !env.ENFORCE_STAFF_2FA) {
  logger.warn('ENFORCE_STAFF_2FA=false: staff sign in without 2FA. Re-enable before launch.');
}
