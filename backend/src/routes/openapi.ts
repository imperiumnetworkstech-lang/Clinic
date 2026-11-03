import {
  accessTokenResponse,
  appointmentRequestBody,
  createStaffBody,
  mfaSetupResponse,
  mfaTokenBody,
  mfaVerifyBody,
  patientOtpSendBody,
  patientOtpVerifyBody,
  staffLoginBody,
  staffLoginResponse,
  staffProfile,
} from '@edc/shared';
import { z } from 'zod';

type Method = 'get' | 'post' | 'patch';

interface Operation {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  auth?: 'staff' | 'patient' | 'cookie';
  permission?: string;
  body?: z.ZodType;
  response?: z.ZodType;
  status?: number;
}

const json = (schema: z.ZodType) =>
  z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any', target: 'draft-2020-12' });

const OPERATIONS: Operation[] = [
  { method: 'get', path: '/health', tag: 'Ops', summary: 'Liveness probe' },
  { method: 'get', path: '/ready', tag: 'Ops', summary: 'Readiness probe (database)' },
  {
    method: 'post',
    path: '/api/v1/auth/staff/login',
    tag: 'Staff auth',
    summary: 'Password sign-in; may require a TOTP code or 2FA enrolment next',
    body: staffLoginBody,
    response: staffLoginResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/staff/2fa/verify',
    tag: 'Staff auth',
    summary: 'Complete sign-in with a TOTP code',
    body: mfaVerifyBody,
    response: accessTokenResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/staff/2fa/setup',
    tag: 'Staff auth',
    summary: 'Start mandatory 2FA enrolment (returns QR code)',
    body: mfaTokenBody,
    response: mfaSetupResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/staff/2fa/enable',
    tag: 'Staff auth',
    summary: 'Confirm enrolment with a first code and sign in',
    body: mfaVerifyBody,
    response: accessTokenResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/staff/refresh',
    tag: 'Staff auth',
    summary: 'Rotate the refresh cookie and get a new access token',
    auth: 'cookie',
    response: accessTokenResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/staff/logout',
    tag: 'Staff auth',
    summary: 'End the session',
    auth: 'cookie',
    status: 204,
  },
  {
    method: 'post',
    path: '/api/v1/auth/patient/otp/send',
    tag: 'Patient auth',
    summary: 'Send a one-time code to a registered phone number',
    body: patientOtpSendBody,
    status: 202,
  },
  {
    method: 'post',
    path: '/api/v1/auth/patient/otp/verify',
    tag: 'Patient auth',
    summary: 'Verify the code and start a portal session',
    body: patientOtpVerifyBody,
    response: accessTokenResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/patient/refresh',
    tag: 'Patient auth',
    summary: 'Rotate the portal session',
    auth: 'cookie',
    response: accessTokenResponse,
  },
  {
    method: 'post',
    path: '/api/v1/auth/patient/logout',
    tag: 'Patient auth',
    summary: 'End the portal session',
    auth: 'cookie',
    status: 204,
  },
  {
    method: 'post',
    path: '/api/v1/public/appointment-requests',
    tag: 'Public',
    summary: 'Website appointment request (stored as a lead for the front desk)',
    body: appointmentRequestBody,
    status: 201,
  },
  {
    method: 'get',
    path: '/api/v1/admin/leads',
    tag: 'Admin',
    summary: 'Enquiries inbox (filter by status, paginated)',
    auth: 'staff',
    permission: 'leads.read',
  },
  {
    method: 'get',
    path: '/api/v1/me',
    tag: 'Patient portal',
    summary: 'Profiles under the signed-in phone number',
    auth: 'patient',
  },
  {
    method: 'get',
    path: '/api/v1/admin/me',
    tag: 'Admin',
    summary: 'Current staff profile and permissions',
    auth: 'staff',
    response: staffProfile,
  },
  {
    method: 'get',
    path: '/api/v1/admin/staff',
    tag: 'Admin',
    summary: 'List staff',
    auth: 'staff',
    permission: 'staff.read',
  },
  {
    method: 'post',
    path: '/api/v1/admin/staff',
    tag: 'Admin',
    summary: 'Create a staff account',
    auth: 'staff',
    permission: 'staff.write',
    body: createStaffBody,
    status: 201,
  },
  {
    method: 'get',
    path: '/api/v1/admin/roles',
    tag: 'Admin',
    summary: 'Roles with their permissions',
    auth: 'staff',
    permission: 'staff.read',
  },
  {
    method: 'get',
    path: '/api/v1/admin/permissions',
    tag: 'Admin',
    summary: 'Permission catalogue',
    auth: 'staff',
    permission: 'roles.manage',
  },
  {
    method: 'get',
    path: '/api/v1/admin/audit-log',
    tag: 'Admin',
    summary: 'Audit trail (paginated)',
    auth: 'staff',
    permission: 'audit.read',
  },
];

/** OpenAPI 3.1 document generated from the shared Zod schemas. Served only outside production. */
export function buildOpenApiDocument(): Record<string, unknown> {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const op of OPERATIONS) {
    const status = String(op.status ?? 200);
    const pathItem = (paths[op.path] ??= {});
    pathItem[op.method] = {
      tags: [op.tag],
      summary: op.summary,
      ...(op.permission ? { description: `Requires permission \`${op.permission}\`.` } : {}),
      ...(op.auth === 'staff' || op.auth === 'patient' ? { security: [{ bearer: [] }] } : {}),
      ...(op.auth === 'cookie' ? { security: [{ refreshCookie: [], csrfHeader: [] }] } : {}),
      ...(op.body
        ? {
            requestBody: {
              required: true,
              content: { 'application/json': { schema: json(op.body) } },
            },
          }
        : {}),
      responses: {
        [status]: {
          description: 'Success',
          ...(op.response
            ? { content: { 'application/json': { schema: json(op.response) } } }
            : {}),
        },
        default: {
          description: 'Problem details (RFC 9457)',
          content: { 'application/problem+json': {} },
        },
      },
    };
  }

  return {
    openapi: '3.1.0',
    info: { title: 'Expressions Dental Clinic API', version: '1.0.0' },
    paths,
    components: {
      securitySchemes: {
        bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
        refreshCookie: { type: 'apiKey', in: 'cookie', name: 'edc_srt' },
        csrfHeader: { type: 'apiKey', in: 'header', name: 'X-CSRF-Token' },
      },
    },
  };
}
