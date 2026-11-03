import { z } from 'zod';

const booleanString = z.enum(['true', 'false']).transform((value) => value === 'true');

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().default(4000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.url(),
    DATABASE_SSL: booleanString.default(false),
    DATABASE_POOL_MAX: z.coerce.number().int().positive().default(5),

    /** Public origin of the website (used for CORS and links). */
    APP_ORIGIN: z.url(),
    /** Extra comma-separated origins allowed by CORS (e.g. Vercel preview URLs). */
    CORS_ORIGINS: z.string().default(''),
    TRUST_PROXY: booleanString.default(false),

    JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().default(900),
    STAFF_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
    PATIENT_REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(30),

    /** base64-encoded 32-byte key for AES-256-GCM field encryption. */
    DATA_ENCRYPTION_KEY: z.string().refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'DATA_ENCRYPTION_KEY must be 32 bytes, base64-encoded',
    }),
    /** Secret for HMAC lookups (OTP codes, phone hashes). */
    HMAC_SECRET: z.string().min(32),

    TOTP_ISSUER: z.string().default('Expressions Dental'),
    ENFORCE_STAFF_2FA: booleanString.default(true),

    /** How patient OTP codes are delivered. `log` writes them to the dev log; never in production. */
    OTP_DELIVERY: z.enum(['log', 'none']).default('none'),

    CRON_SECRET: z.string().min(32).optional(),

    /** Patient portal sign-in emails. `log` prints links to the dev log (never in production). */
    EMAIL_DELIVERY: z.enum(['log', 'resend', 'none']).default('none'),
    RESEND_API_KEY: z.string().min(10).optional(),
    /** Verified sender, e.g. "Expressions Dental Clinic <noreply@expressionsdentalclinic.com>". */
    EMAIL_FROM: z.string().min(3).optional(),
    /**
     * Patient files (X-rays, photos, reports). `local` keeps them on this machine's disk, for
     * development only; `none` turns uploads off. A cloud provider is added before launch.
     */
    FILE_STORAGE: z.enum(['local', 'none']).default('none'),
    FILE_STORAGE_DIR: z.string().default('.data/files'),
  })
  .superRefine((env, ctx) => {
    if (env.EMAIL_DELIVERY === 'resend' && (!env.RESEND_API_KEY || !env.EMAIL_FROM)) {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_DELIVERY'],
        message: 'resend needs RESEND_API_KEY and EMAIL_FROM',
      });
    }
    if (env.NODE_ENV !== 'production') return;
    if (env.FILE_STORAGE === 'local') {
      ctx.addIssue({
        code: 'custom',
        path: ['FILE_STORAGE'],
        message: 'local file storage is for development; serverless disks are not kept',
      });
    }
    if (env.EMAIL_DELIVERY === 'log') {
      ctx.addIssue({
        code: 'custom',
        path: ['EMAIL_DELIVERY'],
        message: 'log delivery is dev-only',
      });
    }
    if (env.OTP_DELIVERY === 'log') {
      ctx.addIssue({ code: 'custom', path: ['OTP_DELIVERY'], message: 'log delivery is dev-only' });
    }
    if (!env.ENFORCE_STAFF_2FA) {
      ctx.addIssue({
        code: 'custom',
        path: ['ENFORCE_STAFF_2FA'],
        message: 'staff 2FA cannot be disabled in production',
      });
    }
  });

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${details}`);
  }
  return parsed.data;
}

export const env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';

export const corsOrigins = [
  env.APP_ORIGIN,
  ...env.CORS_ORIGINS.split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
];
