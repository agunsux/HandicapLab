import type { ValidationMetrics } from '../validation/metrics';

// ──── Model Card ───────────────────────────────────────────────────────

export interface ModelCardData {
  modelId: string;
  modelName: string;
  semanticVersion: string;
  algo: string;
  status: string;
  sampleSize: number;
  roi: number;
  yield_: number;
  calibrationEce: number;
  brierScore: number;
  logLoss: number;
  trainedAt: string;
  lastValidatedAt: string;
  knownLimitations: string[];
}

export interface ModelCard {
  type: 'model';
  data: ModelCardData;
  generatedAt: string;
}

// ──── Dataset Card ───────────────────────────────────────────────────

export interface DatasetCardData {
  datasetId: string;
  name: string;
  version: string;
  hash: string;
  fixtureCount: number;
  competitions: string[];
  seasons: string[];
  coverage: number;       // %
  completeness: number;   // %
  freshness: string;      // ISO date of last update
  missingValues: number;
  duplicates: number;
  outliers: number;
  validationStatus: 'valid' | 'degraded' | 'invalid';
  driftDetected: boolean;
}

export interface DatasetCard {
  type: 'dataset';
  data: DatasetCardData;
  generatedAt: string;
}

// ──── Feature Card ──────────────────────────────────────────────────

export interface FeatureCardData {
  featureId: string;
  featureName: string;
  version: string;
  type: string;
  status: string;
  formula: string;
  owner: string;
  dependencies: string[];
  importance?: number;    // 0-1
  validationStatus: 'valid' | 'degraded' | 'invalid';
  validatedAt?: string;
}

export interface FeatureCard {
  type: 'feature';
  data: FeatureCardData;
  generatedAt: string;
}

// ──── Insight Card ─────────────────────────────────────────────────

export interface InsightCardData {
  fixtureId?: string;
  matchLabel?: string;
  marketType?: string;
  confidence: number;           // 0-100
  marketQuality: 'excellent' | 'good' | 'neutral' | 'avoid';
  expectedValue: number;
  reasonSummary: string;
  topEvidence: string[];
  riskLevel: 'low' | 'medium' | 'high';
  recommendation?: string;
}

export interface InsightCard {
  type: 'insight';
  data: InsightCardData;
  generatedAt: string;
}

// ──── Confidence Card ────────────────────────────────────────────────

export interface ConfidenceCardData {
  overall: number;             // 0-100
  modelAgreement: number;      // 0-100
  historicalAccuracy: number;  // 0-100
  calibration: number;         // 0-100
  dataQuality: number;         // 0-100
  marketStability: number;     // 0-100
}

export interface ConfidenceCard {
  type: 'confidence';
  data: ConfidenceCardData;
  generatedAt: string;
}