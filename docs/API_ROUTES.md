# API Route List (v1)

Base: `/api/v1`. JSON only. Zod-validated (schemas in `packages/shared`). Errors use RFC 9457 problem+json. Auth is a Bearer access token (15 min) plus an httpOnly `__Host-refresh` cookie (staff: 7 days; patient: 30 days, rotating). CSRF uses a double-submit token on cookie-auth routes. 🔒 = staff auth + the named permission. 👤 = patient auth.

## Public (no auth; rate-limited)

| Method | Path                                                                              | Purpose                                                      |
| ------ | --------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| GET    | `/public/clinic`                                                                  | Clinic info, locations, hours, live open status              |
| GET    | `/public/treatments` · `/public/treatments/:slug`                                 | Catalogue + page content                                     |
| GET    | `/public/doctors` · `/public/doctors/:slug`                                       |                                                              |
| GET    | `/public/blog?category&page` · `/public/blog/:slug`                               |                                                              |
| GET    | `/public/faqs?treatment=` · `/public/testimonials` · `/public/gallery?treatment=` |                                                              |
| GET    | `/public/availability?treatment&doctor&location&from&to`                          | Real free slots                                              |
| GET    | `/public/availability/next`                                                       | Next available slot (hero)                                   |
| POST   | `/public/bookings/start`                                                          | Hold a slot for 5 min, send OTP → `holdId`                   |
| POST   | `/public/bookings/confirm`                                                        | Verify OTP, create Patient (if new) + Appointment + consents |
| POST   | `/public/leads`                                                                   | Contact form, symptom helper, callback request               |
| POST   | `/public/events`                                                                  | First-party conversion events (consent-gated)                |
| GET    | `/public/seo/sitemap/:type.xml`                                                   | Sitemaps (also pre-generated at build)                       |

## Auth

| POST | `/auth/staff/login` · `/auth/staff/2fa/verify` · `/auth/staff/refresh` · `/auth/staff/logout`            |
| ---- | -------------------------------------------------------------------------------------------------------- |
| POST | `/auth/staff/password/forgot` · `/auth/staff/password/reset` · `/auth/staff/invite/accept`               |
| POST | `/auth/patient/otp/send` · `/auth/patient/otp/verify` · `/auth/patient/refresh` · `/auth/patient/logout` |

## Patient portal 👤

| GET     | `/me` · `/me/family`                                                                       |
| ------- | ------------------------------------------------------------------------------------------ |
| GET     | `/me/appointments?scope=upcoming                                                           | past`· POST`/me/appointments`· PATCH`/me/appointments/:id`(reschedule) · POST`/me/appointments/:id/cancel` |
| GET     | `/me/treatment-plans` · `/me/recalls` · `/me/invoices`                                     |
| GET     | `/me/files` · POST `/me/files/:id/link` (signed URL, 10 min)                               |
| GET/PUT | `/me/consents` (incl. marketing opt-in/out) · POST `/me/data-requests` (DPDP access/erase) |

## Admin 🔒

**Built so far (Phases 3–5a).** All under `/api/v1/admin`, staff bearer token, permission in brackets:

| Area         | Endpoints                                                                                                                                                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard    | GET `/dashboard` [dashboard.read]: today by status, to confirm, new enquiries, recalls due, new patients, no-show rate, bookings per day (counts only)                                                                                                                                                                              |
| Appointments | GET `/appointments?date&branch` · PATCH `/appointments/:id` {status} · POST `/appointments` (front desk, confirmed; `force` to double-book) · PATCH `/appointments/:id/time` (move) · GET `/calendar?from&days&branch` · GET `/dentists`                                                                                            |
| Schedule     | GET `/schedules` · PUT `/schedules/:branch` [settings.write] · POST `/schedules/:branch/holidays` · DELETE `/holidays/:id`                                                                                                                                                                                                          |
| Patients     | GET `/patients?q&recall=due&page` · POST `/patients` (409 `patient_exists` with its id) · GET `/patients/:id` (record + timeline; clinical part only with clinical.read, and audited) · PATCH `/patients/:id` (incl. recall)                                                                                                        |
| Clinical     | PUT `/patients/:id/medical-history` · POST `/patients/:id/notes` · POST `/patients/:id/plans` · PATCH `/plans/:id` · PATCH `/plan-items/:id` [clinical.write]. Free text is AES-256-GCM encrypted at rest.                                                                                                                          |
| Staff        | GET `/staff` · POST `/staff` · PATCH `/staff/:id` {name, phone, role, status} (owners only for owner accounts; no self role/status change; role change or deactivation ends sessions) · GET `/roles`                                                                                                                                |
| Billing      | POST `/invoices` · GET `/invoices?patientId&due=true` · GET `/invoices/:id` · POST `/invoices/:id/payments` (no overpaying) · POST `/invoices/:id/void` · POST `/payments/:id/void` · GET `/invoices/:id/pdf` · GET `/payments/:id/receipt` · GET `/billing/summary?date` [billing.read / billing.write]. Amounts in paise; no GST. |
| Files        | GET/POST `/patients/:id/files` · POST `/files/:id/complete` · GET `/files/:id/url` (5-minute link) · POST `/files/:id/share` {hours ≤ 168} · DELETE `/files/:id` [clinical.read / clinical.write]. Development store: PUT/GET `/api/v1/storage/{upload,object}/:token` (signed, expiring).                                          |
| Leads        | GET `/leads?status` · PATCH `/leads/:id`                                                                                                                                                                                                                                                                                            |

