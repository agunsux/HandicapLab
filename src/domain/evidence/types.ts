/**
 * SUPER EPIC 31B.5 — Evidence Ledger Domain Types
 */

import type { ReplayMetrics, ConfidenceInterval } from '../../lib/epic31b/types';

export interface EvidenceRecord {
  experimentId: string;
  datasetSha: string;
  gitCommitSha: string;
  featureVersion: string;
  calibrationVersion: string;
  modelVersion: string;
  randomSeed: number;
  validationMetrics: ReplayMetrics;
  confidenceIntervals: ConfidenceInterval[];
  bootstrapResults: {
    mean: number;
    median: number;
    ciLower: number;
    ciUpper: number;
    isSignificant: boolean;
  };
  monteCarloResults?: {
    cagr: number;
    maxDrawdown: number;
    ruinProbability: number;
    medianBankroll: number;
    worst5Pct: number;
    best5Pct: number;
  };
  runtime: {
    durationMs: number;
    memoryMB: number;
    cpuTimeMs: number;
  };
  timestamp: string;
  evidenceHash: string;
  evidenceSignature: string;
}
