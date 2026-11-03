import type { MfaSetupResponse, StaffLoginResponse, StaffProfile } from '@edc/shared';

/**
 * Browser client for the staff API. The access token lives only in memory (never in
 * localStorage); the httpOnly refresh cookie restores the session after a reload.
 */
let accessToken: string | null = null;

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: Array<{ path: string; message: string }> = [],
    readonly details?: { id?: string },
  ) {
    super(message);
  }
}

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|;\s*)(?:__Secure-)?edc_csrf=([^;]+)/);
  return match?.[1] ? decodeURIComponent(match[1]) : '';
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof body.code === 'string' ? body.code : 'error',
      typeof body.title === 'string' ? body.title : 'Something went wrong. Please try again.',
      Array.isArray(body.errors)
        ? (body.errors as ApiError['fieldErrors'])
        : Array.isArray(body.details)
          ? (body.details as ApiError['fieldErrors'])
          : [],
      typeof body.details === 'object' && body.details !== null && !Array.isArray(body.details)
        ? (body.details as ApiError['details'])
        : undefined,
    );
  }
  return body as T;
}

async function post<T>(path: string, body?: unknown, extraHeaders: HeadersInit = {}): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return parse<T>(response);
}

interface TokenResponse {
  accessToken: string;
  expiresIn: number;
  csrfToken: string;
}

function remember(tokens: TokenResponse) {
  accessToken = tokens.accessToken;
}

let refreshing: Promise<boolean> | null = null;

