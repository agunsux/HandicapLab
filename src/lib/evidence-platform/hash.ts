/**
 * Historical Evidence Platform — Hashing utilities
 * =================================================
 * Pure, deterministic hashing helpers used for checksums and fingerprints.
 *
 * A "checksum" is computed over raw source bytes/text.
 * A "fingerprint" is computed over canonical data (order-independent shape).
 */

import crypto from 'crypto';
import type { CanonicalDataset } from '../dataset/types';

/** SHA-256 of arbitrary string content (raw source checksum). */
export function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

/** SHA-256 of the raw bytes of a source payload (string or JSON-serializable). */
export function checksumOfSource(raw: string | unknown): string {
  const content = typeof raw === 'string' ? raw : JSON.stringify(raw);
  return sha256(content);
}

/**
 * Deterministic fingerprint over canonical data. Matches, teams, and
 * competitions are sorted by id so that ordering does not change the hash.
 */
export function fingerprintDataset(dataset: CanonicalDataset): string {
  const matches = [...dataset.matches].sort((a, b) => a.fixture.id.localeCompare(b.fixture.id));
  const teams = [...dataset.teams].sort((a, b) => a.id.localeCompare(b.id));
  const competitions = [...dataset.competitions].sort((a, b) => a.id.localeCompare(b.id));
  const seasons = [...dataset.seasons].sort((a, b) => a.id.localeCompare(b.id));
  const canonical = { matches, teams, competitions, seasons };
  return sha256(JSON.stringify(canonical));
}
