import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { Op } from 'sequelize';
import { env, isProduction } from '../config/env.js';
import { randomToken, sha256 } from '../lib/crypto.js';
import { unauthorized } from '../lib/errors.js';
import { RefreshToken, type SubjectType } from '../models/index.js';
import { audit } from '../services/audit.js';

const ISSUER = 'edc-api';
const ACCESS_AUDIENCE = 'edc-access';
const MFA_AUDIENCE = 'edc-mfa';
const MFA_TTL_SECONDS = 5 * 60;

export interface AccessClaims {
  sub: string;
  typ: SubjectType;
  sid: string;
}

export interface MfaClaims {
  sub: string;
  stage: 'verify' | 'setup';
}

/* ------------------------------------------------------------------ access tokens */

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: ACCESS_AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: ACCESS_AUDIENCE,
    });
    if (typeof payload === 'string' || !payload.sub || !payload.typ || !payload.sid) {
      throw new Error('malformed');
    }
    return { sub: payload.sub, typ: payload.typ as SubjectType, sid: payload.sid as string };
  } catch {
    throw unauthorized('invalid_token', 'Your session has expired. Please sign in again.');
  }
}

/* ------------------------------------------------------------------ MFA step tokens */

export function signMfaToken(claims: MfaClaims): string {
  return jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: MFA_AUDIENCE,
    expiresIn: MFA_TTL_SECONDS,
  });
}

export function verifyMfaToken(token: string, stage: MfaClaims['stage']): string {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: MFA_AUDIENCE,
    });
    if (typeof payload === 'string' || payload.stage !== stage || !payload.sub) {
      throw new Error('wrong stage');
    }
    return payload.sub;
  } catch {
    throw unauthorized('invalid_mfa_token', 'This sign-in step has expired. Please start again.');
  }
}

/* ------------------------------------------------------------------ cookies */

const COOKIE_PATH = '/api/v1/auth';

function refreshCookieName(subject: SubjectType): string {
  const base = subject === 'staff' ? 'edc_srt' : 'edc_prt';
  return isProduction ? `__Secure-${base}` : base;
}

export const CSRF_COOKIE = isProduction ? '__Secure-edc_csrf' : 'edc_csrf';

function refreshTtlMs(subject: SubjectType): number {
  const days = subject === 'staff' ? env.STAFF_REFRESH_TTL_DAYS : env.PATIENT_REFRESH_TTL_DAYS;
  return days * 24 * 60 * 60 * 1000;
}

export function readRefreshCookie(req: Request, subject: SubjectType): string | undefined {
  const value: unknown = req.cookies?.[refreshCookieName(subject)];
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function clearSessionCookies(res: Response, subject: SubjectType): void {
  res.clearCookie(refreshCookieName(subject), { path: COOKIE_PATH });
  res.clearCookie(CSRF_COOKIE, { path: '/' });
}

/* ------------------------------------------------------------------ sessions */

export interface IssuedSession {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
}

/**
 * Starts (or continues, when `familyId` is given) a session: stores a hashed refresh token,
 * sets it as an httpOnly cookie scoped to the auth routes, and sets a readable CSRF cookie
 * for the double-submit check on refresh/logout.
 */
export async function issueSession(
  req: Request,
  res: Response,
  subjectType: SubjectType,
  subjectId: string,
  familyId: string = randomUUID(),
): Promise<IssuedSession & { refreshTokenId: string }> {
  const refreshToken = randomToken();
  const ttl = refreshTtlMs(subjectType);
  const record = await RefreshToken.create({
    subjectType,
    subjectId,
    tokenHash: sha256(refreshToken),
    familyId,
    expiresAt: new Date(Date.now() + ttl),
    ip: req.ip ?? null,
    userAgent: req.get('user-agent')?.slice(0, 400) ?? null,
  });

  const csrfToken = randomToken(24);
  res.cookie(refreshCookieName(subjectType), refreshToken, {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: ttl,
  });
  res.cookie(CSRF_COOKIE, csrfToken, {
    httpOnly: false,
    secure: isProduction,
    sameSite: 'strict',
    path: '/',
    maxAge: ttl,
  });

  return {
    accessToken: signAccessToken({ sub: subjectId, typ: subjectType, sid: familyId }),
    expiresIn: env.ACCESS_TOKEN_TTL_SECONDS,
    csrfToken,
    refreshTokenId: record.id,
  };
}

/**
 * Rotates a refresh token. Presenting an already-rotated token means it was stolen or
 * replayed, so the whole session family is revoked.
 */
export async function rotateSession(
  req: Request,
  res: Response,
  subjectType: SubjectType,
): Promise<IssuedSession & { subjectId: string }> {
  const presented = readRefreshCookie(req, subjectType);
  if (!presented) throw unauthorized('no_session', 'Please sign in.');

  const record = await RefreshToken.findOne({
    where: { tokenHash: sha256(presented), subjectType },
  });
  if (!record) {
    clearSessionCookies(res, subjectType);
    throw unauthorized('no_session', 'Please sign in.');
  }

  if (record.revokedAt) {
    await revokeFamily(record.familyId, 'reuse_detected');
    await audit(req, {
      action: 'auth.refresh_reuse_detected',
      actorType: subjectType,
      actorId: subjectType === 'staff' ? record.subjectId : null,
      entity: 'session',
      entityId: record.familyId,
    });
    clearSessionCookies(res, subjectType);
    throw unauthorized('session_revoked', 'Your session was ended for security. Please sign in.');
  }

  if (record.expiresAt.getTime() <= Date.now()) {
    clearSessionCookies(res, subjectType);
    throw unauthorized('session_expired', 'Your session has expired. Please sign in again.');
  }

  const next = await issueSession(req, res, subjectType, record.subjectId, record.familyId);
  await record.update({
    revokedAt: new Date(),
    revokedReason: 'rotated',
    replacedById: next.refreshTokenId,
  });

  return {
    accessToken: next.accessToken,
    expiresIn: next.expiresIn,
    csrfToken: next.csrfToken,
    subjectId: record.subjectId,
  };
}

export async function endSession(
  req: Request,
  res: Response,
  subjectType: SubjectType,
): Promise<void> {
  const presented = readRefreshCookie(req, subjectType);
  if (presented) {
    const record = await RefreshToken.findOne({
      where: { tokenHash: sha256(presented), subjectType },
    });
    if (record) await revokeFamily(record.familyId, 'logout');
  }
  clearSessionCookies(res, subjectType);
}

export async function revokeFamily(familyId: string, reason: string): Promise<void> {
  await RefreshToken.update(
    { revokedAt: new Date(), revokedReason: reason },
    { where: { familyId, revokedAt: { [Op.is]: null } } },
  );
}

export async function isFamilyActive(familyId: string): Promise<boolean> {
  const live = await RefreshToken.count({
    where: { familyId, revokedAt: { [Op.is]: null }, expiresAt: { [Op.gt]: new Date() } },
  });
  return live > 0;
}

/** Ends every session of a subject, e.g. after a password reset or deactivation. */
export async function revokeAllForSubject(
  subjectType: SubjectType,
  subjectId: string,
  reason: string,
): Promise<void> {
  await RefreshToken.update(
    { revokedAt: new Date(), revokedReason: reason },
    { where: { subjectType, subjectId, revokedAt: { [Op.is]: null } } },
  );
}
