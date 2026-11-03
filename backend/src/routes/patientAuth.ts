import {
  patientEmailLinkBody,
  patientEmailVerifyBody,
  patientOtpSendBody,
  patientOtpVerifyBody,
} from '@edc/shared';
import { Router } from 'express';
import { Op } from 'sequelize';
import { endSession, issueSession, rotateSession } from '../auth/tokens.js';
import { env } from '../config/env.js';
import { hmac, randomNumericCode, randomToken, safeEqual, sha256 } from '../lib/crypto.js';
import { serviceUnavailable, unauthorized } from '../lib/errors.js';
import { requireCsrf } from '../middleware/csrf.js';
import { OtpChallenge, Patient, PatientLoginLink } from '../models/index.js';
import { emailDelivery } from '../services/emailDelivery.js';
import { audit } from '../services/audit.js';
import { otpDelivery } from '../services/otpDelivery.js';
import { consume, RULES } from '../services/rateLimit.js';

export const patientAuthRouter = Router();

const OTP_TTL_SECONDS = 5 * 60;
const MAX_ATTEMPTS = 5;

const codeHash = (challengeId: string, code: string) => hmac(`${challengeId}:${code}`);

const INVALID_CODE = () =>
  unauthorized('invalid_code', 'That code is incorrect or has expired. Request a new one.');

/**
 * Always answers the same way whether or not the number belongs to a patient, so the endpoint
 * can't be used to discover who is a patient of the clinic.
 */
patientAuthRouter.post('/otp/send', async (req, res) => {
  if (!otpDelivery.available) {
    throw serviceUnavailable(
      'otp_unavailable',
      'Online sign-in is not available yet. Please call or WhatsApp the clinic.',
    );
  }
  const { phone } = patientOtpSendBody.parse(req.body);
  await consume(RULES.otpSendPerIp, req.ip ?? 'unknown');
  await consume(RULES.otpSendPerPhone, phone);

  if ((await Patient.count({ where: { phone } })) > 0) {
    await OtpChallenge.update(
      { consumedAt: new Date() },
      { where: { phone, purpose: 'portal_login', consumedAt: { [Op.is]: null } } },
    );
    const code = randomNumericCode();
    const challenge = await OtpChallenge.create({
      phone,
      purpose: 'portal_login',
      codeHash: 'pending',
      expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      ip: req.ip ?? null,
    });
    await challenge.update({ codeHash: codeHash(challenge.id, code) });
    await otpDelivery.send(phone, code);
    await audit(req, { action: 'auth.otp_sent', actorType: 'patient', actorId: hmac(phone) });
  }

  res.status(202).json({ status: 'sent', expiresIn: OTP_TTL_SECONDS });
});

patientAuthRouter.post('/otp/verify', async (req, res) => {
  const { phone, code } = patientOtpVerifyBody.parse(req.body);
  await consume(RULES.otpVerifyPerPhone, phone);

  const challenge = await OtpChallenge.findOne({
    where: {
      phone,
      purpose: 'portal_login',
      consumedAt: { [Op.is]: null },
      expiresAt: { [Op.gt]: new Date() },
    },
    order: [['createdAt', 'DESC']],
  });
  if (!challenge || challenge.attempts >= MAX_ATTEMPTS) throw INVALID_CODE();

  if (!safeEqual(challenge.codeHash, codeHash(challenge.id, code))) {
    const attempts = challenge.attempts + 1;
    await challenge.update({
      attempts,
      ...(attempts >= MAX_ATTEMPTS ? { consumedAt: new Date() } : {}),
    });
    await audit(req, { action: 'auth.otp_failed', actorType: 'patient', actorId: hmac(phone) });
    throw INVALID_CODE();
  }

  await challenge.update({ consumedAt: new Date() });
  const session = await issueSession(req, res, 'patient', phone);
  await audit(req, { action: 'auth.login', actorType: 'patient', actorId: hmac(phone) });
  res.json({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
  });
});

patientAuthRouter.post('/refresh', requireCsrf, async (req, res) => {
  await consume(RULES.refreshPerIp, req.ip ?? 'unknown');
  const session = await rotateSession(req, res, 'patient');
  res.json({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
  });
});

patientAuthRouter.post('/logout', requireCsrf, async (req, res) => {
  await endSession(req, res, 'patient');
  res.status(204).end();
});

const LINK_TTL_MINUTES = 15;

function signInEmail(link: string) {
  return {
    subject: 'Your sign-in link for Expressions Dental Clinic',
    text: `Use this link to sign in to your patient portal. It works once and expires in ${LINK_TTL_MINUTES} minutes:

${link}

If you didn't ask for this, you can ignore this email.

Expressions Dental Clinic, Goa`,
    html: `<p>Use the button below to sign in to your patient portal. It works once and expires in ${LINK_TTL_MINUTES} minutes.</p><p><a href="${link}" style="display:inline-block;padding:12px 22px;border-radius:999px;background:#d2027f;color:#ffffff;font-weight:600;text-decoration:none">Sign in</a></p><p style="color:#576170">If you didn't ask for this, you can ignore this email.<br>Expressions Dental Clinic, Goa</p>`,
  };
}

/**
 * Emails a single-use sign-in link to patients registered with that address. Answers the same
 * way either way, so the endpoint can't reveal who is a patient.
 */
patientAuthRouter.post('/email-link', async (req, res) => {
  if (!emailDelivery.available) {
    throw serviceUnavailable(
      'email_unavailable',
      'Online sign-in is not available yet. Please call or WhatsApp the clinic.',
    );
  }
  const { email } = patientEmailLinkBody.parse(req.body);
  await consume(RULES.emailLinkPerIp, req.ip ?? 'unknown');
  await consume(RULES.emailLinkPerEmail, email);

  if ((await Patient.count({ where: { email } })) > 0) {
    const token = randomToken(32);
    await PatientLoginLink.create({
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + LINK_TTL_MINUTES * 60_000),
      ip: req.ip ?? null,
    });
    const link = `${env.APP_ORIGIN}/portal/verify?token=${encodeURIComponent(token)}`;
    await emailDelivery.send({ to: email, ...signInEmail(link) });
    await audit(req, {
      action: 'auth.email_link_sent',
      actorType: 'patient',
      actorId: hmac(email),
    });
  }
  res.status(202).json({ status: 'sent', expiresInMinutes: LINK_TTL_MINUTES });
});

patientAuthRouter.post('/email-link/verify', async (req, res) => {
  const { token } = patientEmailVerifyBody.parse(req.body);
  const link = await PatientLoginLink.findOne({ where: { tokenHash: sha256(token) } });
  if (!link || link.usedAt || link.expiresAt.getTime() <= Date.now()) {
    throw unauthorized(
      'link_invalid',
      'This sign-in link has expired or was already used. Request a new one.',
    );
  }
  // Atomic single use: only one request can flip used_at from null.
  const [claimed] = await PatientLoginLink.update(
    { usedAt: new Date() },
    { where: { id: link.id, usedAt: { [Op.is]: null } } },
  );
  if (claimed !== 1) {
    throw unauthorized('link_invalid', 'This sign-in link was already used. Request a new one.');
  }
  const session = await issueSession(req, res, 'patient', `email:${link.email}`);
  await audit(req, { action: 'auth.login', actorType: 'patient', actorId: hmac(link.email) });
  res.json({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
  });
});
