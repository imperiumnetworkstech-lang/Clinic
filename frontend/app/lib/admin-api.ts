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
      Array.isArray(body.errors) ? (body.errors as ApiError['fieldErrors']) : [],
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
