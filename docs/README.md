# Expressions Dental Clinic — developer guide

Public website, patient portal and clinic admin/CRM. Built by Imperium Networks.

| Path               | What                                                                                                  |
| ------------------ | ----------------------------------------------------------------------------------------------------- |
| `frontend/`        | React Router v7 (SSR) + Vite + Tailwind. Deployed to Vercel.                                          |
| `backend/`         | Express + Sequelize + PostgreSQL API. Deployed to Vercel as a Function.                               |
| `packages/shared/` | Zod schemas, permission catalogue and types used by both.                                             |
| `content/`         | `clinic.json` (single source of truth for clinic facts), the legacy-site crawl and the content audit. |
| `docs/`            | Plan, research, design system, database and API docs.                                                 |
| `scripts/`         | Python content extraction and palette generation.                                                     |

## Prerequisites

- Node.js 22 or 24 (`.nvmrc` says 24; newer versions also work locally).
- **pnpm 10**: `npm install -g pnpm@10.34.9`. The repo pins pnpm 10 because that is what Vercel builds with. If you have pnpm 11+ installed and it fails to switch versions, run any command as `npx pnpm@10.34.9 <command>`.
- No Docker and no system Postgres. A real PostgreSQL 17 runs from npm packages (`embedded-postgres`).

## First-time setup

```bash
pnpm install
cp backend/.env.example backend/.env       # then fill in the secrets (commands are in the file)
pnpm db:start                              # terminal 1: keeps Postgres running (data in backend/.data/pg)
pnpm db:migrate                            # terminal 2
pnpm db:seed                               # roles, permissions, both branches, settings
pnpm --filter @edc/backend db:seed -- --demo   # optional fake staff + patients (needs DEMO_SEED_PASSWORD)
pnpm dev                                   # API on :4000, website on :5173 (proxies /api)
```

Create the clinic owner's real account (prints a one-time password; the owner sets up 2FA at first sign-in):

```bash
pnpm --filter @edc/backend admin:create --name "Owner Name" --email owner@example.com
```

## Scripts (root)

| Command                                    | Does                                                                                                                                                                                                                                               |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev` / `dev:api` / `dev:web`         | Run both apps or one                                                                                                                                                                                                                               |
| `pnpm db:start` · `db:migrate` · `db:seed` | Local database lifecycle (`pnpm --filter @edc/backend db:rollback` reverts the last migration)                                                                                                                                                     |
| `pnpm test`                                | Shared, frontend (Vitest + Testing Library, jsdom) and backend tests. The backend suite boots its own throwaway Postgres on port 54339.                                                                                                            |
| `pnpm --filter @edc/frontend images`       | Regenerate responsive AVIF/WebP photos from `frontend/public/images/original`                                                                                                                                                                      |
| `pnpm --filter @edc/frontend e2e`          | Playwright end-to-end flows (booking, admin visit-to-invoice, content publishing). Starts its own throwaway Postgres, API (port 4100, `backend/scripts/e2e-stack.ts`, fake demo data) and website (port 5174), so it can run alongside `pnpm dev`. |
| `pnpm lint` · `format` · `typecheck`       | Quality gates (also run by CI and, for staged files, the pre-commit hook)                                                                                                                                                                          |

API docs (Swagger UI) are at http://localhost:4000/api/docs in development only.

The component gallery (every UI building block and the colour tokens) is at http://localhost:5173/__ui in development only. It is not included in production builds.

## Architecture notes

- **Auth.** Staff: email + password (argon2id). Owners and doctors must use TOTP 2FA (`ENFORCE_STAFF_2FA` may be set false only outside production). Access JWTs last 15 minutes. Refresh tokens rotate, are stored hashed, live in an httpOnly SameSite=Strict cookie scoped to `/api/v1/auth`, and reuse of an old token revokes the whole session. Refresh and logout also need the `X-CSRF-Token` header (double submit). Every authenticated request re-checks that the user is active and the session is live.
- **Patients** sign in to the portal (`/portal`) with a one-time emailed link (15 minutes, single use). One login covers every profile with that email, e.g. a parent and their children. Delivery is pluggable (`backend/src/services/emailDelivery.ts`: `log` in dev, `resend` in production). A phone OTP endpoint also exists but has no production channel yet (`otp_unavailable`).
- **Booking.** Branches with an active schedule (`location_schedules`) offer live slots on `/book`; others fall back to the request form. Slots are computed in Goa time (`services/availability.ts`), and booking locks the branch's schedule row so two people can't take the last place. Online bookings start as `pending`; the front desk confirms in Admin → Appointments and sends the WhatsApp confirmation by hand.
- **RBAC.** The permission keys and default role matrix live in `packages/shared/src/permissions.ts`. The DB tables `roles` / `role_permissions` are seeded from them. Guard routes with `requireStaff` + `requirePermission('key')`.
- **Audit.** `audit(req, {...})` writes append-only rows. Never put PHI in `meta`. Patient actors are stored as an HMAC of their phone.
- **Rate limits** are a Postgres fixed window (`services/rateLimit.ts`), so they hold across serverless instances without Redis.
- **Encryption.** `lib/crypto.ts` provides AES-256-GCM with a key-version prefix (TOTP secrets now, clinical fields later).
- **Migrations** are TypeScript files registered in `src/db/migrator.ts` (explicit list, so the Vercel bundler can trace them). Never use `sequelize.sync()`.

### Adding things

- **A migration:** add `src/db/migrations/<date>-<nn>-<name>.ts` exporting `up`/`down`, and register it in `migrator.ts`.
- **A permission:** add it to `PERMISSIONS` (and to role defaults if needed) in `packages/shared`, then run `pnpm db:seed`. The owner role picks up new permissions automatically. Other roles keep their edited sets.
- **Clinic facts:** edit `content/clinic.base.json`, then run `python scripts/extract_content.py .`.
- Treatments, doctors, blog posts and WhatsApp templates: documented when those modules land (Phases 3–6).

## Environment variables

All backend variables are documented in [`backend/.env.example`](../backend/.env.example) and validated at startup by `backend/src/config/env.ts`. The app refuses to boot with a missing or unsafe value, e.g. `OTP_DELIVERY=log` or 2FA disabled in production.

## Deployment

Step-by-step GitHub → Neon → Vercel instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).
