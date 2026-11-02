# Build Plan & Architecture Decisions

## 1. Architecture

```
expressions-dental/                pnpm workspaces + Turborepo (task caching)
├─ frontend/       React Router v7 (framework mode) + Vite + TS
│   ├─ app/routes/(public)/…       SSR on every request, CDN-cached (s-maxage + stale-while-revalidate)
│   ├─ app/routes/portal/…         SSR shell, noindex, data client-side via TanStack Query
│   └─ app/routes/admin/…          clientLoader only → separate lazy chunk, never in public bundle
├─ backend/        Express + TS + Sequelize (Postgres), BullMQ workers in a second process
├─ packages/shared Zod schemas, API types, constants (shared by both)   ← addition, see §2
├─ content/        clinic.json, raw crawl, audit
└─ docs/
```

**Runtime (production):**
- Nginx (TLS, Brotli, HTTP/2/3, security headers) in front of `web` (RR7 Node SSR server), `api` (Express), `worker` (BullMQ), Postgres 16 and Redis 7.
- Media lives in S3-compatible storage. Public images go through a CDN; patient files stay in a private bucket and are reached only by signed URL.

## 2. Decisions and deviations needing your OK

| # | Decision | Why |
|---|---|---|
| D1 | **SSR on request (with CDN caching), not build-time prerender**, for CMS-driven pages. Legal pages are prerendered. | CMS publishes go live instantly with no rebuild pipeline. Crawlers still get full HTML. The "Open now" badge and next free slot hydrate on the client, so cached HTML is never stale on those. |
| D2 | Add **`packages/shared`** to the monorepo | The brief asks for Zod schemas shared between frontend and backend, and that needs a package. |
| D3 | **pnpm + Turborepo** | Faster installs and cached lint/test/build in CI. |
| D4 | **PostgreSQL 16** (not MySQL) | Exclusion constraints prevent double-booked slots at the DB level. Also: JSONB, trigram search on patient names, `timestamptz`. |
| D5 | **Argon2id** for passwords; **TOTP 2FA enforced** for Super Admin and Doctor | |
| D6 | **Fonts: Plus Jakarta Sans + Inter**, replacing Poppins + Nunito | Performance and premium feel (see DESIGN_SYSTEM.md). Reversible. |
| D7 | **Primary colour = logo magenta**; template cyan becomes the secondary teal; template yellow is dropped | The logo and signage are the real brand. |
| D8 | **3D model built procedurally** (stylised tooth + 3-part implant) in R3F, exported to GLB with Draco | No licence risk, small file, on-brand material. A Sketchfab CC model is the fallback. |
| D9 | **Patient phone OTP** via the same MessagingService (WhatsApp authentication template → SMS fallback) | One provider integration. |
| D10 | Legacy FAQs and blog posts are **migrated as drafts and rewritten**, not republished verbatim | Duplicate-content and E-E-A-T risk (see audit). |
| D11 | Google rating shown as a **linked badge** via Places API, cached daily. **No `AggregateRating` in schema.** | Google policy on self-serving reviews. |

## 3. Phases (each ends with a stop, a summary, run instructions and screenshots)

