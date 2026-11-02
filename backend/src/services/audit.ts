import type { Request } from 'express';
import { hmac } from '../lib/crypto.js';
import { logger } from '../lib/logger.js';
import { AuditLog, type ActorType } from '../models/index.js';

export interface AuditEntry {
  action: string;
  actorType?: ActorType;
  actorId?: string | null;
  entity?: string;
  entityId?: string;
  /** Never put PHI here (names, phones, clinical text); ids and flags only. */
  meta?: Record<string, unknown>;
}

/**
 * Writes an append-only audit row. Actor defaults to the authenticated principal on the
 * request. Failures are logged but never break the user's action.
 */
export async function audit(req: Request | null, entry: AuditEntry): Promise<void> {
  const principal = req?.auth;
  // Patients are identified by phone, which is PHI; the audit trail stores its HMAC instead.
  const principalId = principal?.type === 'patient' ? hmac(principal.id) : principal?.id;
  try {
    await AuditLog.create({
      action: entry.action,
      actorType: entry.actorType ?? principal?.type ?? 'anonymous',
      actorId: entry.actorId ?? principalId ?? null,
      entity: entry.entity ?? null,
      entityId: entry.entityId ?? null,
      meta: entry.meta ?? {},
      ip: req?.ip ?? null,
      userAgent: req?.get('user-agent')?.slice(0, 400) ?? null,
    });
  } catch (error) {
    logger.error({ err: error, action: entry.action }, 'audit write failed');
  }
}
