import {
  appointmentRequestBody,
  PATIENT_FOR,
  PATIENT_FOR_LABELS,
  TIME_OF_DAY,
  TIME_OF_DAY_LABELS,
  type AppointmentRequestBody,
} from '@edc/shared';
import { ArrowLeft, ArrowRight, CheckCircle2, Phone, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { data, Form, Link, useNavigation } from 'react-router';
import { WhatsAppIcon } from '../components/icons';
import { PageHeader } from '../components/PageHeader';
import { Button, ButtonLink } from '../components/ui/Button';
import { apiOrigin } from '../lib/api.server';
import { branches, phones, primaryPhone, whatsappLink } from '../lib/clinic';
import { cn } from '../lib/cn';
import { weeklyHours } from '../lib/hours';
import { pageMeta } from '../lib/seo';
import { reasonLabel, treatmentCategories, VISIT_REASONS, getTreatment } from '../lib/treatments';
import { container } from '../lib/ui';
import type { Route } from './+types/book';

export function meta() {
  return pageMeta({
    title: 'Book an Appointment | Expressions Dental Clinic, Goa',
    description:
      'Request an appointment at our Duler (Mapusa) or Candolim clinic. Choose a day and time and we’ll confirm on WhatsApp or by phone.',
    path: '/book',
  });
}

const MAX_DAYS_AHEAD = 90;

function isoInIndia(offsetDays = 0): string {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date());
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export function loader({ request }: Route.LoaderArgs) {
  const treatment = new URL(request.url).searchParams.get('treatment');
  return {
    minDate: isoInIndia(0),
    maxDate: isoInIndia(MAX_DAYS_AHEAD),
    preselect: getTreatment(treatment ?? undefined) ? treatment : null,
  };
}

type FieldErrors = Partial<Record<keyof AppointmentRequestBody | 'form', string>>;

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${iso}T00:00:00Z`));
}

function whatsappMessage(request: AppointmentRequestBody, reference: string | null): string {
  const branch = branches.find((entry) => entry.id === request.branch)?.shortName ?? request.branch;
  return [
    "Hello Expressions Dental Clinic, I'd like to request an appointment.",
    reference ? `Reference: ${reference}` : null,
    `Visit for: ${reasonLabel(request.reason)}`,
    `Clinic: ${branch}`,
    `Preferred: ${formatDate(request.preferredDate)}, ${TIME_OF_DAY_LABELS[request.timeOfDay]}`,
    `Patient: ${PATIENT_FOR_LABELS[request.patientFor]}`,
    `Name: ${request.name}`,
    `Phone: ${request.phone}`,
    request.notes ? `Notes: ${request.notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const values = Object.fromEntries(
    [...form.entries()].map(([key, value]) => [key, typeof value === 'string' ? value : '']),
  );
  const parsed = appointmentRequestBody.safeParse({
    ...values,
    consent: form.get('consent') === 'on',
  });

  if (!parsed.success) {
    const errors: FieldErrors = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as keyof FieldErrors;
      errors[key] ??= issue.message;
    }
    return data({ ok: false as const, errors, values }, { status: 400 });
  }

  // Save to the clinic's enquiries inbox. If the API is unreachable the patient can still
  // send the request on WhatsApp, so a failed save never blocks them.
  let reference: string | null = null;
  const origin = apiOrigin();
  if (origin) {
    try {
      const clientIp = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
      const response = await fetch(`${origin}/api/v1/public/appointment-requests`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(clientIp ? { 'x-forwarded-for': clientIp } : {}),
        },
        body: JSON.stringify(parsed.data),
      });
      if (response.status === 400) {
        const problem = (await response.json()) as { title?: string; code?: string };
        if (problem.code === 'date_out_of_range') {
          return data(
            {
              ok: false as const,
              errors: { preferredDate: problem.title ?? 'Choose another date' } as FieldErrors,
              values,
            },
            { status: 400 },
          );
        }
      }
      if (response.ok) reference = ((await response.json()) as { reference: string }).reference;
    } catch {
      reference = null;
    }
  }

  return {
    ok: true as const,
    reference,
    whatsappUrl: whatsappLink(whatsappMessage(parsed.data, reference)),
    summary: {
      reason: reasonLabel(parsed.data.reason),
      branch: branches.find((entry) => entry.id === parsed.data.branch)?.shortName ?? '',
      when: `${formatDate(parsed.data.preferredDate)} · ${TIME_OF_DAY_LABELS[parsed.data.timeOfDay]}`,
      name: parsed.data.name,
    },
  };
}

