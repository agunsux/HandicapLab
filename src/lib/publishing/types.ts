// ============================================================================
// HANDICAPLAB → SALMO.DEV PRODUCTION PUBLISHING DATA CONTRACTS
// ============================================================================
// Location: src/lib/publishing/types.ts
//
// Core Invariants:
// 1. Production Validity != Signal Strength (Confidence).
// 2. Low confidence (<40%, 40-49%) predictions that are production-valid
//    MUST remain visible badged as VERY_WEAK or WEAK.
// 3. Supported markets strictly: AH, OU, BTTS (Moneyline unsupported).
// 4. Single source of truth for published signals and transition audit logs.
// ============================================================================

import { CanonicalMarket } from '@/lib/daily-picks/types';
import { LeagueTier } from '@/lib/config/multiLeagueRegistry';

export type PublishState =
  | 'DISCOVERED'    // Ingested by registry
  | 'RECONCILING'   // Checking odds & parameters
  | 'VALIDATING'    // Running production validity gates
  | 'VALID'         // Technical integrity verified
  | 'PUBLISHED'     // Live on SALMO.DEV
  | 'SHADOW'        // Non-active candidate league (held from public display)
  | 'HELD'          // Incomplete data, missing sharp odds, or rate-limited
  | 'STALE'         // Odds or prediction freshness expired
  | 'INVALID'       // Data contamination, synthetic data, or gate failure
  | 'REMOVED'       // Past kickoff, postponed, or cancelled
  | 'FAILED';       // Exception during reconciliation

export type SignalStrengthLevel = 'STRONG' | 'MODERATE' | 'WEAK' | 'VERY_WEAK';

export type SignalColor = 'green' | 'yellow' | 'orange' | 'red';

export interface ProductionSignalDTO {
  // Canonical Identity
  signalId: string; // Deterministic: sig_{canonicalMatchId}_{market}_{selection}
  canonicalMatchId: string;
  fixtureId: string;
  providerFixtureId: string;
  match: string; // "Arsenal vs Chelsea"
  homeTeam: string;
  awayTeam: string;
  competition: string; // "Premier League"
  leagueKey: string; // "ENG-PL"
  leagueTier: LeagueTier;
  kickoffUtc: string;

  // Market & Selection
  market: CanonicalMarket;
  selection: string; // "Arsenal", "Over 2.5", "Yes"
  line: number | null; // e.g. -0.25, 2.5, null for ML

  // Quantitative Metrics (Strictly Disaggregated)
  currentOdds: number; // Current Pinnacle sharp decimal odds (Reference Price)
  modelProbability: number; // Dixon-Coles model probability (0.0000 - 1.0000)
  marketProbability: number; // De-vigged market implied probability (0.0000 - 1.0000)
  edge: number; // modelProbability - marketProbability
  expectedValue: number; // (modelProbability * currentOdds) - 1
  fairOdds: number; // 1 / modelProbability

  // Signal Strength / Confidence (Purely Presentation, NOT Gating)
  confidence: number; // 0 - 100 from canonical ValueEngine
  strengthLevel: SignalStrengthLevel;
  signalColor: SignalColor;
  confidenceDisclaimer: string;

  // Operational State & Governance
  publishState: PublishState;
  validityStatus: 'VALID' | 'SHADOW' | 'HELD' | 'STALE' | 'INVALID';
  rejectionReason: string | null;

  // Temporal & Provenance
  dataFreshnessSeconds: number;
  freshnessText: string;
  predictionTimestampUtc: string;
  oddsTimestampUtc: string;
  lastReconciledUtc: string;
  payloadHash: string;

  // Three Disaggregated Pricing Pillars (Gate 2 & 3)
  referencePrice?: any;
  modelPrice?: any;
  executionPrice?: any;
  suggestedBet?: any;
  clvStatus?: 'PENDING' | 'VERIFIED' | 'VOID';
  lifecycle?: 'DRAFT' | 'PUBLISHED' | 'LIVE' | 'COMPLETED' | 'CANCELLED' | 'VOID';
  evidenceStatus?: 'DATA_VERIFIED' | 'MODEL_VERIFIED' | 'CLV_PENDING' | 'CLV_VERIFIED' | 'RESULT_VERIFIED';

  // Provenance Breakdown
  predictionId?: string;
  validationStatus?: string;
  modelVersion?: string;
  recommendation?: string;
  bookmaker?: string;
  competitionId?: number | string;
  providerProvenance: {
    fixtures: string;
    odds: string;
    statistics: string;
    modelVersion: string;
  };
}

export type PublishedSignal = ProductionSignalDTO;

export interface PublishTransitionEvent {
  transitionId: string;
  signalId: string;
  canonicalMatchId: string;
  market: CanonicalMarket;
  selection: string;
  previousState: PublishState | null;
  newState: PublishState;
  transitionReason: string;
  timestampUtc: string;
  payloadHash: string;
  triggeredBy: 'SCHEDULER_CRON' | 'EVENT_QUEUE' | 'PROVIDER_UPDATE' | 'READ_THROUGH' | 'MANUAL_OVERRIDE';
}

export interface ReconciliationReport {
  timestampUtc: string;
  triggeredBy: string;
  discoveredFixtures: number;
  reconciledOdds: number;
  evaluatedPredictions: number;
  publishedCount: number;
  updatedCount: number;
  heldCount: number;
  shadowCount: number;
  removedCount: number;
  failedCount: number;
  durationMs: number;
  quotaRemaining: {
    apiFootball: number;
    oddsPapi: number;
  };
}

export interface MarketSignalInput {
  canonicalMatchId: string;
  fixtureId: string;
  providerFixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  leagueKey: string;
  kickoffUtc: string;
  market: CanonicalMarket;
  selection: string;
  line: number;
  marketOdds: number;
  fairOdds: number;
  modelProbability: number;
  edge: number;
  expectedValue: number;
  confidence: number;
  recommendation?: string;
  oddsTimestampUtc: string;
  predictionTimestampUtc: string;
  modelVersion: string;
  providerSources: {
    fixtures: string;
    odds: string;
    statistics: string;
  };
  sampleSizeHome: number;
  sampleSizeAway: number;
  quotaAllowed: boolean;
  bookmaker?: string;
}
