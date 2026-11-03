import { fileShareBody, fileUploadBody } from '@edc/shared';
import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { badRequest, notFound } from '../lib/errors.js';
import { requirePermission, requireStaff, staffPrincipal } from '../middleware/auth.js';
import { Patient, PatientFile, User } from '../models/index.js';
import { audit } from '../services/audit.js';
import { openText, sealText } from '../services/clinical.js';
import { storage } from '../services/storage.js';

/**
 * Patient files (X-rays, photos, reports). The browser uploads straight to storage with a
 * signed URL; files are only ever read through short-lived signed links, and every view and
 * share is audited. Original file names are encrypted because they can identify a patient.
 */
export const adminFilesRouter = Router();

adminFilesRouter.use(requireStaff);

const VIEW_SECONDS = 5 * 60;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'application/dicom': 'dcm',
};

async function findFile(id: unknown) {
  const file = await PatientFile.findByPk(z.uuid().parse(id));
  if (!file) throw notFound('file_not_found', 'File not found.');
  return file;
}

adminFilesRouter.get(
  '/patients/:id/files',
  requirePermission('clinical.read'),
  async (req, res) => {
    const files = await PatientFile.findAll({
      where: { patientId: z.uuid().parse(req.params.id), status: 'stored' },
      include: [{ model: User, as: 'uploader', attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC']],
    });
    res.json({
      available: storage.available,
      items: files.map((file) => ({
        id: file.id,
        kind: file.kind,
        name: openText(file.name),
        contentType: file.contentType,
        sizeBytes: file.sizeBytes,
        uploadedBy: file.uploader?.name ?? '',
        createdAt: file.createdAt,
      })),
    });
  },
);

adminFilesRouter.post(
  '/patients/:id/files',
  requirePermission('clinical.write'),
  async (req, res) => {
    const body = fileUploadBody.parse(req.body);
    const patient = await Patient.findByPk(z.uuid().parse(req.params.id));
    if (!patient) throw notFound('patient_not_found', 'Patient not found.');
    const storageKey = `files/${randomUUID()}`;
    const uploadUrl = await storage.uploadUrl(storageKey, body.contentType, body.sizeBytes);
    const file = await PatientFile.create({
      patientId: patient.id,
      kind: body.kind,
      name: sealText(body.fileName),
      contentType: body.contentType,
      sizeBytes: body.sizeBytes,
      storageKey,
      uploadedBy: staffPrincipal(req).id,
    });
    res.status(201).json({ id: file.id, upload: { url: uploadUrl, method: 'PUT' } });
  },
);

adminFilesRouter.post(
  '/files/:id/complete',
  requirePermission('clinical.write'),
  async (req, res) => {
    const file = await findFile(req.params.id);
    const size = await storage.size(file.storageKey);
    if (size === null) throw badRequest('upload_missing', 'The upload did not finish. Try again.');
    await file.update({ status: 'stored', sizeBytes: size });
    await audit(req, {
      action: 'file.uploaded',
      entity: 'patient',
      entityId: file.patientId,
      meta: { fileId: file.id, kind: file.kind },
    });
    res.json({ id: file.id, status: file.status });
  },
);

adminFilesRouter.get('/files/:id/url', requirePermission('clinical.read'), async (req, res) => {
  const file = await findFile(req.params.id);
  if (file.status !== 'stored') throw notFound('file_not_found', 'File not found.');
  const download = req.query.download === 'true';
  const url = await storage.downloadUrl(file.storageKey, {
    seconds: VIEW_SECONDS,
    contentType: file.contentType,
    ...(download
      ? { download: `${file.kind}-${file.id.slice(0, 8)}.${EXTENSIONS[file.contentType] ?? 'bin'}` }
      : {}),
  });
  await audit(req, {
    action: 'file.viewed',
    entity: 'patient',
    entityId: file.patientId,
    meta: { fileId: file.id },
  });
  res.json({ url, expiresAt: new Date(Date.now() + VIEW_SECONDS * 1000) });
});

/** A link the front desk can send the patient (e.g. on WhatsApp); it stops working later. */
adminFilesRouter.post('/files/:id/share', requirePermission('clinical.write'), async (req, res) => {
  const { hours } = fileShareBody.parse(req.body ?? {});
  const file = await findFile(req.params.id);
  if (file.status !== 'stored') throw notFound('file_not_found', 'File not found.');
  const url = await storage.downloadUrl(file.storageKey, {
    seconds: hours * 3600,
    contentType: file.contentType,
  });
  await audit(req, {
    action: 'file.shared',
    entity: 'patient',
    entityId: file.patientId,
    meta: { fileId: file.id, hours },
  });
  res.json({ url, expiresAt: new Date(Date.now() + hours * 3_600_000) });
});

adminFilesRouter.delete('/files/:id', requirePermission('clinical.write'), async (req, res) => {
  const file = await findFile(req.params.id);
  await storage.remove(file.storageKey);
  await file.destroy();
  await audit(req, {
    action: 'file.deleted',
    entity: 'patient',
    entityId: file.patientId,
    meta: { fileId: file.id },
  });
  res.status(204).end();
});