The full target design follows.

| Area         | Endpoints                                                                                                                                                                                                            |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dashboard    | GET `/admin/analytics/kpis?from&to&compare` · `/admin/analytics/series/:metric` · `/admin/analytics/heatmap` · `/admin/analytics/funnel` · GET `/admin/analytics/export?format=csv                                   | pdf` |
| Appointments | GET `/admin/appointments?view=day                                                                                                                                                                                    | week | month&doctor&chair&location`· POST · PATCH`/:id`(reschedule/drag) · POST`/:id/status`· GET/POST`/admin/waitlist` |
| Schedule     | CRUD `/admin/slot-rules` · `/admin/holidays` · `/admin/leaves` · `/admin/chairs` · `/admin/locations`                                                                                                                |
| Patients     | GET `/admin/patients?q&tags&due&page` · POST · GET/PATCH `/:id` · GET `/:id/timeline` · CRUD `/:id/medical-history` · `/:id/consents` · `/:id/family` · POST `/admin/patients/import` · GET `/admin/patients/export` |
| Clinical     | CRUD `/admin/visits` · `/admin/visits/:id/notes` · `/admin/treatment-plans` (+ steps) · `/admin/recalls`                                                                                                             |
| Files        | POST `/admin/files` (multipart → S3) · GET `/admin/files/:id/preview` · POST `/admin/files/:id/share` (expiring link, optional WhatsApp send) · DELETE                                                               |
| Staff        | CRUD `/admin/staff` · POST `/:id/invite` · POST `/:id/reset-password` · PATCH `/:id/role` · GET `/admin/roles` · PUT `/admin/roles/:id/permissions`                                                                  |
| Catalogue    | CRUD `/admin/treatments`                                                                                                                                                                                             |
| Billing      | CRUD `/admin/invoices` · POST `/:id/payments` · GET `/:id/pdf` · GET `/admin/dues` · POST `/admin/payments/razorpay/order` · POST `/webhooks/razorpay`                                                               |
| CMS          | CRUD `/admin/cms/{posts,categories,faqs,testimonials,gallery,banners,pages-seo,doctors}` · POST `/:id/publish` · POST `/:id/request-review` · POST `/:id/approve` (doctor only)                                      |
| Leads        | GET `/admin/leads?status` · PATCH `/:id` · POST `/:id/convert`                                                                                                                                                       |
| Messaging    | CRUD `/admin/messaging/templates` · CRUD `/admin/messaging/rules` · POST `/admin/messaging/send` (single/segment, template-only) · GET `/admin/messaging/logs`                                                       |
| Settings     | GET/PUT `/admin/settings/:key` · GET `/admin/audit-log` · POST `/admin/backups/export`                                                                                                                               |

## Webhooks

| POST | `/webhooks/whatsapp` (Meta signature verify; status updates + inbound "STOP" opt-out) · GET `/webhooks/whatsapp` (verify challenge) |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------- |
| POST | `/webhooks/sms/:provider` · `/webhooks/razorpay`                                                                                    |

## Ops

GET `/health` · GET `/ready` · `/api/docs` (Swagger UI, non-production only).