/** Restores or renews the session from the refresh cookie. Concurrent callers share one call. */
export function refreshSession(): Promise<boolean> {
  refreshing ??= post<TokenResponse>('/api/v1/auth/staff/refresh', undefined, {
    'X-CSRF-Token': csrfToken(),
  })
    .then((tokens) => {
      remember(tokens);
      return true;
    })
    .catch(() => {
      accessToken = null;
      return false;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

async function authed<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  if (!accessToken && !(await refreshSession())) {
    throw new ApiError(401, 'no_session', 'Please sign in.');
  }
  const response = await fetch(path, {
    ...init,
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
  if (response.status === 401 && retry && (await refreshSession())) {
    return authed<T>(path, init, false);
  }
  return parse<T>(response);
}

export const staffAuth = {
  async login(email: string, password: string): Promise<StaffLoginResponse> {
    const result = await post<StaffLoginResponse>('/api/v1/auth/staff/login', { email, password });
    if (result.status === 'ok') remember(result);
    return result;
  },
  startSetup(mfaToken: string) {
    return post<MfaSetupResponse>('/api/v1/auth/staff/2fa/setup', { mfaToken });
  },
  async enable(mfaToken: string, code: string) {
    remember(await post<TokenResponse>('/api/v1/auth/staff/2fa/enable', { mfaToken, code }));
  },
  async verify(mfaToken: string, code: string) {
    remember(await post<TokenResponse>('/api/v1/auth/staff/2fa/verify', { mfaToken, code }));
  },
  async logout() {
    await post('/api/v1/auth/staff/logout', undefined, { 'X-CSRF-Token': csrfToken() }).catch(
      () => undefined,
    );
    accessToken = null;
  },
};

export type LeadStatus = 'new' | 'contacted' | 'booked' | 'lost';

export interface LeadRow {
  id: string;
  reference: string;
  status: LeadStatus;
  name: string;
  phone: string;
  createdAt: string;
  details: {
    reason?: string;
    preferredDate?: string;
    timeOfDay?: string;
    patientFor?: string;
    notes?: string;
  };
  location: { slug: string; name: string } | null;
}

export const adminApi = {
  me: () => authed<StaffProfile>('/api/v1/admin/me'),
  leads: (status?: LeadStatus) =>
    authed<{ total: number; items: LeadRow[] }>(
      `/api/v1/admin/leads?pageSize=100${status ? `&status=${status}` : ''}`,
    ),
  setLeadStatus: (id: string, status: LeadStatus) =>
    authed<{ id: string; status: LeadStatus }>(`/api/v1/admin/leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};

export type AppointmentStatus =
  'pending' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';

export interface AppointmentRow {
  id: string;
  reference: string;
  status: AppointmentStatus;
  startAt: string;
  endAt: string;
  reason: string;
  notes: string;
  source: string;
  patient: { id: string; code: string; name: string; phone: string; email: string | null } | null;
  location: { slug: string; name: string } | null;
}

type Interval = { open: string; close: string };
export type Weekly = Record<
  'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday',
  Interval[]
>;

export interface ScheduleSettings {
  active: boolean;
  slotMinutes: number;
  capacity: number;
  minNoticeMinutes: number;
  maxDaysAhead: number;
  weekly: Weekly;
}

export interface BranchSchedule {
  id: string;
  name: string;
  schedule: (ScheduleSettings & { id: string }) | null;
  holidays: Array<{ id: string; date: string; reason: string }>;
}

export const schedulingApi = {
  appointments: (date: string, branch?: string) =>
    authed<{ date: string; items: AppointmentRow[] }>(
      `/api/v1/admin/appointments?date=${date}${branch ? `&branch=${branch}` : ''}`,
    ),
  setStatus: (id: string, status: AppointmentStatus) =>
    authed<{ id: string; status: AppointmentStatus }>(`/api/v1/admin/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  schedules: () => authed<BranchSchedule[]>('/api/v1/admin/schedules'),
  saveSchedule: (branch: string, settings: ScheduleSettings) =>
    authed<ScheduleSettings>(`/api/v1/admin/schedules/${branch}`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    }),
  addHoliday: (branch: string, date: string, reason: string) =>
    authed<{ id: string }>(`/api/v1/admin/schedules/${branch}/holidays`, {
      method: 'POST',
      body: JSON.stringify({ date, reason }),
    }),
  removeHoliday: (id: string) =>
    authed<undefined>(`/api/v1/admin/holidays/${id}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ Phase 5a: CRM */

export interface Dashboard {
  today: {
    total: number;
    pending: number;
    confirmed: number;
    checkedIn: number;
    completed: number;
    noShow: number;
  };
  toConfirm: number;
  newEnquiries: number;
  recallsDue: number;
  newPatients30d: number;
  noShowRate90d: number | null;
  bookings30d: Array<{ day: string; online: number; staff: number }>;
}

export interface PatientRow {
  id: string;
  code: string;
  name: string;
  phone: string;
  email: string | null;
  nextRecallOn: string | null;
  recallNote: string;
  lastVisitAt: string | null;
  nextVisitAt: string | null;
  homeLocation: { slug: string; name: string } | null;
}

export interface MedicalHistory {
  allergies: string;
  conditions: string;
  medications: string;
  notes: string;
}

export type PlanStatus = 'proposed' | 'accepted' | 'in_progress' | 'completed' | 'declined';
export type PlanItemStatus = 'planned' | 'done' | 'cancelled';

export interface TreatmentPlan {
  id: string;
  title: string;
  status: PlanStatus;
  notes: string;
  createdAt: string;
  items: Array<{
    id: string;
    treatment: string;
    tooth: string;
    sessions: number;
    status: PlanItemStatus;
    completedAt: string | null;
  }>;
}

export interface PatientRecord {
  patient: {
    id: string;
    code: string;
    name: string;
    phone: string;
    email: string | null;
    dateOfBirth: string | null;
    gender: string | null;
    source: string | null;
    tags: string[];
    homeBranch: { slug: string; name: string } | null;
    nextRecallOn: string | null;
    recallNote: string;
    createdAt: string;
  };
  consents: Array<{ type: string; granted: boolean; at: string }>;
  appointments: Array<{
    id: string;
    reference: string;
    status: AppointmentStatus;
    startAt: string;
    endAt: string;
    reason: string;
    location: { slug: string; name: string } | null;
    dentist: { id: string; name: string } | null;
  }>;
  clinical: {
    medicalHistory: MedicalHistory;
    notes: Array<{ id: string; body: string; author: string; createdAt: string }>;
    plans: TreatmentPlan[];
  } | null;
  timeline: Array<{ at: string; kind: string; title: string; detail?: string }>;
}

export interface CalendarItem extends AppointmentRow {
  dentist: { id: string; name: string } | null;
}

export interface StaffRow {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  status: 'active' | 'invited' | 'disabled';
  role: string;
  twoFactorEnabled: boolean;
  lastLoginAt: string | null;
}

const json = (method: string, body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});

export const crmApi = {
  dashboard: () => authed<Dashboard>('/api/v1/admin/dashboard'),
  patients: (params: { q?: string; recall?: 'due'; page?: number }) => {
    const search = new URLSearchParams({ pageSize: '25', page: String(params.page ?? 1) });
    if (params.q) search.set('q', params.q);
    if (params.recall) search.set('recall', params.recall);
    return authed<{ total: number; items: PatientRow[] }>(`/api/v1/admin/patients?${search}`);
  },
  createPatient: (body: Record<string, unknown>) =>
    authed<{ id: string; code: string }>('/api/v1/admin/patients', json('POST', body)),
  patient: (id: string) => authed<PatientRecord>(`/api/v1/admin/patients/${id}`),
  updatePatient: (id: string, body: Record<string, unknown>) =>
    authed<{ id: string }>(`/api/v1/admin/patients/${id}`, json('PATCH', body)),
  saveHistory: (id: string, history: MedicalHistory) =>
    authed<MedicalHistory>(`/api/v1/admin/patients/${id}/medical-history`, json('PUT', history)),
  addNote: (id: string, body: string) =>
    authed<{ id: string }>(`/api/v1/admin/patients/${id}/notes`, json('POST', { body })),
  addPlan: (
    id: string,
    plan: {
      title: string;
      notes: string;
      items: Array<{ treatment: string; tooth: string; sessions: number }>;
    },
  ) => authed<{ id: string }>(`/api/v1/admin/patients/${id}/plans`, json('POST', plan)),
  updatePlan: (id: string, body: { status?: PlanStatus; title?: string; notes?: string }) =>
    authed<{ id: string; status: PlanStatus }>(`/api/v1/admin/plans/${id}`, json('PATCH', body)),
  setItemStatus: (id: string, status: PlanItemStatus) =>
    authed<{ id: string; status: PlanItemStatus; planStatus: PlanStatus }>(
      `/api/v1/admin/plan-items/${id}`,
      json('PATCH', { status }),
    ),
  dentists: () => authed<Array<{ id: string; name: string }>>('/api/v1/admin/dentists'),
  calendar: (from: string, days: number, branch?: string) =>
    authed<{ from: string; days: number; items: CalendarItem[] }>(
      `/api/v1/admin/calendar?from=${from}&days=${days}${branch ? `&branch=${branch}` : ''}`,
    ),
  book: (body: {
    patientId: string;
    branch: string;
    startAt: string;
    durationMinutes: number;
    reason: string;
    notes?: string;
    dentistId: string | null;
    source: 'phone' | 'walk_in' | 'whatsapp' | 'admin';
    force?: boolean;
  }) => authed<{ id: string; reference: string }>('/api/v1/admin/appointments', json('POST', body)),
  move: (
    id: string,
    body: { startAt: string; durationMinutes?: number; dentistId?: string | null; force?: boolean },
  ) =>
    authed<{ id: string; startAt: string; endAt: string }>(
      `/api/v1/admin/appointments/${id}/time`,
      json('PATCH', body),
    ),
  staff: () => authed<StaffRow[]>('/api/v1/admin/staff'),
  createStaff: (body: {
    name: string;
    email: string;
    role: string;
    password: string;
    phone?: string;
  }) => authed<{ id: string }>('/api/v1/admin/staff', json('POST', body)),
  updateStaff: (
    id: string,
    body: { role?: string; status?: 'active' | 'disabled'; name?: string },
  ) => authed<{ id: string }>(`/api/v1/admin/staff/${id}`, json('PATCH', body)),
};

/* ------------------------------------------------------------------ Phase 5b: billing, files */

export type PaymentMethod = 'cash' | 'upi' | 'card' | 'bank_transfer' | 'other';

export interface PaymentRow {
  id: string;
  receiptNumber: string;
  amountPaise: number;
  method: PaymentMethod;
  reference: string;
  receivedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  receiver?: { id: string; name: string } | null;
}

export interface InvoiceRow {
  id: string;
  number: string;
  issuedOn: string;
  status: 'issued' | 'void';
  subtotalPaise: number;
  discountPaise: number;
  totalPaise: number;
  paidPaise: number;
  notes: string;
  voidReason: string | null;
  patient?: { id: string; code: string; name: string; phone: string } | null;
  location?: { slug: string; name: string } | null;
  items?: Array<{
    id: string;
    description: string;
    tooth: string;
    quantity: number;
    unitPaise: number;
    amountPaise: number;
  }>;
  payments?: PaymentRow[];
}

export interface PatientFileRow {
  id: string;
  kind: 'xray' | 'photo' | 'report' | 'document' | 'other';
  name: string;
  contentType: string;
  sizeBytes: number;
  uploadedBy: string;
  createdAt: string;
}

/** Fetches a protected PDF with the session and opens it in a new tab. */
async function openPdf(path: string) {
  const tab = window.open('', '_blank');
  const respond = async (retry: boolean): Promise<void> => {
    if (!accessToken && !(await refreshSession()))
      throw new ApiError(401, 'no_session', 'Please sign in.');
    const response = await fetch(path, {
      credentials: 'same-origin',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (response.status === 401 && retry && (await refreshSession())) return respond(false);
    if (!response.ok) await parse(response);
    const url = URL.createObjectURL(await response.blob());
    if (tab) tab.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  try {
    await respond(true);
  } catch (error) {
    tab?.close();
    throw error;
  }
}

export const billingApi = {
  invoices: (params: { patientId?: string; due?: boolean; page?: number }) => {
    const search = new URLSearchParams({ pageSize: '50', page: String(params.page ?? 1) });
    if (params.patientId) search.set('patientId', params.patientId);
    if (params.due) search.set('due', 'true');
    return authed<{ total: number; outstanding?: number; items: InvoiceRow[] }>(
      `/api/v1/admin/invoices?${search}`,
    );
  },
  invoice: (id: string) => authed<InvoiceRow>(`/api/v1/admin/invoices/${id}`),
  create: (body: {
    patientId: string;
    branch: string;
    appointmentId?: string;
    items: Array<{ description: string; tooth: string; quantity: number; unitPaise: number }>;
    discountPaise: number;
    notes: string;
  }) => authed<{ id: string; number: string }>('/api/v1/admin/invoices', json('POST', body)),
  pay: (id: string, body: { amountPaise: number; method: PaymentMethod; reference: string }) =>
    authed<{ id: string; receiptNumber: string }>(
      `/api/v1/admin/invoices/${id}/payments`,
      json('POST', body),
    ),
  voidInvoice: (id: string, reason: string) =>
    authed<{ id: string }>(`/api/v1/admin/invoices/${id}/void`, json('POST', { reason })),
  voidPayment: (id: string, reason: string) =>
    authed<{ id: string }>(`/api/v1/admin/payments/${id}/void`, json('POST', { reason })),
  summary: (date: string) =>
    authed<{
      date: string;
      count: number;
      totalPaise: number;
      byMethod: Partial<Record<PaymentMethod, number>>;
    }>(`/api/v1/admin/billing/summary?date=${date}`),
  openInvoicePdf: (id: string) => openPdf(`/api/v1/admin/invoices/${id}/pdf`),
  openReceipt: (paymentId: string) => openPdf(`/api/v1/admin/payments/${paymentId}/receipt`),
};

export const filesApi = {
  list: (patientId: string) =>
    authed<{ available: boolean; items: PatientFileRow[] }>(
      `/api/v1/admin/patients/${patientId}/files`,
    ),
  async upload(patientId: string, kind: PatientFileRow['kind'], file: File) {
    const started = await authed<{ id: string; upload: { url: string; method: 'PUT' } }>(
      `/api/v1/admin/patients/${patientId}/files`,
      json('POST', { kind, fileName: file.name, contentType: file.type, sizeBytes: file.size }),
    );
    const put = await fetch(started.upload.url, {
      method: 'PUT',
      headers: { 'Content-Type': file.type },
      body: file,
    });
    if (!put.ok) await parse(put);
    return authed<{ id: string }>(`/api/v1/admin/files/${started.id}/complete`, { method: 'POST' });
  },
  viewUrl: (id: string) =>
    authed<{ url: string; expiresAt: string }>(`/api/v1/admin/files/${id}/url`),
  share: (id: string, hours: number) =>
    authed<{ url: string; expiresAt: string }>(
      `/api/v1/admin/files/${id}/share`,
      json('POST', { hours }),
    ),
  remove: (id: string) => authed<undefined>(`/api/v1/admin/files/${id}`, { method: 'DELETE' }),
};

/* ------------------------------------------------------------------ Phase 5c: content */

export type ContentKind = 'blog_post' | 'faq' | 'treatment';
export type DraftState = 'editing' | 'in_review' | 'changes_requested' | 'approved';

export interface ContentSummary {
  id: string;
  type: ContentKind;
  slug: string;
  title: string;
  sortOrder: number;
  live: boolean;
  archived: boolean;
  publishedAt: string | null;
  publishedReviewed: boolean;
  draftStatus: DraftState | null;
  draftUpdatedAt: string | null;
  reviewNote: string;
}

export interface ContentDetail extends ContentSummary {
  publishedData: Record<string, unknown> | null;
  draftData: Record<string, unknown> | null;
  history: Array<{ id: string; action: string; note: string; by: string; at: string }>;
}

const contentAction = (id: string, action: string, body?: unknown) =>
  authed<ContentSummary>(
    `/api/v1/admin/content/${id}/${action}`,
    body === undefined ? { method: 'POST' } : json('POST', body),
  );

export const contentApi = {
  list: (type?: ContentKind) =>
    authed<ContentSummary[]>(`/api/v1/admin/content${type ? `?type=${type}` : ''}`),
  get: (id: string) => authed<ContentDetail>(`/api/v1/admin/content/${id}`),
  create: (type: 'blog_post' | 'faq', slug: string, data: Record<string, unknown>) =>
    authed<{ id: string }>('/api/v1/admin/content', json('POST', { type, slug, data })),
  saveDraft: (id: string, data: Record<string, unknown>) =>
    authed<ContentSummary>(`/api/v1/admin/content/${id}/draft`, json('PUT', { data })),
  discard: (id: string) =>
    authed<ContentSummary>(`/api/v1/admin/content/${id}/draft`, { method: 'DELETE' }),
  submit: (id: string) => contentAction(id, 'submit'),
  review: (id: string, decision: 'approve' | 'changes', note: string) =>
    contentAction(id, 'review', { decision, note }),
  approveLive: (id: string) => contentAction(id, 'approve-live'),
  publish: (id: string) => contentAction(id, 'publish'),
  unpublish: (id: string) => contentAction(id, 'unpublish'),
  restore: (id: string) => contentAction(id, 'restore'),
};
