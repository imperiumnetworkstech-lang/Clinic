# Build Plan & Architecture Decisions

## 1. Architecture

```
expressions-dental/                plain pnpm workspaces (no Turborepo, no Docker)
├─ frontend/       React Router v7 (framework mode) + Vite + TS
│   ├─ app/routes/(public)/…       SSR on every request, CDN-cached (s-maxage + stale-while-revalidate)
│   ├─ app/routes/portal/…         SSR shell, noindex, data client-side via TanStack Query
│   └─ app/routes/admin/…          clientLoader only → separate lazy chunk, never in public bundle
├─ backend/        Express + TS + Sequelize (Postgres), deployed as a Vercel Function
├─ packages/shared Zod schemas, API types, constants (shared by both)   ← addition, see §2
├─ content/        clinic.json, raw crawl, audit
└─ docs/
```

**Runtime (production, Vercel — decided 2026-11-03):**

- The API Function runs in Vercel's Singapore region (`sin1`), next to the database, because each request makes several database round trips. The website stays in Mumbai (`bom1`), close to patients.
- Two Vercel projects from this repo: `frontend` (React Router v7 with the Vercel preset; SSR functions + CDN) and `backend` (the Express app exported as a Vercel Function). The frontend rewrites `/api/*` to the backend, so everything is served from one origin and cookies stay first-party.
- **Postgres: Neon**, project `expressions-dental` in AWS Singapore (`aws-ap-southeast-1`; Neon has no Mumbai region), Postgres 18, pooled connection string.
- **No Redis/BullMQ.** Scheduled work runs as **Vercel Cron**, which calls `/api/v1/cron/*` protected by `CRON_SECRET`. Rate limiting uses a Postgres-backed store (`rate-limiter-flexible`).
- Files: private S3-compatible bucket (Cloudflare R2 recommended) with presigned direct uploads, because Vercel Functions cap request bodies at 4.5 MB. Public images are served by the Vercel CDN.
- Local dev: `embedded-postgres` (a real Postgres started by `pnpm db:start`). **No Docker** (client: keep the project simple).

## 1a. Client decisions (2026-11-03)

| Topic             | Decision                                                                                                  | Effect on plan                                                                                                                                                                                                               |
| ----------------- | --------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Decisions D1–D11  | Approved                                                                                                  | — (D1/D4 adapted to Vercel above; the BullMQ and Redis parts are dropped)                                                                                                                                                    |
| Branches          | **Both open**: Duler (Mapusa) and Candolim                                                                | Two `Location`s, two branch pages, two `Dentist` schema entities                                                                                                                                                             |
| Hours             | Same as Google Business Profile / website                                                                 | Read full weekly hours for both GBP listings in Phase 3                                                                                                                                                                      |
| Phone numbers     | As on the website (+91 96570 41122, +91 96570 61122)                                                      | —                                                                                                                                                                                                                            |
| Prices            | **Not shown publicly**                                                                                    | No cost/EMI estimator; `show_price` stays false; prices exist only in admin billing                                                                                                                                          |
| Booking           | "Same as the old website"                                                                                 | ⚠️ The old site had no slot booking (its button dialled the phone). See open question B1.                                                                                                                                    |
| WhatsApp          | **Manual click-to-send** from the existing WhatsApp Business number (WhatsApp Web/Desktop). No Cloud API. | Phase 6 becomes a reminder queue that generates `wa.me` links with pre-filled template text; staff click Send and mark it sent. No delivery webhooks; logs record "opened/marked sent". Consent and quiet hours still apply. |
| Patient login OTP | Can't go over WhatsApp automatically any more                                                             | See open question B2                                                                                                                                                                                                         |
| Hosting           | Vercel                                                                                                    | See runtime above                                                                                                                                                                                                            |

**Later decisions (2026-11-03):**

