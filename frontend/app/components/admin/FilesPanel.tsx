import { FILE_CONTENT_TYPES, FILE_KIND_LABELS, MAX_FILE_BYTES } from '@edc/shared';
import { Eye, Link2, Paperclip, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ApiError, filesApi, type PatientFileRow } from '../../lib/admin-api';
import { Button } from '../ui/Button';

const sizeLabel = (bytes: number) =>
  bytes >= 1024 * 1024
    ? `${(bytes / 1024 / 1024).toFixed(1)} MB`
    : `${Math.max(1, Math.round(bytes / 1024))} KB`;

const when = (iso: string) =>
  new Intl.DateTimeFormat('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  }).format(new Date(iso));

const problemText = (caught: unknown, fallback: string) =>
  caught instanceof ApiError ? caught.message : fallback;

/**
 * X-rays, photos and reports for one patient. Files open through links that expire after a
 * few minutes; a share link for the patient lasts longer and every view and share is logged.
 */
export function FilesPanel({ patientId, canWrite }: { patientId: string; canWrite: boolean }) {
  const [files, setFiles] = useState<PatientFileRow[] | null>(null);
  const [available, setAvailable] = useState(true);
  const [kind, setKind] = useState<PatientFileRow['kind']>('xray');
  const [uploading, setUploading] = useState(false);
  const [shared, setShared] = useState<{ id: string; url: string; expiresAt: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [error, setError] = useState('');
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await filesApi.list(patientId);
      setAvailable(result.available);
      setFiles(result.items);
    } catch (caught) {
      setError(problemText(caught, 'Could not load files.'));
      setFiles([]);
    }
  }, [patientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const file = input.current?.files?.[0];
    if (!file) return;
    setError('');
    if (file.size > MAX_FILE_BYTES) {
      setError('Files can be up to 15 MB.');
      return;
    }
    setUploading(true);
    try {
      await filesApi.upload(patientId, kind, file);
      if (input.current) input.current.value = '';
      await load();
    } catch (caught) {
      setError(problemText(caught, 'Upload failed. Please try again.'));
    } finally {
      setUploading(false);
    }
  };

  const view = async (id: string) => {
    // Open the tab now (inside the click) so pop-up blockers allow it, then point it at the link.
    const tab = window.open('', '_blank');
    try {
      const { url } = await filesApi.viewUrl(id);
      if (tab) tab.location.href = url;
      else window.location.href = url;
    } catch (caught) {
      tab?.close();
      setError(problemText(caught, 'Could not open the file.'));
    }
  };

  const share = async (id: string) => {
    setError('');
    try {
      const link = await filesApi.share(id, 48);
      const url = new URL(link.url, window.location.origin).toString();
      await navigator.clipboard?.writeText(url).catch(() => undefined);
      setShared({ id, url, expiresAt: link.expiresAt });
    } catch (caught) {
      setError(problemText(caught, 'Could not create a share link.'));
    }
  };

  const remove = async (id: string) => {
    try {
      await filesApi.remove(id);
      setConfirmDelete(null);
      await load();
    } catch (caught) {
      setError(problemText(caught, 'Could not delete the file.'));
    }
  };

  return (
    <section className="rounded-3xl bg-white p-5 ring-1 ring-neutral-200 sm:p-6">
      <h2 className="text-lg font-bold">Files</h2>
      {!available ? (
        <p className="mt-3 text-muted">
          File storage isn’t set up yet, so X-rays and photos can’t be uploaded.
        </p>
      ) : (
        canWrite && (
          <form
            onSubmit={(event) => void upload(event)}
            className="mt-4 flex flex-wrap items-end gap-3"
          >
            <label className="text-sm font-semibold">
              Type
              <select
                value={kind}
                onChange={(event) => setKind(event.target.value as PatientFileRow['kind'])}
                className="mt-1 block min-h-11 rounded-xl bg-white px-3 ring-1 ring-neutral-300"
              >
                {Object.entries(FILE_KIND_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="min-w-0 flex-1 text-sm font-semibold">
              File{' '}
              <span className="font-normal text-muted">
                (JPEG, PNG, WebP, PDF or DICOM, up to 15 MB)
              </span>
              <input
                ref={input}
                type="file"
                required
                accept={FILE_CONTENT_TYPES.join(',')}
                className="mt-1 block min-h-11 w-full rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-neutral-300 file:mr-3 file:rounded-full file:border-0 file:bg-primary-50 file:px-3 file:py-1 file:font-semibold file:text-primary-700"
              />
            </label>
            <Button type="submit" size="sm" disabled={uploading}>
              <Upload size={16} />
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </form>
        )
      )}

      {error && (
        <p
          role="alert"
          className="mt-3 rounded-2xl bg-[#FEF4F3] p-3 text-sm font-medium text-[#92020B]"
        >
          {error}
        </p>
      )}

      {files?.length === 0 && available && <p className="mt-4 text-muted">No files yet.</p>}
      <ul className="mt-4 divide-y divide-neutral-200">
        {files?.map((file) => (
          <li key={file.id} className="py-3">
            <div className="flex flex-wrap items-center gap-3">
              <Paperclip size={18} className="shrink-0 text-primary-600" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{file.name}</span>
                <span className="text-sm text-muted">
                  {FILE_KIND_LABELS[file.kind]} · {sizeLabel(file.sizeBytes)} ·{' '}
                  {when(file.createdAt)}
                  {file.uploadedBy ? ` · ${file.uploadedBy}` : ''}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => void view(file.id)}>
                <Eye size={16} />
                View
              </Button>
              {canWrite && (
                <>
                  <Button size="sm" variant="ghost" onClick={() => void share(file.id)}>
                    <Link2 size={16} />
                    Share
                  </Button>
                  {confirmDelete === file.id ? (
                    <>
                      <Button size="sm" variant="secondary" onClick={() => void remove(file.id)}>
                        Delete for good
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(null)}>
                        Keep
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      aria-label={`Delete ${file.name}`}
                      onClick={() => setConfirmDelete(file.id)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  )}
                </>
              )}
            </div>
            {shared?.id === file.id && (
              <p role="status" className="mt-2 rounded-2xl bg-surface p-3 text-sm">
                Link copied. It works until{' '}
                {new Intl.DateTimeFormat('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: 'numeric',
                  minute: '2-digit',
                  timeZone: 'Asia/Kolkata',
                }).format(new Date(shared.expiresAt))}
                . Send it to the patient on WhatsApp.
                <input
                  readOnly
                  value={shared.url}
                  aria-label="Share link"
                  className="mt-2 block w-full rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-neutral-300"
                  onFocus={(event) => event.currentTarget.select()}
                />
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
