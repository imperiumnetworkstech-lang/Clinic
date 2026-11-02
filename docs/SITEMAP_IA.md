# Sitemap & Information Architecture

## 1. Public sitemap (all SSR / pre-rendered, indexable)

```
/                                   Home
/about                              About · story, hygiene & sterilisation, technology
/doctors                            Doctor listing
/doctors/:slug                      Doctor profile (Physician schema)
/treatments                         Treatments hub (grouped by category)
/treatments/:category               general | advanced | cosmetic   (category landing)
/treatments/:category/:slug ──┐     NOT used; see note below
/treatments/:slug             ◄─────  One page per treatment (18 at launch)
/smile-gallery                      Before/after + clinic photos (filter by treatment)
/reviews                            Testimonials + Google rating link
/blog                               Dental care guides (paginated: /blog?page=2 → canonical rules below)
/blog/category/:slug
/blog/:slug                         Article (BlogPosting, reviewed-by doctor)
/faq                                General FAQs (FAQPage)
/emergency-dentist-goa              Emergency landing page
/international-patients             Dental-tourism page (P5)
/locations/mapusa                   Branch page (only if 2 branches are confirmed;
/locations/candolim                  otherwise contact page covers it)
/contact                            Map, directions, hours, live "Open now"
/book                               Booking flow (indexable landing; steps are client state, not URLs)
/symptom-checker                    "What's bothering you?" helper
/privacy-policy  /terms  /cookie-policy  /medical-disclaimer
```

**Flat treatment URLs.** Treatment URLs are flat (`/treatments/dental-implants`), as the brief specifies. The category is a filter and a breadcrumb, not a URL segment. That keeps URLs stable if a treatment moves category.

### Treatment slugs (from legacy content)
| Category | Treatments |
|---|---|
| general | root-canal-treatment, dental-fillings, tooth-scaling (→ display "Teeth Cleaning & Scaling"), dentures, dental-crowns, tooth-extraction, child-dental-care (→ "Kids Dentistry") |
| advanced | dental-implants, gum-surgery, orthodontic-treatment (braces & aligners), impacted-wisdom-tooth-removal |
| cosmetic | smile-designing, laminate-veneers, ceramic-crowns, cad-cam-crowns, gum-depigmentation, teeth-whitening, tooth-jewellery |

The slugs are chosen for search intent, not legacy wording: "teeth-whitening" over "dental-bleaching", "impacted-wisdom-tooth-removal" over "dental-impaction", "gum-depigmentation" over "gum-shaping". The page `<h1>` can still use the clinic's preferred name.

## 2. Private areas (`noindex, nofollow`, disallowed in robots.txt, excluded from sitemap)
```
/portal              Patient portal (phone OTP): home, appointments, plan, reports, family, profile
/portal/login
/admin               Staff panel (separate JS bundle, client-rendered)
  /admin/dashboard  /admin/appointments  /admin/patients/:id  /admin/leads
  /admin/staff  /admin/treatments  /admin/billing  /admin/cms/*  /admin/messaging/*  /admin/settings
/api/*
```

## 3. Navigation

**Desktop header:** Logo · Treatments (mega-menu by category) · Doctors · Smile Gallery · About · Blog · Contact · [Open now pill] · **Call** (ghost button) · **Book Appointment** (primary)

**Mobile (<768px):** collapsing top bar (logo + Call icon + WhatsApp icon), plus a bottom tab bar:
`Home · Treatments · ( Book ) · Portal · More`, where **More** opens a bottom sheet with Doctors, Gallery, Reviews, Blog, FAQ, Contact, Emergency, International patients and Legal.

**Footer:** NAP per branch with hours, quick links, top treatments, social links, legal links, and "Designed & developed by Imperium Networks".

## 4. Internal linking model
- Treatment ↔ 2–3 related treatments, 1–3 blog guides, and the doctors who perform it.
- Blog post → its primary treatment page (contextual CTA) and the reviewing doctor's profile.
- Doctor → treatments they perform and posts they reviewed.
- Every page → booking, pre-filled with context (`/book?treatment=dental-implants&doctor=dr-sandeep`).

## 5. 301 redirect map (legacy → new)

| Legacy | New |
|---|---|
| `/about` | `/about` |
| `/service` | `/treatments` |
| `/service/view/1` | `/treatments/general` |
| `/service/view/2` | `/treatments/advanced` |
| `/service/view/19` | `/treatments/cosmetic` |
| `/service/view/:id` (any other) | `/treatments` |
| `/photo-gallery` | `/smile-gallery` |
| `/news` | `/blog` |
| `/news/view/2` | `/blog/how-to-brush-your-teeth-properly` |
| `/news/view/4` | `/blog/oral-cancer-signs-symptoms-risk-factors` |
| `/news/view/6` | `/blog/how-to-choose-the-right-toothbrush` |
| `/news/view/:id` (any other) | `/blog` |
| `/category/:id` | `/blog` |
| `/faq` | `/faq` |
| `/contact` | `/contact` |
| `/single-blog.html` | `/blog` |
| `/index.php/*` | strip prefix, then re-apply map (CodeIgniter fallback) |
| `www.` host | apex (or the reverse; one canonical host, HTTPS only) |

## 6. Pagination & facets
- `/blog?page=n` is self-canonical, with `rel=prev/next` omitted (Google ignores it) and paginated pages kept indexable.
- Gallery/treatment filters are client-side state, or `?filter=` with the canonical pointing to the unfiltered page.