| Topic                | Decision                                                                                 |
| -------------------- | ---------------------------------------------------------------------------------------- |
| B1. Booking          | Live slots; the front desk confirms each booking (Phase 4)                               |
| B2. Portal login     | Email magic link (Phase 4)                                                               |
| Slot length          | Set by the clinic in Admin → Schedule (default 30 minutes)                               |
| GST                  | **No GST** on invoices; plain receipts with no tax lines                                 |
| Payments             | Recorded by the front desk (cash / UPI / card, part payments, PDF receipt); Razorpay off |
| Patient file storage | Provider decided before launch; built against a local development store until then       |
| Phase 5 order        | 5a patients, calendar, treatment plans, dashboard, staff → 5b billing and files → 5c CMS |

## 2. Decisions and deviations needing your OK

| #   | Decision                                                                                                            | Why                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | **SSR on request (with CDN caching), not build-time prerender**, for CMS-driven pages. Legal pages are prerendered. | CMS publishes go live instantly with no rebuild pipeline. Crawlers still get full HTML. The "Open now" badge and next free slot hydrate on the client, so cached HTML is never stale on those. |
| D2  | Add **`packages/shared`** to the monorepo                                                                           | The brief asks for Zod schemas shared between frontend and backend, and that needs a package.                                                                                                  |
| D3  | **pnpm workspaces** (Turborepo dropped to keep it simple)                                                           | Fast installs; one lockfile.                                                                                                                                                                   |
| D4  | **PostgreSQL 16** (not MySQL)                                                                                       | Exclusion constraints prevent double-booked slots at the DB level. Also: JSONB, trigram search on patient names, `timestamptz`.                                                                |
| D5  | **Argon2id** for passwords; **TOTP 2FA enforced** for Super Admin and Doctor                                        |                                                                                                                                                                                                |
| D6  | **Fonts: Plus Jakarta Sans + Inter**, replacing Poppins + Nunito                                                    | Performance and premium feel (see DESIGN_SYSTEM.md). Reversible.                                                                                                                               |
| D7  | **Primary colour = logo magenta**; template cyan becomes the secondary teal; template yellow is dropped             | The logo and signage are the real brand.                                                                                                                                                       |
| D8  | **3D model built procedurally** (stylised tooth + 3-part implant) in R3F, exported to GLB with Draco                | No licence risk, small file, on-brand material. A Sketchfab CC model is the fallback.                                                                                                          |
| D9  | **Patient phone OTP** via the same MessagingService (WhatsApp authentication template → SMS fallback)               | One provider integration.                                                                                                                                                                      |
| D10 | Legacy FAQs and blog posts are **migrated as drafts and rewritten**, not republished verbatim                       | Duplicate-content and E-E-A-T risk (see audit).                                                                                                                                                |
| D11 | Google rating shown as a **linked badge** via Places API, cached daily. **No `AggregateRating` in schema.**         | Google policy on self-serving reviews.                                                                                                                                                         |

## 3. Phases (each ends with a stop, a summary, run instructions and screenshots)