| Phase | Scope | Exit criteria |
|---|---|---|
| **1. Foundation** | Monorepo, TS strict, ESLint/Prettier/Husky, Docker Compose (pg, redis, minio, mailpit), Sequelize models + migrations + required/demo seeders, staff auth (JWT + refresh rotation + TOTP), patient OTP auth skeleton, RBAC middleware + permission matrix, audit log, pino, helmet/CORS/rate limits/CSRF, OpenAPI, CI (lint, typecheck, test) | `pnpm dev` boots everything; auth and RBAC covered by Supertest; migrations up/down are clean |
| **2. Design system + shell** | Tokens, Tailwind config, shadcn components (§5 of DESIGN_SYSTEM), desktop header + mega menu, mobile top bar + bottom tab bar + sheets, page transitions, PWA (manifest, icons, splash, offline page, install prompt), cookie banner, a11y toolbar, Storybook-lite component gallery at `/__ui` (dev only) | Screenshots at 360/390/414/768/1024/1440/1920; axe clean; UX critique fixed |
| **3. Public site + SEO** | All public pages from `clinic.json` → seeded into the DB/CMS; treatment page template; doctor pages (publish-gated); blog; contact with live hours; emergency and international pages; symptom helper; meta + canonical + OG image generation; JSON-LD; sitemaps; robots; 301 map; 404/500; GA4/GTM consent mode v2 | JS-disabled render check; Rich Results test passes; Lighthouse ≥ 95 on Home and Treatment |
| **4. Booking + portal** | Availability engine (slot rules, holidays, leaves, chair capacity, treatment durations, holds), 5-step booking, OTP confirm, WhatsApp/SMS confirmation (stub provider until Phase 6 creds), portal (appointments, plan, reports, family, reschedule/cancel, pull-to-refresh) | Playwright E2E: book → confirm → reschedule → cancel |
| **5. Admin + CRM** | Dashboard analytics, calendar (drag-reschedule), patients CRM + timeline + next due, treatment plans, files (S3, previews, expiring share), staff, catalogue, billing (invoices, part payments, PDF receipts, Razorpay-ready), CMS with draft/review/publish, leads pipeline, settings | E2E: admin login + 2FA → check-in → complete visit → invoice |
| **6. Messaging** | `MessagingService` interface + WhatsApp Cloud API adapter (+ SMS/email fallback), template registry, consent + STOP handling, webhooks → MessageLog, automation rules engine, quiet hours, bulk send with throttling | Sandbox test numbers deliver; opt-out honoured; logs update via webhook |
| **7. 3D + polish** | Hero/technology 3D tooth, implant explode view, gyro/mouse parallax, static fallback, micro-interactions, before/after slider, counters | LCP unaffected (canvas lazy, below LCP) |
| **8. Quality** | Unit/API/E2E coverage, Lighthouse CI budgets, axe on every route, security review (OWASP checklist), dependency audit, load test on availability endpoint | DoD checklist green |
| **9. Deploy** | VPS (Nginx + Docker) or Render/Railway; GitHub Actions CD; backups (nightly pg_dump → encrypted S3, restore drill); go-live SEO checklist (redirects, GSC, GBP update, Bing, citations) | Live, monitored, handed over |

## 4. Open questions (batched; answers unblock Phase 1–3)

**Business facts (from the content audit — the clinic needs to answer these)**
1. Is the Mapusa clinic at **Vitara Towers or MFA Tower**? Did it move?
2. Is the **Candolim branch still open**? Same doctors and numbers?
3. Opening hours per day for each branch, plus breaks and the holiday list.
4. The current doctor team: full names, registration numbers, qualifications, photos, bios. Which of the 6 names on the shop board are current?
5. Vector logo; any tagline they like.
6. Price ranges per treatment: show them publicly, show "from ₹X", or hide?

**Booking rules**
7. Default slot length (15 / 20 / 30 min?) and per-treatment durations: consultation, scaling, RCT sitting, implant, etc.
8. Do online bookings auto-confirm, or does the front desk confirm them first?
9. How far ahead can patients book (e.g. 30 days)? Minimum notice (e.g. 2 h)? Cancellation cut-off?
10. How many chairs per branch? Should booking be per doctor, per chair, or both?
11. Online deposit via Razorpay: required for some treatments, optional, or off?

**Messaging**
12. WhatsApp provider: **Meta Cloud API direct** (cheapest, more setup) or a BSP like **Interakt / WATI / Gupshup** (dashboard, faster approval)? Does the clinic already have a WhatsApp Business account on 96570 61122?
13. Reminder timing: confirm the 24 h + 2 h reminders, the recall interval (6 months?) and quiet hours of 9 PM–8 AM IST.

**Tech & hosting**
14. Postgres OK? (recommended)
15. Hosting preference/budget: single VPS (e.g. Hetzner/DigitalOcean/AWS Lightsail Mumbai) or managed (Render/Railway + Vercel)? India region matters for latency and data residency.
16. Domain/DNS access, and who owns Google Business Profile, Search Console and GA today?
17. Languages after English: Hindi, Marathi, Konkani?

**Design**
18. Approve **magenta primary + teal secondary** (D7) and the **font change** (D6)?
