// Evidence Ledger — Immutable Record of Every Prediction
// Every claim must be reproducible.
// No anonymous predictions. No silent deletions.

import * as crypto from 'crypto';
import type { PredictionSnapshot, SettlementRecord } from '../prediction/types';

export type EvidenceEventType =
  | 'PREDICTION_CREATED'
  | 'ODDS_CAPTURED'
  | 'MATCH_STARTED'
  | 'MATCH_SETTLED'
  | 'EVALUATION_COMPLETED';

export interface EvidenceEntry {
  id: string;
  predictionId: string;
  settlementId: string | null;
  fixtureId: string;
  modelVersion: string;
  marketType: string;
  eventType: EvidenceEventType;
  inputDataHash: string;
  oddsSnapshotId: string;
  predictionProb: number;
  marketProb: number;
  edge: number;
  actualOutcome: number | null;
  profit: number | null;
  clv: number | null;
  chainHash: string;
  previousEntryId: string | null;
  createdAt: Date;
}

export interface EvidenceLedgerStore {
  /** Append an evidence entry — never overwrite */
  append(entry: EvidenceEntry): Promise<void>;
  /** Get evidence for a specific prediction */
  getByPredictionId(predictionId: string): Promise<EvidenceEntry | null>;
  /** Get evidence for a fixture */
  getByFixtureId(fixtureId: string): Promise<EvidenceEntry[]>;
  /** Get all evidence entries, ordered by createdAt */
  getAll(): Promise<EvidenceEntry[]>;
  /** Verify chain integrity from genesis to latest */
  verifyChainIntegrity(): Promise<{ valid: boolean; brokenAt: string | null }>;
}

export function createEvidenceEntry(
  prediction: PredictionSnapshot,
  settlement: SettlementRecord | null,
  previousEntryId: string | null,
  eventType: EvidenceEventType = 'PREDICTION_CREATED'
): EvidenceEntry {
  const base = {
    predictionId: prediction.id,
    settlementId: settlement?.id ?? null,
    fixtureId: prediction.fixtureId,
    modelVersion: prediction.modelVersion,
    marketType: prediction.marketType,
    eventType,
    inputDataHash: prediction.inputDataHash,
    oddsSnapshotId: prediction.oddsSnapshotId,
    predictionProb: prediction.predictionProb,
    marketProb: prediction.marketProb,
    edge: prediction.edge,
    actualOutcome: settlement?.actualOutcome ?? null,
    profit: settlement?.profit ?? null,
    clv: settlement?.clv ?? null,
    previousEntryId,
    createdAt: new Date(),
  };

  const payload = JSON.stringify(base, Object.keys(base).sort());
  const chainHashInput = `${previousEntryId ?? 'genesis'}::${payload}`;
  const chainHash = crypto.createHash('sha256').update(chainHashInput).digest('hex');

  return { ...base, id: crypto.randomUUID(), chainHash };
}

export class MemoryEvidenceLedgerStore implements EvidenceLedgerStore {
  private entries: EvidenceEntry[] = [];

  async append(entry: EvidenceEntry): Promise<void> {
    this.entries.push(entry);
  }

  async getByPredictionId(predictionId: string): Promise<EvidenceEntry | null> {
    return this.entries.find(e => e.predictionId === predictionId) ?? null;
  }

  async getByFixtureId(fixtureId: string): Promise<EvidenceEntry[]> {
    return this.entries.filter(e => e.fixtureId === fixtureId);
  }

  async getAll(): Promise<EvidenceEntry[]> {
    return [...this.entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }

  async verifyChainIntegrity(): Promise<{ valid: boolean; brokenAt: string | null }> {
    const sorted = [...this.entries].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    for (let i = 0; i < sorted.length; i++) {
      const entry = sorted[i];
      const expectedPrev = i === 0 ? null : sorted[i - 1].id;
      if (entry.previousEntryId !== expectedPrev) {
        return { valid: false, brokenAt: entry.id };
      }
      // Recompute chain hash and verify
      const { chainHash: _chainHash, id: _id, ...base } = entry;
      const payload = JSON.stringify(base, Object.keys(base).sort());
      const chainHashInput = `${expectedPrev ?? 'genesis'}::${payload}`;
      const expectedHash = crypto.createHash('sha256').update(chainHashInput).digest('hex');
      if (entry.chainHash !== expectedHash) {
        return { valid: false, brokenAt: entry.id };
      }
    }
    return { valid: true, brokenAt: null };
  }
}