/* ------------------------------------------------------------------ form pieces */

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="mt-2 text-sm font-medium text-[#B60411]">
      {message}
    </p>
  );
}

function ChoiceGroup({
  name,
  legend,
  options,
  defaultValue,
  error,
  columns = 'sm:grid-cols-2',
  onChange,
}: {
  name: string;
  legend: string;
  options: Array<{ value: string; label: ReactNode; hint?: string }>;
  defaultValue?: string;
  error?: string;
  columns?: string;
  onChange?: (value: string) => void;
}) {
  return (
    <fieldset aria-describedby={error ? `${name}-error` : undefined}>
      <legend className="font-semibold">{legend}</legend>
      <div className={cn('mt-3 grid gap-3', columns)}>
        {options.map((option, index) => (
          <label
            key={option.value}
            className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl bg-white px-4 py-3 ring-1 ring-neutral-200 transition hover:bg-neutral-50 has-[:checked]:bg-primary-50 has-[:checked]:ring-2 has-[:checked]:ring-primary-600 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-secondary-500"
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={option.value === defaultValue}
              required={index === 0}
              onChange={() => onChange?.(option.value)}
              className="size-5 shrink-0 accent-primary-600"
            />
            <span>
              <span className="block font-semibold">{option.label}</span>
              {option.hint && <span className="block text-sm text-muted">{option.hint}</span>}
            </span>
          </label>
        ))}
      </div>
      <FieldError id={`${name}-error`} message={error} />
    </fieldset>
  );
}

const inputClass =
  'mt-2 block min-h-12 w-full rounded-2xl bg-white px-4 text-base ring-1 ring-neutral-300 outline-none transition focus:ring-2 focus:ring-secondary-500 aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-[#B60411]';

const STEPS = ['What & where', 'When', 'Your details'];

