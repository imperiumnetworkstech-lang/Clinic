/**
 * An error that maps directly to an RFC 9457 problem+json response.
 * `code` is a stable machine-readable identifier the frontend can switch on.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (code: string, message: string, details?: unknown) =>
  new HttpError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message = 'Authentication required') =>
  new HttpError(401, code, message);
export const forbidden = (code = 'forbidden', message = 'You do not have access to this') =>
  new HttpError(403, code, message);
export const notFound = (code = 'not_found', message = 'Not found') =>
  new HttpError(404, code, message);
export const tooManyRequests = (retryAfterSeconds: number) =>
  new HttpError(429, 'rate_limited', 'Too many attempts. Please try again later.', {
    retryAfterSeconds,
  });
export const serviceUnavailable = (code: string, message: string) =>
  new HttpError(503, code, message);