| Phase                        | Scope                                                                                                                                                                                                                                                                                                                              | Exit criteria                                                                                 |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| **1. Foundation**            | Monorepo, TS strict, ESLint/Prettier/Husky, embedded Postgres for local dev, Sequelize models + migrations + required/demo seeders, staff auth (JWT + refresh rotation + TOTP), patient OTP auth skeleton, RBAC middleware + permission matrix, audit log, pino, helmet/CORS/rate limits/CSRF, OpenAPI, CI (lint, typecheck, test) | `pnpm dev` boots everything; auth and RBAC covered by Supertest; migrations up/down are clean |
| **2. Design system + shell** | Tokens, Tailwind config, shadcn components (§5 of DESIGN_SYSTEM), desktop header + mega menu, mobile top bar + bottom tab bar + sheets, page transitions, PWA (manifest, icons, splash, offline page, install prompt), cookie banner, a11y toolbar, Storybook-lite component gallery at `/__ui` (dev only)                         | Screenshots at 360/390/414/768/1024/1440/1920; axe clean; UX critique fixed                   |
| **3. Public site + SEO**     | All public pages from `clinic.json` → seeded into the DB/CMS; treatment page template; doctor pages (publish-gated); blog; contact with live hours; emergency and international pages; symptom helper; meta + canonical + OG image generation; JSON-LD; sitemaps; robots; 301 map; 404/500; GA4/GTM consent mode v2                | JS-disabled render check; Rich Results test passes; Lighthouse ≥ 95 on Home and Treatment     |
| **4. Booking + portal**      | Availability engine (slot rules, holidays, leaves, chair capacity, treatment durations, holds), 5-step booking, OTP confirm, WhatsApp/SMS confirmation (stub provider until Phase 6 creds), portal (appointments, plan, reports, family, reschedule/cancel, pull-to-refresh)                                                       | Playwright E2E: book → confirm → reschedule → cancel                                          |
| **5. Admin + CRM**           | Dashboard analytics, calendar (drag-reschedule), patients CRM + timeline + next due, treatment plans, files (S3, previews, expiring share), staff, catalogue, billing (invoices, part payments, PDF receipts, Razorpay-ready), CMS with draft/review/publish, leads pipeline, settings                                             | E2E: admin login + 2FA → check-in → complete visit → invoice                                  |
| **6. Messaging**             | `MessagingService` interface + WhatsApp Cloud API adapter (+ SMS/email fallback), template registry, consent + STOP handling, webhooks → MessageLog, automation rules engine, quiet hours, bulk send with throttling                                                                                                               | Sandbox test numbers deliver; opt-out honoured; logs update via webhook                       |
| **7. 3D + polish**           | Hero/technology 3D tooth, implant explode view, gyro/mouse parallax, static fallback, micro-interactions, before/after slider, counters                                                                                                                                                                                            | LCP unaffected (canvas lazy, below LCP)                                                       |
| **8. Quality**               | Unit/API/E2E coverage, Lighthouse CI budgets, axe on every route, security review (OWASP checklist), dependency audit, load test on availability endpoint                                                                                                                                                                          | DoD checklist green                                                                           |
| **9. Deploy**                | Vercel (frontend + backend projects), Neon Postgres, Vercel Cron; GitHub Actions CI; backups (nightly pg_dump → encrypted S3, restore drill); go-live SEO checklist (redirects, GSC, GBP update, Bing, citations)                                                                                                                  | Live, monitored, handed over                                                                  |

## 3a. Phase 2 status (2026-11-03): done

Delivered: a component library on Radix (Button/ButtonLink, Sheet, Accordion, Card, Badge, IconTile, TextField, Skeleton, EmptyState, SectionHeading); a desktop Treatments mega menu; tablet navigation from 768px; a phone top bar that hides on scroll down; a bottom tab bar (Home · Treatments · Book · Clinics · More) with a More sheet; accessibility settings (3 text sizes, high contrast) applied before first paint; PWA support (manifest, maskable icon, service worker, branded offline page, install prompt plus iOS hint); an analytics consent banner (dormant until `VITE_GA_MEASUREMENT_ID` is set); and a dev-only gallery at `/__ui`. Checked at 360/390/414/768/1024/1440/1920 with no horizontal overflow and all tap targets ≥ 44px. 7 component tests.

Deviations, with reasons:

- **vite-plugin-pwa → a hand-written `public/sw.js`.** The plugin targets SPA builds; the service worker here is about 80 lines, network-first for pages, and never caches `/api`.
- **Page transitions and Framer Motion move to Phase 3/7.** There is only one page so far; the transitions arrive with the Phase 3 routes.
- **Dark mode tokens exist, but no toggle yet.** Components still use light-only surfaces. High contrast (for the elderly persona) took priority. The toggle comes in the Phase 7 polish.
- **The Portal tab is replaced by Clinics** until the portal sign-in channel (B2) is decided.
- **Treatment menu links go to rows on the home page** (`/#t-<slug>`) until Phase 3 adds treatment pages.

## 3b. Phase 3 status (2026-11-03): done, except doctor pages