function Stepper({ step }: { step: number }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking steps">
      {STEPS.map((label, index) => {
        const state = index < step ? 'done' : index === step ? 'current' : 'upcoming';
        return (
          <li
            key={label}
            className="flex flex-1 items-center gap-2"
            aria-current={state === 'current' ? 'step' : undefined}
          >
            <span
              className={cn(
                'grid size-8 shrink-0 place-items-center rounded-full text-sm font-bold',
                state === 'done' && 'bg-primary-600 text-white',
                state === 'current' && 'bg-primary-50 text-primary-700 ring-2 ring-primary-600',
                state === 'upcoming' && 'bg-neutral-100 text-neutral-600',
              )}
            >
              {state === 'done' ? <CheckCircle2 size={16} /> : index + 1}
            </span>
            <span
              className={cn(
                'hidden text-sm font-semibold sm:inline',
                state === 'upcoming' && 'text-muted',
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && (
              <span aria-hidden="true" className="h-px flex-1 bg-neutral-200" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

/* ------------------------------------------------------------------ page */

function Confirmation({
  reference,
  whatsappUrl,
  summary,
}: {
  reference: string | null;
  whatsappUrl: string;
  summary: { reason: string; branch: string; when: string; name: string };
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => heading.current?.focus(), []);
  return (
    <div className="mx-auto max-w-xl rounded-[2rem] bg-white p-7 text-center shadow-[0_24px_60px_-28px_rgb(31_36_43/0.4)] ring-1 ring-neutral-200 sm:p-10">
      <span className="mx-auto grid size-16 place-items-center rounded-full bg-[#E8F7EE] text-[#128C4A]">
        <CheckCircle2 size={34} />
      </span>
      <h2 ref={heading} tabIndex={-1} className="mt-5 text-2xl font-bold outline-none sm:text-3xl">
        {reference ? 'Request received' : 'Almost done'}
      </h2>
      <p className="mt-3 text-muted">
        {reference ? (
          <>
            Your reference is <strong className="text-neutral-950">{reference}</strong>. Send it on
            WhatsApp so our front desk can confirm your time faster.
          </>
        ) : (
          'Tap below to send your request to our front desk on WhatsApp. They will confirm your time.'
        )}
      </p>

      <dl className="mt-6 grid gap-2 rounded-2xl bg-surface p-5 text-left text-[0.95rem]">
        {[
          ['Visit for', summary.reason],
          ['Clinic', summary.branch],
          ['Preferred', summary.when],
          ['Name', summary.name],
        ].map(([term, value]) => (
          <div key={term} className="flex justify-between gap-4">
            <dt className="text-muted">{term}</dt>
            <dd className="text-right font-semibold">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 grid gap-3">
        <ButtonLink href={whatsappUrl} external variant="whatsapp" size="lg">
          <WhatsAppIcon size={22} />
          Send on WhatsApp
        </ButtonLink>
        <ButtonLink href={primaryPhone.href} variant="secondary" size="lg">
          <Phone size={18} className="text-primary-600" />
          Or call {primaryPhone.display}
        </ButtonLink>
      </div>
      <p className="mt-6 text-sm text-muted">
        We reply during clinic hours (Mon–Sat, 10 am – 8 pm). For severe pain or swelling, please
        call us.
      </p>
      <Link
        to="/"
        className="mt-4 inline-flex min-h-11 items-center font-semibold text-link hover:underline"
      >
        Back to the home page
      </Link>
    </div>
  );
}

export default function Book({ loaderData, actionData }: Route.ComponentProps) {
  const navigation = useNavigation();
  const submitting = navigation.state === 'submitting';
  const errors: FieldErrors = actionData && !actionData.ok ? actionData.errors : {};
  const values: Record<string, string> = actionData && !actionData.ok ? actionData.values : {};

  // Steps are a JavaScript enhancement; without JS every section shows on one page.
  const [enhanced, setEnhanced] = useState(false);
  const [step, setStep] = useState(0);
  const [branch, setBranch] = useState(values.branch ?? '');
  const [date, setDate] = useState(values.preferredDate ?? '');
  const sections = useRef<Array<HTMLFieldSetElement | null>>([]);

  useEffect(() => setEnhanced(true), []);
  useEffect(() => {
    // After a server-side validation error, jump to the first step that has one.
    if (!actionData || actionData.ok) return;
    const failed = actionData.errors as FieldErrors;
    const firstWithError = [
      ['reason', 'branch'],
      ['preferredDate', 'timeOfDay'],
      ['patientFor', 'name', 'phone', 'notes', 'consent'],
    ].findIndex((keys) => keys.some((key) => failed[key as keyof FieldErrors]));
    if (firstWithError >= 0) setStep(firstWithError);
  }, [actionData]);

  const next = () => {
    const current = sections.current[step];
    const invalid = current?.querySelector<HTMLInputElement | HTMLSelectElement>(':invalid');
    if (invalid) {
      invalid.reportValidity();
      return;
    }
    setStep((value) => Math.min(value + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sundayAtDuler =
    branch === 'mapusa' &&
    date !== '' &&
    new Date(`${date}T00:00:00Z`).getUTCDay() === 0 &&
    weeklyHours('mapusa')?.sunday.length === 0;

  const show = (index: number) => !enhanced || step === index;
  const preselect = values.reason ?? loaderData.preselect ?? '';

  return (
    <>
      <PageHeader
        crumbs={[{ name: 'Book an appointment', path: '/book' }]}
        title="Book an appointment"
        intro="Tell us what you need and when suits you. Our front desk will confirm your time on WhatsApp or by phone."
      >
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-2 text-[0.95rem]">
          <a
            href={whatsappLink(
              'Hello Expressions Dental Clinic, I would like to book an appointment.',
            )}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center gap-2 font-semibold text-[#0B5E31] hover:underline"
          >
            <WhatsAppIcon size={20} className="text-[#128C4A]" />
            Prefer to chat? WhatsApp us
          </a>
          {phones.map((phone) => (
            <a
              key={phone.href}
              href={phone.href}
              className="inline-flex min-h-11 items-center gap-2 font-semibold hover:text-primary-700"
            >
              <Phone size={18} className="text-primary-600" />
              {phone.display}
            </a>
          ))}
        </div>
      </PageHeader>

      <section className={`${container} py-10 md:py-16`}>
        {actionData?.ok ? (
          <Confirmation
            reference={actionData.reference}
            whatsappUrl={actionData.whatsappUrl}
            summary={actionData.summary}
          />
        ) : (
          <div className="mx-auto max-w-2xl">
            {enhanced && <Stepper step={step} />}
            {errors.form && (
              <p
                role="alert"
                className="mt-6 rounded-2xl bg-[#FEF4F3] p-4 font-medium text-[#92020B]"
              >
                {errors.form}
              </p>
            )}

            <Form method="post" noValidate={false} className="mt-8 space-y-10">
              <fieldset
                ref={(element) => {
                  sections.current[0] = element;
                }}
                hidden={!show(0)}
                className="space-y-8"
              >
                <legend className="sr-only">Step 1: What and where</legend>
                <div>
                  <label htmlFor="reason" className="block font-semibold">
                    What is the visit for?
                  </label>
                  <select
                    id="reason"
                    name="reason"
                    required
                    defaultValue={preselect}
                    aria-invalid={errors.reason ? true : undefined}
                    aria-describedby={errors.reason ? 'reason-error' : undefined}
                    className={inputClass}
                  >
                    <option value="" disabled>
                      Choose one…
                    </option>
                    <optgroup label="Most common">
                      {VISIT_REASONS.map((reason) => (
                        <option key={reason.value} value={reason.value}>
                          {reason.label}
                        </option>
                      ))}
                    </optgroup>
                    {treatmentCategories.map((category) => (
                      <optgroup key={category.id} label={category.title}>
                        {category.treatments.map((treatment) => (
                          <option key={treatment.slug} value={treatment.slug}>
                            {treatment.name}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                  <FieldError id="reason-error" message={errors.reason} />
                </div>

                <ChoiceGroup
                  name="branch"
                  legend="Which clinic?"
                  defaultValue={values.branch}
                  error={errors.branch}
                  onChange={setBranch}
                  options={branches.map((entry) => ({
                    value: entry.id,
                    label: entry.shortName,
                    hint: entry.id === 'mapusa' ? 'Mon–Sat, 10 am – 8 pm' : 'Call to confirm hours',
                  }))}
                />
              </fieldset>

              <fieldset
                ref={(element) => {
                  sections.current[1] = element;
                }}
                hidden={!show(1)}
                className="space-y-8"
              >
                <legend className="sr-only">Step 2: When</legend>
                <div>
                  <label htmlFor="preferredDate" className="block font-semibold">
                    Preferred date
                  </label>
                  <input
                    id="preferredDate"
                    name="preferredDate"
                    type="date"
                    required
                    min={loaderData.minDate}
                    max={loaderData.maxDate}
                    defaultValue={values.preferredDate}
                    onChange={(event) => setDate(event.target.value)}
                    aria-invalid={errors.preferredDate ? true : undefined}
                    aria-describedby={
                      [
                        errors.preferredDate && 'preferredDate-error',
                        sundayAtDuler && 'sunday-note',
                      ]
                        .filter(Boolean)
                        .join(' ') || undefined
                    }
                    className={inputClass}
                  />
                  {sundayAtDuler && (
                    <p
                      id="sunday-note"
                      className="mt-2 rounded-xl bg-[#FFF5EA] px-3 py-2 text-sm font-medium text-[#6A4100]"
                    >
                      Our Duler clinic is closed on Sundays. Please choose another day.
                    </p>
                  )}
                  <FieldError id="preferredDate-error" message={errors.preferredDate} />
                </div>
                <ChoiceGroup
                  name="timeOfDay"
                  legend="Preferred time"
                  defaultValue={values.timeOfDay}
                  error={errors.timeOfDay}
                  options={TIME_OF_DAY.map((value) => ({
                    value,
                    label: TIME_OF_DAY_LABELS[value],
                  }))}
                />
              </fieldset>

              <fieldset
                ref={(element) => {
                  sections.current[2] = element;
                }}
                hidden={!show(2)}
                className="space-y-8"
              >
                <legend className="sr-only">Step 3: Your details</legend>
                <ChoiceGroup
                  name="patientFor"
                  legend="Who is the appointment for?"
                  defaultValue={values.patientFor ?? 'me'}
                  error={errors.patientFor}
                  columns="sm:grid-cols-3"
                  options={PATIENT_FOR.map((value) => ({
                    value,
                    label: PATIENT_FOR_LABELS[value],
                  }))}
                />
                <div>
                  <label htmlFor="name" className="block font-semibold">
                    Patient’s full name
                  </label>
                  <input
                    id="name"
                    name="name"
                    autoComplete="name"
                    required
                    minLength={2}
                    defaultValue={values.name}
                    aria-invalid={errors.name ? true : undefined}
                    aria-describedby={errors.name ? 'name-error' : undefined}
                    className={inputClass}
                  />
                  <FieldError id="name-error" message={errors.name} />
                </div>
                <div>
                  <label htmlFor="phone" className="block font-semibold">
                    Mobile number (WhatsApp)
                  </label>
                  <p id="phone-hint" className="mt-1 text-sm text-muted">
                    Indian numbers without +91 are fine. Visitors from abroad: include the country
                    code.
                  </p>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    required
                    defaultValue={values.phone}
                    aria-invalid={errors.phone ? true : undefined}
                    aria-describedby={errors.phone ? 'phone-hint phone-error' : 'phone-hint'}
                    className={inputClass}
                  />
                  <FieldError id="phone-error" message={errors.phone} />
                </div>
                <div>
                  <label htmlFor="notes" className="block font-semibold">
                    Anything we should know?{' '}
                    <span className="font-normal text-muted">(optional)</span>
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    rows={3}
                    maxLength={500}
                    defaultValue={values.notes}
                    placeholder="e.g. pain on the lower left side since yesterday"
                    className={cn(inputClass, 'py-3')}
                  />
                  <FieldError id="notes-error" message={errors.notes} />
                </div>
                <div>
                  <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-surface p-4">
                    <input
                      type="checkbox"
                      name="consent"
                      required
                      defaultChecked={values.consent === 'on'}
                      aria-describedby={errors.consent ? 'consent-error' : undefined}
                      className="mt-1 size-5 shrink-0 accent-primary-600"
                    />
                    <span className="text-[0.95rem]">
                      I agree that Expressions Dental Clinic may contact me by phone or WhatsApp
                      about this request and keep these details for that purpose. See our{' '}
                      <Link
                        to="/privacy-policy"
                        target="_blank"
                        className="font-semibold text-link underline"
                      >
                        privacy policy
                      </Link>
                      .
                    </span>
                  </label>
                  <FieldError id="consent-error" message={errors.consent} />
                </div>
              </fieldset>

              <div className="flex items-center justify-between gap-3 border-t border-neutral-200 pt-6">
                {enhanced && step > 0 ? (
                  <Button variant="ghost" onClick={() => setStep((value) => value - 1)}>
                    <ArrowLeft size={18} />
                    Back
                  </Button>
                ) : (
                  <span />
                )}
                {enhanced && step < STEPS.length - 1 ? (
                  <Button onClick={next}>
                    Continue
                    <ArrowRight size={18} />
                  </Button>
                ) : (
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Sending…' : 'Request appointment'}
                  </Button>
                )}
              </div>
              <p className="flex items-center justify-center gap-2 text-sm text-muted">
                <ShieldCheck size={16} className="text-[#128C4A]" />
                Your details are only used to arrange your appointment.
              </p>
            </Form>
          </div>
        )}
      </section>
    </>
  );
}
