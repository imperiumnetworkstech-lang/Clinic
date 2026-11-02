import type { NextFunction, Request, Response } from 'express';
import { CSRF_COOKIE } from '../auth/tokens.js';
import { safeEqual } from '../lib/crypto.js';
import { forbidden } from '../lib/errors.js';

/**
 * Double-submit check for routes authenticated by cookie (refresh, logout). The refresh cookie
 * is already SameSite=Strict; this is defence in depth against same-site attacks.
 */
export function requireCsrf(req: Request, _res: Response, next: NextFunction) {
  const cookie: unknown = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (typeof cookie !== 'string' || !header || !safeEqual(cookie, header)) {
    throw forbidden('csrf_failed', 'Security check failed. Please reload and try again.');
  }
  next();
}