Delivered:

- **Pages:** 18 treatment pages and a treatments hub, About, Contact (weekly hours and a Goa-time "Open now" badge), FAQ, Emergency, Reviews, International patients, a symptom helper, a blog with 3 rewritten guides, and Privacy policy and Medical disclaimer drafts.
- **Booking and admin:** the booking request form and the staff inbox.
- **SEO:** canonical URLs, Open Graph tags with a branded share image, hreflang scaffolding, and JSON-LD (Organization, WebSite, Dentist per branch, MedicalProcedure, FAQPage, BlogPosting, BreadcrumbList); sitemap.xml (34 URLs); a robots.txt closed until `VITE_SITE_INDEXABLE=true`; 301s from every old-site URL; real 404s.
- **Analytics:** GA4 loads only after consent, with conversion events `book_appointment_start`, `book_appointment_complete`, `click_to_call`, `whatsapp_click` and `directions_click`. It is dormant until `VITE_GA_MEASUREMENT_ID` is set.

Lighthouse (mobile, simulated slow 4G, local production build):

| Page         | Performance | Accessibility | Best practices | SEO |
| ------------ | ----------- | ------------- | -------------- | --- |
| Home         | 87          | 100           | 100            | 100 |
| Treatment    | 90          | 100           | 100            | 100 |
| Booking      | 89          | 100           | 100            | 100 |
| Blog article | 91          | 100           | 100            | 100 |

CLS ≈ 0 everywhere. LCP is 3.1–3.4 s simulated; it is text, waiting on about 200 KB of framework JavaScript plus the heading font. Reaching 95 or more is a Phase 8 task: lazy-load the sheets and menus, trim the root bundle, and re-measure on Vercel with PageSpeed Insights.

Deviations:

- **Body text uses the device's system font; Plus Jakarta Sans stays for headings** (updates D6). Inter was 48 KB on the critical path; the system font looks near-identical and needs no download.
- **Doctor pages wait** for the client to confirm the team, registration numbers and photos.
- **Blog articles are original rewrites** (needs-doctor-review). The old posts duplicated third-party text, so they were not republished.

## 3c. Phase 4 status (2026-11-03): done

Client decisions: live slots that the front desk confirms; portal sign-in by emailed link; slot length set by the clinic in admin (default 30 minutes).

Delivered:

- **Booking:** `/book` shows a day strip and free times for branches with online booking (Duler now; Candolim keeps the request form until the clinic sets its hours). Bookings are held as `pending` with an `APT-` reference; a taken slot returns the patient to the picker with fresh times.
- **Patient portal:** `/portal/login` (emailed link), `/portal/verify` (token removed from the address bar before use), and `/portal` with upcoming and past visits and online rescheduling or cancellation up to 2 hours before (a moved booking goes back to the front desk to confirm). All noindex and excluded from the sitemap and robots.
- **Admin:** Appointments (day view, Confirm / Check in / No-show / Complete / Cancel / Restore, and a pre-filled WhatsApp confirmation that is held back during quiet hours), and Schedule (weekly hours with breaks, appointment length, patients at the same time, notice, booking window and closed days; owner only).
- **Mobile:** the tab bar is now Home · Treatments · Book · Portal · More.
- **Exit check:** a Playwright test (`frontend/e2e/booking.spec.ts`, run in CI) books a slot, has the front desk confirm it, then reschedules and cancels it from the portal.

Waiting on the clinic: Candolim's weekly hours, the number of chairs per branch, and a sender domain for portal emails (Resend).

## 3d. Phase 5a status (2026-11-03): built

