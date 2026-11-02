import {
  mfaTokenBody,
  mfaVerifyBody,
  staffLoginBody,
  type MfaSetupResponse,
  type StaffLoginResponse,
} from '@edc/shared';
import { Router, type Request, type Response } from 'express';
import { env } from '../config/env.js';
import { verifyAgainstDummy, verifyPassword } from '../auth/password.js';
import {
  endSession,
  issueSession,
  revokeAllForSubject,
  rotateSession,
  signMfaToken,
  verifyMfaToken,
} from '../auth/tokens.js';
import { createEnrolment, verifyTotp } from '../auth/totp.js';
import { badRequest, unauthorized } from '../lib/errors.js';
import { requireCsrf } from '../middleware/csrf.js';
import { Role, User } from '../models/index.js';
import { audit } from '../services/audit.js';
import { consume, reset, RULES } from '../services/rateLimit.js';

export const staffAuthRouter = Router();

const INVALID_CREDENTIALS = () =>
  unauthorized('invalid_credentials', 'Email or password is incorrect.');

async function loadUser(id: string): Promise<User & { role: Role }> {
  const user = await User.findByPk(id, { include: [{ model: Role, as: 'role' }] });
  if (!user || user.status !== 'active' || !user.role) {
    throw unauthorized('account_unavailable', 'This account cannot sign in.');
  }
  return user as User & { role: Role };
}

async function completeLogin(req: Request, res: Response, user: User, method: string) {
  await user.update({ lastLoginAt: new Date() });
  const session = await issueSession(req, res, 'staff', user.id);
  await audit(req, {
    action: 'auth.login',
    actorType: 'staff',
    actorId: user.id,
    meta: { method },
  });
  const body: StaffLoginResponse = {
    status: 'ok',
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
  };
  res.json(body);
}

staffAuthRouter.post('/login', async (req, res) => {
  const { email, password } = staffLoginBody.parse(req.body);
  await consume(RULES.staffLoginPerIp, req.ip ?? 'unknown');
  await consume(RULES.staffLoginPerAccount, email);

  const user = await User.findOne({ where: { email }, include: [{ model: Role, as: 'role' }] });
  if (!user) {
    await verifyAgainstDummy(password);
    await audit(req, { action: 'auth.login_failed', meta: { reason: 'unknown_account' } });
    throw INVALID_CREDENTIALS();
  }
  if (!(await verifyPassword(user.passwordHash, password))) {
    await audit(req, {
      action: 'auth.login_failed',
      actorType: 'staff',
      actorId: user.id,
      meta: { reason: 'bad_password' },
    });
    throw INVALID_CREDENTIALS();
  }
  if (user.status !== 'active' || !user.role) {
    await audit(req, {
      action: 'auth.login_failed',
      actorType: 'staff',
      actorId: user.id,
      meta: { reason: `status_${user.status}` },
    });
    throw INVALID_CREDENTIALS();
  }
  await reset(RULES.staffLoginPerAccount, email);

  if (user.totpEnabled) {
    const body: StaffLoginResponse = {
      status: 'mfa_required',
      mfaToken: signMfaToken({ sub: user.id, stage: 'verify' }),
    };
    res.json(body);
    return;
  }
  if (env.ENFORCE_STAFF_2FA && user.role.requiresTwoFactor) {
    const body: StaffLoginResponse = {
      status: 'mfa_setup_required',
      mfaToken: signMfaToken({ sub: user.id, stage: 'setup' }),
    };
    res.json(body);
    return;
  }
  await completeLogin(req, res, user, 'password');
});

staffAuthRouter.post('/2fa/verify', async (req, res) => {
  const { mfaToken, code } = mfaVerifyBody.parse(req.body);
  const userId = verifyMfaToken(mfaToken, 'verify');
  await consume(RULES.mfaVerify, userId);
  const user = await loadUser(userId);
  if (!user.totpEnabled || !user.totpSecretEnc) throw badRequest('mfa_not_enabled', '2FA is off.');

  const lastStep = user.totpLastStep === null ? null : Number(user.totpLastStep);
  const step = verifyTotp(user.totpSecretEnc, code, lastStep);
  if (step === null) {
    await audit(req, { action: 'auth.mfa_failed', actorType: 'staff', actorId: user.id });
    throw unauthorized('invalid_code', 'That code is not valid. Check your authenticator app.');
  }
  await reset(RULES.mfaVerify, userId);
  await user.update({ totpLastStep: String(step) });
  await completeLogin(req, res, user, 'password+totp');
});

staffAuthRouter.post('/2fa/setup', async (req, res) => {
  const { mfaToken } = mfaTokenBody.parse(req.body);
  const user = await loadUser(verifyMfaToken(mfaToken, 'setup'));
  if (user.totpEnabled) throw badRequest('mfa_already_enabled', '2FA is already set up.');

  const enrolment = await createEnrolment(user.email);
  await user.update({ totpSecretEnc: enrolment.secretEnc, totpLastStep: null });
  const body: MfaSetupResponse = {
    otpauthUrl: enrolment.otpauthUrl,
    qrCodeDataUrl: enrolment.qrCodeDataUrl,
  };
  res.json(body);
});

staffAuthRouter.post('/2fa/enable', async (req, res) => {
  const { mfaToken, code } = mfaVerifyBody.parse(req.body);
  const userId = verifyMfaToken(mfaToken, 'setup');
  await consume(RULES.mfaVerify, userId);
  const user = await loadUser(userId);
  if (user.totpEnabled) throw badRequest('mfa_already_enabled', '2FA is already set up.');
  if (!user.totpSecretEnc) throw badRequest('mfa_setup_missing', 'Start 2FA setup first.');

  const step = verifyTotp(user.totpSecretEnc, code, null);
  if (step === null) {
    throw unauthorized('invalid_code', 'That code is not valid. Check your authenticator app.');
  }
  await reset(RULES.mfaVerify, userId);
  await user.update({ totpEnabled: true, totpLastStep: String(step) });
  await audit(req, { action: 'auth.mfa_enabled', actorType: 'staff', actorId: user.id });
  await completeLogin(req, res, user, 'password+totp_enrolment');
});

staffAuthRouter.post('/refresh', requireCsrf, async (req, res) => {
  await consume(RULES.refreshPerIp, req.ip ?? 'unknown');
  const session = await rotateSession(req, res, 'staff');
  const user = await User.findByPk(session.subjectId);
  if (!user || user.status !== 'active') {
    await revokeAllForSubject('staff', session.subjectId, 'account_unavailable');
    throw unauthorized('account_unavailable', 'This account cannot sign in.');
  }
  res.json({
    accessToken: session.accessToken,
    expiresIn: session.expiresIn,
    csrfToken: session.csrfToken,
  });
});

staffAuthRouter.post('/logout', requireCsrf, async (req, res) => {
  await endSession(req, res, 'staff');
  await audit(req, { action: 'auth.logout', actorType: 'staff' });
  res.status(204).end();
});
