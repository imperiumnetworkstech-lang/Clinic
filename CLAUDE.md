# Expressions Dental Clinic — project rules

Website + mobile-app-like PWA + admin/CRM for Expressions Dental Clinic (Mapusa / Candolim, Goa), built by Imperium Networks. The full brief was supplied as a master prompt; this file keeps the binding rules. The plan lives in `docs/` and content in `content/`.

## Non-negotiables

- **Never invent facts**: no fake doctors, reviews, ratings, stats, prices or certifications. Missing facts use `[[CLIENT TO PROVIDE: …]]` / `[[CLIENT TO CONFIRM: …]]`. New medical copy is marked `needs-doctor-review`. `content/clinic.json` is the single source of truth. Edit `content/clinic.base.json` and re-run `python scripts/extract_content.py .`.
- No fabricated `AggregateRating` schema. Google rating shown only as a linked badge.
- WhatsApp is **manual click-to-send** (client decision 2026-11-03): the app builds `wa.me` links with pre-filled template text and staff send them from WhatsApp Web/Desktop. Never automate WhatsApp Web. Keep a provider-agnostic `MessagingService` so the Cloud API can be added later. Explicit opt-in, honoured opt-out, quiet hours 9 PM–8 AM IST.
- Prices are never shown on the public site (client decision).
- Hosting is Vercel (frontend + backend as Functions), with Neon Postgres and Vercel Cron. No Redis/BullMQ. See `docs/BUILD_PLAN.md` §1/1a.
- No PHI in URLs, logs or analytics. Patient files are reached only through signed expiring URLs. Clinical fields are encrypted at rest. Design for India's DPDP Act 2023.
- Demo seed data is clearly fake ("Demo Patient 01") and never runs in production.

## Stack

pnpm workspaces (`frontend`, `backend`, `packages/shared`, `content`, `docs`). Frontend: React Router v7 framework mode (SSR for public pages), TS, Vite, Tailwind + CSS-variable tokens, shadcn/ui (Radix), Framer Motion (respect reduced motion), R3F/drei, TanStack Query/Table, RHF + Zod, Recharts, Lucide, vite-plugin-pwa. Backend: Node LTS, Express, TS, Sequelize + PostgreSQL (migrations only, never `sync({force})`), Zod, JWT access + httpOnly rotating refresh cookie, argon2id, TOTP for admins, Vercel Cron for jobs, presigned uploads to S3-compatible storage, pino, Sentry-ready, OpenAPI at `/api/docs` (dev only), helmet / CORS allow-list / Postgres-backed rate limits / CSRF.

## Quality bar

Strict TS (no `any`), ESLint + Prettier + Husky. No console logs, TODO stubs or commented-out code in finished phases. Vitest + RTL, Supertest, Playwright (booking, admin login). Lighthouse mobile ≥ 95 in all four categories; LCP < 2.0s, INP < 200ms, CLS < 0.05; WCAG 2.2 AA with zero critical axe issues; tap targets ≥ 44px. Mobile (< 768px) gets a bottom tab bar (Home · Treatments · Book · Portal · More), bottom sheets and page transitions. The 3D canvas must never be the LCP element.

## Process

- Work in the phases defined in `docs/BUILD_PLAN.md`. Stop at the end of each phase to summarise, give run instructions and say what's next.
- After UI phases, screenshot at 360/390/414/768/1024/1440/1920, critique as the UX researcher, and fix.
- Batch business-rule questions instead of assuming.
- Make small logical commits. Keep `docs/README.md` current.
- Footer credit: "Designed & developed by Imperium Networks".
