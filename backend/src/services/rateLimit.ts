import { QueryTypes } from 'sequelize';
import { sequelize } from '../db/sequelize.js';
import { tooManyRequests } from '../lib/errors.js';

export interface RateLimitRule {
  /** Namespace, e.g. `staff_login`. */
  name: string;
  points: number;
  windowSeconds: number;
}

/**
 * Fixed-window limiter stored in Postgres, so it holds across serverless instances without
 * Redis. One atomic upsert per check; the window restarts once `expires_at` has passed.
 */
export async function consume(rule: RateLimitRule, subject: string): Promise<void> {
  const [row] = await sequelize.query<{ points: number; expires_at: Date }>(
    `INSERT INTO rate_limits (key, points, expires_at)
     VALUES (:key, 1, now() + make_interval(secs => :window))
     ON CONFLICT (key) DO UPDATE SET
       points = CASE WHEN rate_limits.expires_at <= now() THEN 1 ELSE rate_limits.points + 1 END,
       expires_at = CASE WHEN rate_limits.expires_at <= now() THEN EXCLUDED.expires_at
                         ELSE rate_limits.expires_at END
     RETURNING points, expires_at`,
    {
      replacements: { key: `${rule.name}:${subject}`, window: rule.windowSeconds },
      type: QueryTypes.SELECT,
    },
  );
  if (row && row.points > rule.points) {
    const retryAfter = Math.max(1, Math.ceil((row.expires_at.getTime() - Date.now()) / 1000));
    throw tooManyRequests(retryAfter);
  }
}

/** Clears a subject's counter, e.g. after a successful login. */
export async function reset(rule: RateLimitRule, subject: string): Promise<void> {
  await sequelize.query('DELETE FROM rate_limits WHERE key = :key', {
    replacements: { key: `${rule.name}:${subject}` },
  });
}

export async function purgeExpired(): Promise<number> {
  const [, count] = await sequelize.query('DELETE FROM rate_limits WHERE expires_at <= now()');
  return typeof count === 'number' ? count : 0;
}

export const RULES = {
  staffLoginPerAccount: { name: 'staff_login_acct', points: 5, windowSeconds: 15 * 60 },
  staffLoginPerIp: { name: 'staff_login_ip', points: 30, windowSeconds: 15 * 60 },
  mfaVerify: { name: 'mfa_verify', points: 5, windowSeconds: 5 * 60 },
  otpSendPerPhone: { name: 'otp_send_phone', points: 3, windowSeconds: 10 * 60 },
  otpSendPerIp: { name: 'otp_send_ip', points: 10, windowSeconds: 60 * 60 },
  otpVerifyPerPhone: { name: 'otp_verify_phone', points: 10, windowSeconds: 10 * 60 },
  refreshPerIp: { name: 'refresh_ip', points: 60, windowSeconds: 60 },
  // Requests reach the API via the website's server, so many patients can share one IP.
  bookingPerIp: { name: 'booking_ip', points: 300, windowSeconds: 60 * 60 },
  bookingPerPhone: { name: 'booking_phone', points: 3, windowSeconds: 60 * 60 },
  emailLinkPerEmail: { name: 'email_link_email', points: 3, windowSeconds: 15 * 60 },
  emailLinkPerIp: { name: 'email_link_ip', points: 20, windowSeconds: 60 * 60 },
} satisfies Record<string, RateLimitRule>;
