// ============================================================================
// HANDICAPLAB / SALMO.DEV — DAILY PICKS DATA CONTRACT & TYPES
// ============================================================================
// Single source of truth for daily picks, prediction provenance, and API DTOs.
// Canonical markets supported: AH (Asian Handicap), OU (Over/Under 2.5), BTTS (Both Teams To Score).
// ============================================================================

export type CanonicalMarket = 'AH' | 'OU' | 'BTTS';
import type { PublishState } from '@/lib/publishing/types';

export type ValidationStatus =
  | 'VALUE_CANDIDATE'
  | 'VALIDATED_EDGE'
  | 'PROVISIONAL_EDGE'
  | 'NO_EDGE'
  | 'MARGINAL_EV'
  | 'INSUFFICIENT_DATA'
  | 'INSUFFICIENT_MODEL'
  | 'STALE_ODDS'
  | 'INVALID_MARKET_SPREAD'
  | 'INCOMPLETE_METADATA'
  | 'CIRCULARITY_VIOLATION'
  | 'TEMPORAL_LEAKAGE'
  | 'BLOCKED';

export type PredictionStatus = 'ACTIVE' | 'SETTLED' | 'VOID';

export type PredictionLifecycleStage = 'EARLY' | 'PRE-MATCH' | 'FINAL';

export type PredictionHorizonBucket =
  | 'TODAY'
  | 'TOMORROW'
  | '+2D'
  | '+3D'
  | '+4D'
  | '+5D'
  | '+6D'
  | '+7D';

export interface OddsProvenance {
  provider: 'oddspapi';
  bookmaker: 'pinnacle' | string;
  market: CanonicalMarket;
  line: number;
  marketOdds: number;
  impliedProbability: number;
  devigProbability: number;
  oddsTimestampUtc: string;
  snapshotId: string;
}

export interface StatisticalProvenance {
  provider: 'footystats' | 'apifootball';
  season: string;
  sampleSize: number;
  homeXg?: number;
  awayXg?: number;
  dataTimestampUtc: string;
  coverage: string;
}

export interface DailyPickRecord {
  predictionId: string;
  fixtureId: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffUtc: string;
  market: CanonicalMarket;
  selection: string;
  line: number;
  predictionTimestampUtc: string;
  oddsTimestampUtc: string;
  modelVersion: string;
  dataVersion: string;
  providerSources: {
    fixtures: string;
    odds: string;
    statistics: string;
  };
  modelProbability: number; // 0.0000 - 1.0000
  marketProbability: number; // 0.0000 - 1.0000 (devigged)
  fairOdds: number; // 1 / modelProbability
  marketOdds: number; // Pinnacle decimal odds
  edge: number; // (modelProbability - marketProbability)
  expectedValue: number; // (modelProbability * marketOdds) - 1
  confidence: number; // 0 - 100
  validationStatus: ValidationStatus;
  dataQuality: number; // 0 - 100
  providerHealth: 'HEALTHY' | 'WARNING' | 'DEGRADED';
  status: PredictionStatus;
  lifecycleStage?: PredictionLifecycleStage;
  horizonBucket?: PredictionHorizonBucket;
  strengthLevel?: 'STRONG' | 'MODERATE' | 'WEAK' | 'VERY_WEAK';
  signalColor?: 'green' | 'yellow' | 'orange' | 'red';
  publishState?: PublishState;
  confidenceDisclaimer?: string;
  freshnessText?: string;
  apiFootballFixtureTimestamp: string;
  footyStatsSnapshotTimestamp?: string;
  oddsPapiSnapshotTimestamp: string;
}

export interface DailyPicksApiResponse {
  success: boolean;
  count: number;
  dataState?: 'REAL' | 'CACHED' | 'STALE' | 'DATA_UNAVAILABLE' | 'NO_QUALIFIED_PICKS' | 'NO_FIXTURES';
  providerState?: string;
  fixtureCount?: number;
  qualifiedPickCount?: number;
  lastSuccessfulSync?: string | null;
  picks: DailyPickRecord[];
  meta: {
    asOfUtc: string;
    freshnessMinutesAgo: number;
    window: string;
    canonicalDomain: 'salmo.dev';
    quotaState: {
      apiFootball: { remaining: number; status: string };
      oddsPapi: { remaining: number; status: string };
      footyStats?: { remaining: number; status: string };
    };
  };
  message?: string;
}

export interface UpcomingMatchDTO {
  fixtureId: string;
  apiFootballId: number;
  competition: string;
  leagueId: number;
  season: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  status: string;
  hasPinnacleOdds: boolean;
  hasFootyStatsEnrichment: boolean;
  lifecycleStage?: PredictionLifecycleStage;
  horizonBucket?: PredictionHorizonBucket;
}
