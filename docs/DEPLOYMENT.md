# Deployment: GitHub → Neon → Vercel

Repository: https://github.com/imperiumnetworkstech-lang/Clinic

The repo deploys as **two Vercel projects**: the website (`frontend/`) and the API (`backend/`). The database is **Neon Postgres** in Mumbai. Deploy in this order: database → website → API, because the API needs the website's URL.

---

## 1. Database (Neon), about 5 minutes

1. Sign in at https://console.neon.tech and create a project:
   - Name: `expressions-dental`
   - Postgres version: **17**
   - Region: **AWS Asia Pacific 1 (Mumbai)**
2. Open **Connection Details** and switch on **Pooled connection**. Copy the connection string. It looks like:
   `postgresql://USER:PASSWORD@ep-xxxx-pooler.ap-south-1.aws.neon.tech/neondb?sslmode=require`
3. Make sure `backend/.env` is complete (every secret filled in; see `backend/.env.example`). The scripts load it for everything except the database URL you pass below.
4. Create the tables and reference data from your computer, in PowerShell from the project folder. Paste your Neon string where it says `<NEON_URL>`:

```powershell
$env:DATABASE_URL = "<NEON_URL>"; $env:DATABASE_SSL = "true"; pnpm db:migrate; pnpm db:seed
```

5. Create the clinic owner's login. It prints a one-time password; keep it safe:

```powershell
$env:DATABASE_URL = "<NEON_URL>"; $env:DATABASE_SSL = "true"; pnpm --filter @edc/backend admin:create --name "Owner Name" --email owner@example.com
```

> Never run `db:seed -- --demo` against Neon. Demo data is for local development only.

## 2. Website (Vercel project `expressions-dental-web`)

1. At https://vercel.com/new, import `imperiumnetworkstech-lang/Clinic`.
2. Settings:
   - **Project name:** `expressions-dental-web`
   - **Root Directory:** `frontend`
   - **Framework Preset:** React Router (detected automatically)
   - Leave the build and install commands at their defaults.
3. **Environment variables:** add `ENABLE_EXPERIMENTAL_COREPACK` = `1`. This makes Vercel use the pinned pnpm 10.
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
| `ENFORCE_STAFF_2FA`            | `true`                                                                           |
| `LOG_LEVEL`                    | `info`                                                                           |

> ⚠️ **Back up `DATA_ENCRYPTION_KEY`** in a password manager. If it is lost, encrypted data (staff 2FA secrets now, clinical notes later) cannot be recovered.

4. Click **Deploy**, then check:
   - `https://expressions-dental-api.vercel.app/health` returns `{"status":"ok"}`
   - `https://expressions-dental-api.vercel.app/ready` returns `{"status":"ready"}` (the database is connected)

If the API fails to start, its logs (Vercel → project → **Logs**) list exactly which environment variable is missing or invalid.

## 4. After it's live

- Every push to `main` redeploys both projects automatically, and pull requests get preview URLs.
- GitHub Actions (`.github/workflows/ci.yml`) runs lint, typecheck, tests and the build on every push.
- The custom domain (`expressionsdentalclinic.com`) is moved over at launch (Phase 9), together with the 301 redirects from the old site's URLs, Search Console and the Google Business Profile website link. **Don't point the domain at Vercel before then**, or the old site's Google rankings could drop.
- Website ↔ API wiring (a `/api` rewrite on the website domain) is added in Phase 4, when the website starts calling the API.
