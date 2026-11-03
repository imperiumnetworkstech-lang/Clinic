import { MAX_FILE_BYTES } from '@edc/shared';
import express, { Router } from 'express';
import { badRequest, notFound } from '../lib/errors.js';
import { readGrant, type LocalStorage } from '../services/storage.js';

/**
 * Upload and download endpoints for the development file store. No session: the signed,
 * expiring token in the URL is the permission, exactly like a cloud bucket's presigned URL.
 */
export function storageRouter(store: LocalStorage) {
  const router = Router();

  router.put(
    '/upload/:token',
    express.raw({ type: () => true, limit: MAX_FILE_BYTES }),
    async (req, res) => {
      const grant = readGrant(String(req.params.token), 'put');
      const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
      if (req.get('content-type') !== grant.ct) {
        throw badRequest('content_type_mismatch', 'The file type does not match the upload.');
      }
      if (body.length === 0 || body.length > (grant.max ?? MAX_FILE_BYTES)) {
        throw badRequest('size_mismatch', 'The file is empty or larger than declared.');
      }
      await store.write(grant.k, body);
      res.status(204).end();
    },
  );

  router.get('/object/:token', async (req, res) => {
    const grant = readGrant(String(req.params.token), 'get');
    if ((await store.size(grant.k)) === null) throw notFound('file_not_found', 'File not found.');
    res.set({
      'Content-Type': grant.ct ?? 'application/octet-stream',
      'Content-Disposition': grant.dl ? `attachment; filename="${grant.dl}"` : 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy':
        "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
    });
    store.read(grant.k).pipe(res);
  });

  return router;
}