- **Dashboard** (`/admin`): today's bookings, bookings to confirm, new enquiries, recalls due, new patients, no-show rate, and a 30-day bookings chart (online vs front desk).
- **Calendar** (`/admin/calendar`): week view (day view on phones), overlapping visits side by side, drag to move with 15-minute snapping, and a details sheet with a move form as the non-drag alternative. Front-desk booking (phone, walk-in, WhatsApp) is confirmed straight away; a full time or busy dentist is refused unless staff choose "book anyway".
- **Patients** (`/admin/patients`): search by name, mobile, email or code; recall-due filter; registration with duplicate detection. The record page has visits, recall, details and consents, a timeline, and, for doctors and owners only, medical history (allergies flagged at the top), clinical notes and treatment plans whose status follows their items.
- **Staff** (`/admin/staff`): add staff, change roles, deactivate; owner accounts are managed only by owners.
- **Security:** clinical text is encrypted at rest; opening a record's clinical part is audited; the dashboard returns counts only.
- Migration `20261103-05-clinical` adds the new tables and columns (additive).

## 3e. Phase 5b status (2026-11-03): built

- **Billing:** invoices from a patient's record (treatment lines with tooth and quantity, discount, optional link to a visit), numbered `INV-000001`; payments by cash, UPI, card or bank transfer, part payments allowed and overpaying refused, receipts numbered `RCT-000001`; void with a reason (payments first, then the invoice). Invoice and receipt PDFs (A4, no GST lines, amounts printed as "Rs." because the standard PDF fonts lack ₹). **Billing** page: the day's collections by method and every balance still due.
- **Files:** X-rays, photos, reports (JPEG, PNG, WebP, PDF, DICOM, up to 15 MB) uploaded straight to storage through a signed link; opened through 5-minute links; a 48-hour share link to send the patient; original file names encrypted; every view, share and delete audited. `FILE_STORAGE=local` is for development only; production shows "File storage isn't set up yet" until a provider is chosen.
- **Phase 5 exit check:** `frontend/e2e/admin.spec.ts` (in CI): owner signs in with two-step verification → registers a patient → books → checks in → completes → invoices → takes payment → sees it in the day's collections.
- Migration `20261103-06-billing-files` (additive).

Next: 5c CMS (draft → doctor review → publish for blog posts, FAQs and treatment pages), plus a price list to pre-fill invoice lines if the clinic wants one.

## 4. Open questions (batched; answers unblock Phase 1–3)

**Business facts (from the content audit — the clinic needs to answer these)**

1. Is the Mapusa clinic at **Vitara Towers or MFA Tower**? Did it move?
2. Is the **Candolim branch still open**? Same doctors and numbers?
3. Opening hours per day for each branch, plus breaks and the holiday list.
4. The current doctor team: full names, registration numbers, qualifications, photos, bios. Which of the 6 names on the shop board are current?
5. Vector logo; any tagline they like.
6. Price ranges per treatment: show them publicly, show "from ₹X", or hide?

**Booking rules** 7. Default slot length (15 / 20 / 30 min?) and per-treatment durations: consultation, scaling, RCT sitting, implant, etc. 8. Do online bookings auto-confirm, or does the front desk confirm them first? 9. How far ahead can patients book (e.g. 30 days)? Minimum notice (e.g. 2 h)? Cancellation cut-off? 10. How many chairs per branch? Should booking be per doctor, per chair, or both? 11. Online deposit via Razorpay: required for some treatments, optional, or off?

**Messaging** 12. WhatsApp provider: **Meta Cloud API direct** (cheapest, more setup) or a BSP like **Interakt / WATI / Gupshup** (dashboard, faster approval)? Does the clinic already have a WhatsApp Business account on 96570 61122? 13. Reminder timing: confirm the 24 h + 2 h reminders, the recall interval (6 months?) and quiet hours of 9 PM–8 AM IST.

**Tech & hosting** 14. Postgres OK? (recommended) 15. Hosting preference/budget: single VPS (e.g. Hetzner/DigitalOcean/AWS Lightsail Mumbai) or managed (Render/Railway + Vercel)? India region matters for latency and data residency. 16. Domain/DNS access, and who owns Google Business Profile, Search Console and GA today? 17. Languages after English: Hindi, Marathi, Konkani?

**Design** 18. Approve **magenta primary + teal secondary** (D7) and the **font change** (D6)?
