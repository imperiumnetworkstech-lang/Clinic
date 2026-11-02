# API Route List (v1)

Base: `/api/v1`. JSON only. Zod-validated (schemas in `packages/shared`). Errors use RFC 9457 problem+json. Auth is a Bearer access token (15 min) plus an httpOnly `__Host-refresh` cookie (staff: 7 days; patient: 30 days, rotating). CSRF uses a double-submit token on cookie-auth routes. 🔒 = staff auth + the named permission. 👤 = patient auth.

## Public (no auth; rate-limited)
| Method | Path | Purpose |
|---|---|---|
| GET | `/public/clinic` | Clinic info, locations, hours, live open status |
| GET | `/public/treatments` · `/public/treatments/:slug` | Catalogue + page content |
| GET | `/public/doctors` · `/public/doctors/:slug` | |
| GET | `/public/blog?category&page` · `/public/blog/:slug` | |
| GET | `/public/faqs?treatment=` · `/public/testimonials` · `/public/gallery?treatment=` | |
| GET | `/public/availability?treatment&doctor&location&from&to` | Real free slots |
| GET | `/public/availability/next` | Next available slot (hero) |
| POST | `/public/bookings/start` | Hold a slot for 5 min, send OTP → `holdId` |
| POST | `/public/bookings/confirm` | Verify OTP, create Patient (if new) + Appointment + consents |
| POST | `/public/leads` | Contact form, symptom helper, callback request |
| POST | `/public/events` | First-party conversion events (consent-gated) |
| GET | `/public/seo/sitemap/:type.xml` | Sitemaps (also pre-generated at build) |

## Auth
| POST | `/auth/staff/login` · `/auth/staff/2fa/verify` · `/auth/staff/refresh` · `/auth/staff/logout` |
|---|---|
| POST | `/auth/staff/password/forgot` · `/auth/staff/password/reset` · `/auth/staff/invite/accept` |
| POST | `/auth/patient/otp/send` · `/auth/patient/otp/verify` · `/auth/patient/refresh` · `/auth/patient/logout` |

## Patient portal 👤
| GET | `/me` · `/me/family` |
|---|---|
| GET | `/me/appointments?scope=upcoming|past` · POST `/me/appointments` · PATCH `/me/appointments/:id` (reschedule) · POST `/me/appointments/:id/cancel` |
| GET | `/me/treatment-plans` · `/me/recalls` · `/me/invoices` |
| GET | `/me/files` · POST `/me/files/:id/link` (signed URL, 10 min) |
| GET/PUT | `/me/consents` (incl. marketing opt-in/out) · POST `/me/data-requests` (DPDP access/erase) |

## Admin 🔒
| Area | Endpoints |
|---|---|
| Dashboard | GET `/admin/analytics/kpis?from&to&compare` · `/admin/analytics/series/:metric` · `/admin/analytics/heatmap` · `/admin/analytics/funnel` · GET `/admin/analytics/export?format=csv|pdf` |
| Appointments | GET `/admin/appointments?view=day|week|month&doctor&chair&location` · POST · PATCH `/:id` (reschedule/drag) · POST `/:id/status` · GET/POST `/admin/waitlist` |
| Schedule | CRUD `/admin/slot-rules` · `/admin/holidays` · `/admin/leaves` · `/admin/chairs` · `/admin/locations` |
| Patients | GET `/admin/patients?q&tags&due&page` · POST · GET/PATCH `/:id` · GET `/:id/timeline` · CRUD `/:id/medical-history` · `/:id/consents` · `/:id/family` · POST `/admin/patients/import` · GET `/admin/patients/export` |
| Clinical | CRUD `/admin/visits` · `/admin/visits/:id/notes` · `/admin/treatment-plans` (+ steps) · `/admin/recalls` |
| Files | POST `/admin/files` (multipart → S3) · GET `/admin/files/:id/preview` · POST `/admin/files/:id/share` (expiring link, optional WhatsApp send) · DELETE |
| Staff | CRUD `/admin/staff` · POST `/:id/invite` · POST `/:id/reset-password` · PATCH `/:id/role` · GET `/admin/roles` · PUT `/admin/roles/:id/permissions` |
| Catalogue | CRUD `/admin/treatments` |
| Billing | CRUD `/admin/invoices` · POST `/:id/payments` · GET `/:id/pdf` · GET `/admin/dues` · POST `/admin/payments/razorpay/order` · POST `/webhooks/razorpay` |
| CMS | CRUD `/admin/cms/{posts,categories,faqs,testimonials,gallery,banners,pages-seo,doctors}` · POST `/:id/publish` · POST `/:id/request-review` · POST `/:id/approve` (doctor only) |
| Leads | GET `/admin/leads?status` · PATCH `/:id` · POST `/:id/convert` |
| Messaging | CRUD `/admin/messaging/templates` · CRUD `/admin/messaging/rules` · POST `/admin/messaging/send` (single/segment, template-only) · GET `/admin/messaging/logs` |
| Settings | GET/PUT `/admin/settings/:key` · GET `/admin/audit-log` · POST `/admin/backups/export` |

## Webhooks
| POST | `/webhooks/whatsapp` (Meta signature verify; status updates + inbound "STOP" opt-out) · GET `/webhooks/whatsapp` (verify challenge) |
|---|---|
| POST | `/webhooks/sms/:provider` · `/webhooks/razorpay` |

## Ops
GET `/health` · GET `/ready` · `/api/docs` (Swagger UI, non-production only).
