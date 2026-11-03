# Deployment: GitHub → Neon → Vercel

Repository: https://github.com/imperiumnetworkstech-lang/Clinic

The repo deploys as **two Vercel projects**: the website (`frontend/`) and the API (`backend/`). The database is **Neon Postgres** (project `expressions-dental`, id `muddy-bread-85559899`, org Imperium Networks, AWS Singapore, Postgres 18). Deploy in this order: database → website → API, because the API needs the website's URL.

---

## 1. Database (Neon): done 2026-11-03

Created with `neon init` in AWS Asia Pacific (Singapore), the closest Neon region to India. Migrations and the required seed (roles, permissions, both branches, settings) are applied. There is no demo data.

- This folder is linked through `.neon` (gitignored).
- The pooled connection string is in `backend/.env.neon` (gitignored). Copy its `DATABASE_URL` into the Vercel API project.
- Console: https://console.neon.tech/app/projects/muddy-bread-85559899/

Still to do: create the clinic owner's login (it prints a one-time password):

```powershell
cd backend; Get-Content .env.neon | ForEach-Object { $k,$v = $_ -split '=',2; Set-Item "env:$k" $v }; pnpm admin:create --name "Owner Name" --email owner@example.com
```

To apply future migrations, load `backend/.env.neon` the same way and run `pnpm db:migrate`.

> Never run `db:seed -- --demo` against Neon. Demo data is for local development only.

## 2. Website (Vercel project `expressions-dental-web`)

1. At https://vercel.com/new, import `imperiumnetworkstech-lang/Clinic`.
2. Settings:
   - **Project name:** `expressions-dental-web`
   - **Root Directory:** `frontend`
   - **Framework Preset:** React Router (detected automatically)
   - Leave the build and install commands at their defaults.
3. **Environment variables:**

   | Name                           | Value                                                                                                                                                                                                                                                                       |
   | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
   | `ENABLE_EXPERIMENTAL_COREPACK` | `1` (makes Vercel use the pinned pnpm 10)                                                                                                                                                                                                                                   |
   | `API_ORIGIN`                   | the API project's URL from step 3, e.g. `https://expressions-dental-api.vercel.app` (no trailing slash). Booking requests and the `/admin` area use it. Without it the site still works, but bookings are only sent on WhatsApp and not saved, and `/admin` cannot sign in. |
   | `VITE_SITE_URL`                | optional; the canonical domain. It defaults to `https://expressionsdentalclinic.com`.                                                                                                                                                                                       |
   | `VITE_SITE_INDEXABLE`          | leave unset until launch. Set it to `true` only once the domain moves, to let search engines index the site.                                                                                                                                                                |

   Add `API_ORIGIN` after the API is deployed, then redeploy the website.

4. Click **Deploy**. Note the URL, e.g. `https://expressions-dental-web.vercel.app`.

The site is `noindex` until launch, so Google won't index the preview.

## 3. API (Vercel project `expressions-dental-api`)

1. Import the same repository again as a second project.
2. Settings:
   - **Project name:** `expressions-dental-api`
   - **Root Directory:** `backend`
   - **Framework Preset:** Other
   - The build settings come from `backend/vercel.json`.
3. **Environment variables.** Generate each secret on your computer with the command shown, and use a different value for each.

| Name                           | Value                                                                            |
| ------------------------------ | -------------------------------------------------------------------------------- |
| `ENABLE_EXPERIMENTAL_COREPACK` | `1`                                                                              |
| `DATABASE_URL`                 | Neon pooled connection string                                                    |
| `DATABASE_SSL`                 | `true`                                                                           |
| `DATABASE_POOL_MAX`            | `2`                                                                              |
| `APP_ORIGIN`                   | the website URL from step 2, e.g. `https://expressions-dental-web.vercel.app`    |
| `TRUST_PROXY`                  | `true`                                                                           |
| `JWT_ACCESS_SECRET`            | `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `DATA_ENCRYPTION_KEY`          | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`    |
| `HMAC_SECRET`                  | same command as `JWT_ACCESS_SECRET` (a new value)                                |
| `CRON_SECRET`                  | same command as `JWT_ACCESS_SECRET` (a new value)                                |
| `OTP_DELIVERY`                 | `none`                                                                           |
| `EMAIL_DELIVERY`               | `resend` once a sender domain is verified in Resend; until then `none`           |
| `RESEND_API_KEY`               | from resend.com → API Keys (only with `EMAIL_DELIVERY=resend`)                   |
| `EMAIL_FROM`                   | e.g. `Expressions Dental Clinic <appointments@your-verified-domain>`             |
| `ENFORCE_STAFF_2FA`            | `true`                                                                           |
| `LOG_LEVEL`                    | `info`                                                                           |

> ⚠️ **Testing mode:** `ENFORCE_STAFF_2FA=false` lets staff sign in with a password alone (no authenticator code), and the API logs a warning at every start. Set it back to `true` and redeploy before the clinic goes live.

> ⚠️ **Back up `DATA_ENCRYPTION_KEY`** in a password manager. If it is lost, encrypted data (staff 2FA secrets now, clinical notes later) cannot be recovered.

4. Click **Deploy**, then check:
   - `https://expressions-dental-api.vercel.app/health` returns `{"status":"ok"}`
   - `https://expressions-dental-api.vercel.app/ready` returns `{"status":"ready"}` (the database is connected)

If the API fails to start, its logs (Vercel → project → **Logs**) list exactly which environment variable is missing or invalid.

## 4. After it's live

- Every push to `main` redeploys both projects automatically, and pull requests get preview URLs.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the build on every push.
- The custom domain (`expressionsdentalclinic.com`) is moved over at launch (Phase 9), together with the 301 redirects from the old site's URLs, Search Console and the Google Business Profile website link. **Don't point the domain at Vercel before then**, or the old site's Google rankings could drop.
- The website forwards `/api/*` to the API (`API_ORIGIN` on the website project), so the browser only ever talks to one origin.
- With `EMAIL_DELIVERY=none` the patient portal's "Email me a sign-in link" shows a "call us" message; booking itself works either way.
- New migrations run with `pnpm --filter @edc/backend db:migrate` against the Neon URL (load it from `backend/.env.neon`). They are additive; never seed demo data on Neon.
