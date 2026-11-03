import { z } from 'zod';
import { ROLE_KEYS } from '../permissions.js';
import { emailSchema, otpCodeSchema, passwordSchema, phoneSchema } from './common.js';

export const staffLoginBody = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});

export const mfaTokenBody = z.object({
  mfaToken: z.string().min(1),
});

export const mfaVerifyBody = mfaTokenBody.extend({
  code: otpCodeSchema,
});

export const patientOtpSendBody = z.object({
  phone: phoneSchema,
});

export const patientOtpVerifyBody = z.object({
  phone: phoneSchema,
  code: otpCodeSchema,
});

export const createStaffBody = z.object({
  name: z.string().trim().min(2).max(120),
  email: emailSchema,
  phone: phoneSchema.optional(),
  role: z.enum(ROLE_KEYS),
  password: passwordSchema,
});

export const staffProfile = z.object({
  id: z.uuid(),
  name: z.string(),
  email: z.string(),
  role: z.enum(ROLE_KEYS),
  permissions: z.array(z.string()),
  twoFactorEnabled: z.boolean(),
});

export const accessTokenResponse = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int(),
  csrfToken: z.string(),
});

/** Staff login either completes, or asks for a TOTP code, or forces 2FA enrolment first. */
export const staffLoginResponse = z.discriminatedUnion('status', [
  accessTokenResponse.extend({ status: z.literal('ok') }),
  z.object({ status: z.literal('mfa_required'), mfaToken: z.string() }),
  z.object({ status: z.literal('mfa_setup_required'), mfaToken: z.string() }),
]);

export const mfaSetupResponse = z.object({
  otpauthUrl: z.string(),
  qrCodeDataUrl: z.string(),
});

export type StaffLoginBody = z.infer<typeof staffLoginBody>;
export type MfaVerifyBody = z.infer<typeof mfaVerifyBody>;
export type PatientOtpSendBody = z.infer<typeof patientOtpSendBody>;
export type PatientOtpVerifyBody = z.infer<typeof patientOtpVerifyBody>;
export type CreateStaffBody = z.infer<typeof createStaffBody>;
export type StaffProfile = z.infer<typeof staffProfile>;
export type AccessTokenResponse = z.infer<typeof accessTokenResponse>;
export type StaffLoginResponse = z.infer<typeof staffLoginResponse>;
export type MfaSetupResponse = z.infer<typeof mfaSetupResponse>;

export const patientEmailLinkBody = z.object({ email: emailSchema });
export const patientEmailVerifyBody = z.object({ token: z.string().min(20).max(200) });
