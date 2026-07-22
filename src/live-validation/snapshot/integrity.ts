// EPIC 35.2 — Snapshot Chain Integrity Verification
// Recomputes the tamper-evident hash chain over the prediction snapshot
// journal. Any edited, deleted, or reordered record breaks verification.

import type { PredictionSnapshotRecord } from '../types';
import { sha256 } from './snapshot-builder';

export interface ChainVerificationResult {
  valid: boolean;
  checked: number;
  firstBrokenId: string | null;
  detail: string;
}

/** Recompute a snapshot's chain hash from its own fields + previous hash. */
export function recomputeChainHash(
  record: PredictionSnapshotRecord,
  previousChainHash: string | null
): string {
  const { chainHash: _omitted, ...base } = record;
  return sha256(`${previousChainHash ?? 'genesis'}::${sha256(JSON.stringify(base))}`);
}

/** Verify the full snapshot chain in append order. */
export function verifySnapshotChain(records: PredictionSnapshotRecord[]): ChainVerificationResult {
  let previousHash: string | null = null;

  for (const record of records) {
    const expected = recomputeChainHash(record, previousHash);
    if (expected !== record.chainHash) {
      return {
        valid: false,
        checked: records.indexOf(record),
        firstBrokenId: record.id,
        detail: `Chain hash mismatch at snapshot ${record.id}`,
      };
    }
    previousHash = record.chainHash;
  }

  return {
    valid: true,
    checked: records.length,
    firstBrokenId: null,
    detail: `Verified ${records.length} snapshots — chain intact`,
  };
}
