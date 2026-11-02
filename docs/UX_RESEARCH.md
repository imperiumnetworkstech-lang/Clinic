# UX Research — Expressions Dental Clinic

_Desk research by the Principal UX Researcher hat, 2026-11-03. Inputs: the legacy site crawl, the clinic's Google Business Profile (4.6★ / 59 reviews), the website testimonials, local competitor listings, and established healthcare UX patterns. **No primary research (interviews) has been done yet.** §6 proposes a lightweight round with front-desk staff and 5 patients._

## 1. Context

- A dental practice in **Duler, Mapusa** (North Goa's commercial town, mostly local families), plus a listed branch in **Candolim** (tourist beach belt, international visitors). The Candolim branch still needs confirming.
- Review themes on Google: _"pain free experience"_, _"at home atmosphere"_, _"reasonable fees"_, _"explanation of options"_, long-term family patients, and UK visitors who return yearly.
- The current site's only conversion paths are a phone number and a WhatsApp link. "Book Appointment" dials the phone. There is no booking, no doctor info, no hours, and no prices.

## 2. Personas

### P1 — Rhea, 29, "It hurts and I'm scared" (anxious first-timer in pain)

- **Context:** Mapusa local, toothache since last night, on a phone with 4G, hasn't seen a dentist in years and dreads it.
- **Job to be done:** _"Get this pain looked at today, by someone who won't judge me or hurt me."_
- **Needs:** whether they're open now, the earliest slot, a one-tap call or WhatsApp, reassurance about pain ("painless RCT", microscope), a rough cost so there are no surprises.
- **Frictions to remove:** long forms, account creation, medical jargon, hidden hours.
- **Design response:** an "Open now · closes 8 pm" badge and the next free slot in the hero; Call, WhatsApp and Book in the thumb zone; an Emergency page; a symptom helper that ends in a booking, not a diagnosis.

### P2 — Sanjay, 38, booking for his 6-year-old (parent)

- **JTBD:** _"Find a dentist who is good with kids and fits around school."_
- **Needs:** a pedodontist (the specialists board lists one), evening and weekend slots, what to expect at a first visit, booking for a dependant without creating two accounts.
- **Design response:** a "Who is this appointment for? Me / My child / Someone else" step; family linking in the portal; a "Child Dental Care" page with a first-visit guide; reminders sent to the parent's WhatsApp.

### P3 — Aisha, 26, wants a better smile (cosmetic seeker)

- **JTBD:** _"See real results and know what it'll cost before I commit."_
- **Needs:** before/after photos, options compared (veneers, whitening, aligners, smile design), price ranges, EMI, Instagram-grade visuals, and a consultation that feels low-pressure.
- **Design response:** a smile gallery filtered by treatment (once consented cases exist), a comparison table, a cost/EMI estimator (only if prices are given), and a soft "Book a smile consultation" CTA.

### P4 — Mr. Fernandes, 68, missing teeth (elderly: implants and dentures)

- **JTBD:** _"Understand whether implants or dentures are right for me, and talk to a person."_
- **Needs:** large readable text, plain language, a phone number before anything else, clear numbers of sittings and recovery, family members who often book for them.
- **Design response:** a base size of 18px with a text-size toggle, high contrast, an explicit "Prefer to talk? Call us" block on every treatment page, and simple implant-vs-denture explainers. The 3D implant "explode" view helps comprehension and should not be decoration.

### P5 — Claire, 54, UK visitor in Candolim (dental tourist) _(added from audit evidence)_

- **JTBD:** _"Get quality work done during my 3-week holiday at a fraction of UK cost, and trust it."_
- **Needs:** qualifications in terms they recognise, materials and brands used, how many visits fit a holiday, a guarantee or aftercare when back home, communication over WhatsApp and email before arrival, sending X-rays ahead, prices in ₹ (with a GBP hint).
- **Design response:** an International Patients page, "Plan your treatment before you fly" (upload X-rays → consult on WhatsApp), timelines expressed in visits and days, testimonials filtered by country.

### P6 — Front desk & doctor (internal users of the admin)

- **Front desk:** on a tablet, answering the phone and WhatsApp while patients wait. They need the day view, quick patient lookup by phone, a one-tap reschedule, and to see who is overdue.
- **Doctor:** on a phone between patients. They need to see "what we did last time", the next sitting of the plan, X-rays, and to dictate or add a note fast.

## 3. Key journeys

### J1 — Emergency → help in one tap (P1)

1. Lands from Google ("dentist near me open now", "toothache Mapusa").
2. Sees **Open now · closes 8:00 pm** and **Call / WhatsApp / Book today** above the fold.
3. Taps WhatsApp, which opens with the pre-filled text _"Hi, I have tooth pain and would like the earliest appointment."_
4. Fallback: taps Book and sees **today's** slots first.

**Success:** contact made in ≤ 1 tap, or booked in ≤ 60 seconds.

### J2 — Browse a treatment → understand → book (P3, P4)

1. Lands on `/treatments/dental-implants` from search.
2. Above the fold: what it is (1 sentence), who it's for, sittings and duration, "from ₹…" (if provided), and the CTA.
3. Scrolls through the procedure timeline, 3D explode view, FAQs, the doctor who performs it, and a related guide.
4. A sticky CTA opens booking **with the treatment pre-selected** (skipping step 1).

**Success:** no dead end on any page, and the CTA is always within one thumb reach.

### J3 — Book an appointment (all)

Step 1 _What for?_ (treatment, or "Not sure / check-up") → Step 2 _Doctor_ (optional, defaults to "Any") → Step 3 _Date & slot_ (real availability, next 14 days, earliest highlighted) → Step 4 _Your details_ (name, mobile, who it's for; WhatsApp consent checkbox) → Step 5 _Confirm via OTP_ → confirmation screen with add-to-calendar and directions, plus a WhatsApp confirmation.

The first screen needs ≤ 3 inputs. No account is required, because OTP verification is the account.

### J4 — Returning patient (P2, P5)

1. Portal → phone OTP login.
2. Home card shows the **next appointment** (reschedule/cancel), then the **treatment plan progress** ("RCT sitting 2 of 3"), then **reports** (expiring links) and **recall due** ("6-month check-up due in March").
3. Can book for a linked family member.

### J5 — Front desk morning (P6)

Open the admin on a tablet and check today's board by chair or doctor. Confirm pending bookings, then see overdue recalls and send the reminder template in bulk. Search the walk-in by phone, create a visit, and check them in.

## 4. Competitor teardown

> **Method note:** the best-in-class list comes from long-standing, well-known patterns. The local list comes from directory listings found on 2026-11-03 (WhatClinic, IndiaMART). Most local clinics have thin or no websites, and **I did not audit each local site live**. A detailed teardown with screenshots is scheduled for the start of Phase 2.

### Best-in-class (global and national)

| Site                               | What converts / builds trust                                                                    | Steal                                                      | Avoid                                                |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------- |
| **Tend** (US)                      | Hospitality-first tone, real-time online booking front and centre, transparent "what to expect" | Calm copy, availability shown up front                     | US insurance complexity                              |
| **Bupa Dental Care** (UK)          | Practice finder, price lists, very clear treatment pages                                        | Treatment page structure (what / who / steps / cost / FAQ) | Corporate blandness                                  |
| **Clove Dental** (India)           | National trust signals, EMI messaging, strong local landing pages                               | EMI and cost reassurance, local intent pages               | Aggressive pop-ups                                   |
| **Apollo White Dental** (India)    | Doctor credentials and hospital brand trust                                                     | Doctor cards with qualifications                           | Heavy, slow pages                                    |
| **Zocdoc / Practo** (marketplaces) | Next-available-slot UX, reviews next to the CTA                                                 | Slot-picker pattern, social proof beside the CTA           | Patients leaking to competitors from Practo listings |

### Local (Mapusa, Porvorim, Candolim, Calangute)

Dr. Patil's / Dentistry Plus (Porvorim, Candolim), Impla Cosmo (Porvorim), Charmin' Smile (Candolim/Calangute, strong review volume, targets overseas patients), Goa Dental Clinic (multi-branch, Baga/Calangute/Candolim), Marigold Dental (Candolim).

**Observed pattern:** the local market competes on directory listings and Google reviews, not on websites. Directory listings show price bands (crowns roughly ₹7k–29k, implants roughly ₹40k–60k on one listing). **Opportunity:** a fast, credible, bookable site with real doctor credentials and treatment depth would stand out locally. The dental-tourism segment is contested in Candolim, so international-patient content is a differentiator only if it is concrete (timelines, materials, aftercare).

## 5. Conversion principles applied

1. **Primary CTA always visible**: a sticky header CTA on desktop, and the raised centre "Book" tab plus a contextual sticky bar on mobile.
2. **Trust above the fold**: the Google rating badge (real, linked), "Open now", named doctors with qualifications, and the clinic photo. No invented stats.
3. **Social proof next to every CTA**: a one-line review snippet under booking buttons.
4. **No dead ends**: every page ends in book, call or a related next step, including 404 pages.
5. **≤ 3 fields to start booking**, with progressive disclosure afterwards.
6. **Reduce fear**: "painless", "microscope-assisted" and "we explain options" are proven themes in the clinic's own reviews and should be used as messaging pillars.
7. **Honesty as a feature**: price ranges, sittings and recovery are stated plainly. Uncertainty is stated, not hidden.

## 6. Proposed validation (lightweight, before Phase 3 copy freeze)

- 30-minute interviews with the receptionist and Dr. Sandeep: top 10 phone questions, no-show causes, peak hours.
- 5 patient guerrilla tests on the Phase-2 clickable shell (2 locals, 1 parent, 1 elderly, 1 international if available). Task: "Book a check-up for next Tuesday evening."
- Analytics baseline: we have no GA access today. Request access to measure the old site for 2 weeks before launch.
