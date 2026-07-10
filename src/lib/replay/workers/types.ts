/**
 * HandicapLab Mass Replay Engine — Worker Types
 * ===============================================
 * Types for the parallel replay scheduler.
 */

export interface ReplayJob {
  id: string;
  datasetId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: ReplayJobConfig;
  progress: ReplayProgress;
  checkpoint?: ReplayCheckpoint;
  createdAt: string;
  updatedAt: string;
}

export interface ReplayJobConfig {
  maxMatches?: number;
  batchSize: number;
  parallelWorkers: number;
  marketTypes?: string[];
  kellyMultiplier?: number;
}

export interface ReplayBatch {
  id: string;
  jobId: string;
  fixtureIds: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  workerId?: string;
  startedAt?: string;
  completedAt?: string;
  metrics?: ReplayBatchMetrics;
}

export interface ReplayBatchMetrics {
  predictionsGenerated: number;
  durationMs: number;
  failedMatches: number;
}

export interface ReplayProgress {
  totalMatches: number;
  processedMatches: number;
  completedBatches: number;
  totalBatches: number;
  failedBatches: number;
  estimatedEtaMs: number;
  speed: number; // matches/second
}

export interface ReplayCheckpoint {
  completedBatchIds: string[];
  completedFixtureIds: string[];
  processedCount: number;
  timestamp: string;
}

export interface WorkerStatus {
  id: string;
  status: 'idle' | 'running' | 'completed' | 'failed';
  currentBatchId?: string;
  matchesProcessed: number;
  startedAt?: string;
}

export interface ReplayReport {
  jobId: string;
  datasetId: string;
  datasetVersion: string;
  datasetHash: string;
  totalFixtures: number;
  processedFixtures: number;
  totalPredictions: number;
  totalSettlements: number;
  durationMs: number;
  throughput: number; // matches/second
  failedMatches: number;
  skippedMatches: number;
  roi: number;
  yield_: number;
  hitRate: number;
  avgEdge: number;
  avgKelly: number;
  startedAt: string;
  completedAt: string;
}