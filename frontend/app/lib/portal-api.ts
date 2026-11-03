/**
 * Browser client for the patient portal. Like the staff client, the access token stays in
 * memory and the httpOnly refresh cookie restores the session after a reload.
 */
let accessToken: string | null = null;

export class PortalError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
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
    throw new PortalError(
      response.status,
      typeof body.code === 'string' ? body.code : 'error',
      typeof body.title === 'string' ? body.title : 'Something went wrong. Please try again.',
    );
  }
  return body as T;
}

const post = <T>(path: string, body?: unknown, headers: HeadersInit = {}) =>
  fetch(path, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  }).then((response) => parse<T>(response));

let refreshing: Promise<boolean> | null = null;

export function restoreSession(): Promise<boolean> {
  refreshing ??= post<{ accessToken: string }>('/api/v1/auth/patient/refresh', undefined, {
    'X-CSRF-Token': csrfToken(),
  })
    .then((tokens) => {
      accessToken = tokens.accessToken;
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
  if (!accessToken && !(await restoreSession())) {
    throw new PortalError(401, 'no_session', 'Please sign in.');
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
  if (response.status === 401 && retry && (await restoreSession())) {
    return authed<T>(path, init, false);
  }
  return parse<T>(response);
}

export interface PortalAppointment {
  id: string;
  reference: string;
  status: 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'no_show' | 'cancelled';
  startAt: string;
  endAt: string;
  reason: string;
  patientName: string;
  location: { id: string; name: string; address: string; phone: string } | null;
  canCancel: boolean;
}

export const portalApi = {
  requestLink: (email: string) =>
    post<{ status: string; expiresInMinutes: number }>('/api/v1/auth/patient/email-link', {
      email,
    }),
  async verify(token: string) {
    const tokens = await post<{ accessToken: string }>('/api/v1/auth/patient/email-link/verify', {
      token,
    });
    accessToken = tokens.accessToken;
  },
  async logout() {
    await post('/api/v1/auth/patient/logout', undefined, { 'X-CSRF-Token': csrfToken() }).catch(
      () => undefined,
    );
    accessToken = null;
  },
  me: () =>
    authed<{ signedInAs: string; profiles: Array<{ id: string; code: string; name: string }> }>(
      '/api/v1/me',
    ),
  appointments: () =>
    authed<{ upcoming: PortalAppointment[]; past: PortalAppointment[] }>('/api/v1/me/appointments'),
  reschedule: (id: string, slotStart: string) =>
    authed<{ id: string; status: string; startAt: string }>(
      `/api/v1/me/appointments/${id}/reschedule`,
      { method: 'POST', body: JSON.stringify({ slotStart }) },
    ),
  cancel: (id: string) =>
    authed<{ id: string; status: string }>(`/api/v1/me/appointments/${id}/cancel`, {
      method: 'POST',
    }),
};
