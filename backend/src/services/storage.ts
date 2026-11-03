import { createReadStream } from 'node:fs';
import { mkdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Readable } from 'node:stream';
import { env } from '../config/env.js';
import { hmac, safeEqual } from '../lib/crypto.js';
import { serviceUnavailable, unauthorized } from '../lib/errors.js';

/**
 * Where patient files live. Callers only ever hand out short-lived signed URLs; objects are
 * never public. Provider-agnostic so an S3-compatible bucket can replace the local store
 * without touching the routes.
 */
export interface ObjectStorage {
  readonly available: boolean;
  uploadUrl(key: string, contentType: string, maxBytes: number): Promise<string>;
  downloadUrl(
    key: string,
    options: { seconds: number; download?: string; contentType?: string },
  ): Promise<string>;
  size(key: string): Promise<number | null>;
  remove(key: string): Promise<void>;
}

interface Grant {
  /** Object key. */
  k: string;
  op: 'put' | 'get';
  /** Expiry, seconds since epoch. */
  exp: number;
  ct?: string;
  max?: number;
  /** Suggested download file name (generic, never the patient's original name). */
  dl?: string;
}

const sign = (payload: string) => hmac(`storage:${payload}`);

export function signGrant(grant: Grant): string {
  const payload = Buffer.from(JSON.stringify(grant)).toString('base64url');
  return `${payload}.${sign(payload)}`;
}

/** Verifies a token from a signed URL; refuses tampered, expired or wrong-purpose tokens. */
export function readGrant(token: string, op: Grant['op']): Grant {
  const [payload = '', signature = ''] = token.split('.');
  if (!payload || !signature || !safeEqual(signature, sign(payload))) {
    throw unauthorized('link_invalid', 'This link is not valid.');
  }
  const grant = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Grant;
  if (grant.op !== op || grant.exp * 1000 < Date.now()) {
    throw unauthorized('link_expired', 'This link has expired.');
  }
  return grant;
}

const expiry = (seconds: number) => Math.floor(Date.now() / 1000) + seconds;

/** Development store on the local disk, served through the API's /storage routes. */
export class LocalStorage implements ObjectStorage {
  readonly available = true;
  private readonly root = path.resolve(env.FILE_STORAGE_DIR);

  private pathFor(key: string) {
    const resolved = path.resolve(this.root, key);
    if (!resolved.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return resolved;
  }

  async uploadUrl(key: string, contentType: string, maxBytes: number) {
    const token = signGrant({
      k: key,
      op: 'put',
      exp: expiry(600),
      ct: contentType,
      max: maxBytes,
    });
    return `/api/v1/storage/upload/${token}`;
  }

  async downloadUrl(
    key: string,
    options: { seconds: number; download?: string; contentType?: string },
  ) {
    const token = signGrant({
      k: key,
      op: 'get',
      ...(options.contentType ? { ct: options.contentType } : {}),
      exp: expiry(options.seconds),
      ...(options.download ? { dl: options.download } : {}),
    });
    return `/api/v1/storage/object/${token}`;
  }

  async size(key: string) {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch {
      return null;
    }
  }

  async remove(key: string) {
    await rm(this.pathFor(key), { force: true });
  }

  async write(key: string, body: Buffer) {
    const target = this.pathFor(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  read(key: string): Readable {
    return createReadStream(this.pathFor(key));
  }
}

class UnavailableStorage implements ObjectStorage {
  readonly available = false;
  private fail(): never {
    throw serviceUnavailable('files_unavailable', 'File storage is not set up yet.');
  }
  async uploadUrl(): Promise<string> {
    return this.fail();
  }
  async downloadUrl(): Promise<string> {
    return this.fail();
  }
  async size(): Promise<number | null> {
    return this.fail();
  }
  async remove(): Promise<void> {
    return this.fail();
  }
}

export const diskStore = env.FILE_STORAGE === 'local' ? new LocalStorage() : null;
export const storage: ObjectStorage = diskStore ?? new UnavailableStorage();
