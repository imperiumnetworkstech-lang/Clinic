import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { isProduction } from '../config/env.js';
import { HttpError, notFound } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction) {
  next(notFound('route_not_found', 'This endpoint does not exist'));
}

/** Renders every error as RFC 9457 problem+json; internals are never exposed in production. */
export function errorHandler(error: unknown, req: Request, res: Response, _next: NextFunction) {
  if (error instanceof ZodError) {
    res
      .status(400)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: 'Please check the highlighted fields',
        status: 400,
        code: 'validation_failed',
        errors: error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
    return;
  }

  if (error instanceof HttpError) {
    if (error.status === 429) {
      const retry = (error.details as { retryAfterSeconds?: number } | undefined)
        ?.retryAfterSeconds;
      if (retry) res.setHeader('Retry-After', String(retry));
    }
    res
      .status(error.status)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: error.message,
        status: error.status,
        code: error.code,
        ...(error.details && error.status !== 429 ? { details: error.details } : {}),
      });
    return;
  }

  const bodyTooLarge =
    typeof error === 'object' && error !== null && 'type' in error
      ? (error as { type: unknown }).type === 'entity.too.large'
      : false;
  const malformedJson = error instanceof SyntaxError && 'body' in error;
  if (bodyTooLarge || malformedJson) {
    res
      .status(bodyTooLarge ? 413 : 400)
      .type('application/problem+json')
      .json({
        type: 'about:blank',
        title: bodyTooLarge ? 'Request is too large' : 'Malformed JSON',
        status: bodyTooLarge ? 413 : 400,
        code: bodyTooLarge ? 'payload_too_large' : 'malformed_json',
      });
    return;
  }

  logger.error({ err: error, method: req.method, url: req.originalUrl }, 'unhandled error');
  res
    .status(500)
    .type('application/problem+json')
    .json({
      type: 'about:blank',
      title: 'Something went wrong on our side',
      status: 500,
      code: 'internal_error',
      ...(isProduction ? {} : { detail: error instanceof Error ? error.message : String(error) }),
    });
}
