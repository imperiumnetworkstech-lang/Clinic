import { medicalHistoryBody, type MedicalHistory } from '@edc/shared';
import { decrypt, encrypt } from '../lib/crypto.js';

/**
 * Clinical free text is encrypted at rest. These helpers are the only place it is read or
 * written, so a plain value never reaches the database and decrypted text never reaches logs.
 */
const EMPTY_HISTORY: MedicalHistory = { allergies: '', conditions: '', medications: '', notes: '' };

export function readMedicalHistory(stored: string | null | undefined): MedicalHistory {
  if (!stored) return EMPTY_HISTORY;
  return medicalHistoryBody.parse(JSON.parse(decrypt(stored)));
}

export function sealMedicalHistory(history: MedicalHistory): string | null {
  const empty = Object.values(history).every((value) => value === '');
  return empty ? null : encrypt(JSON.stringify(history));
}

export const sealText = (text: string) => (text ? encrypt(text) : '');
export const openText = (stored: string) => (stored ? decrypt(stored) : '');
