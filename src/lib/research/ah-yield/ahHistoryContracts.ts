// AH HISTORY — Shared DTO contracts (client-safe)
// Location: src/lib/research/ah-yield/ahHistoryContracts.ts
//
// This module contains ONLY type declarations. It deliberately has no runtime
// imports (`fs`, `path`, database clients, etc.) so both server code
// (AhHistoryService) and client components can import the shared history DTOs
// without dragging server-only dependencies into the browser bundle.

import type {
  AhBetObservation,
  AhFavoriteStatus,
  AhProvenance,
  AhSettlementOutcome,
  AhSide,
  SampleSizeStatus,
} from './ahTypes';

export interface AhHistoryFilters {
  league?: string;
  season?: string;
  line?: number;
  side?: AhSide;
  favoriteStatus?: AhFavoriteStatus;
  provenance?: AhProvenance;
  startDate?: string;
  endDate?: string;
  limit?: number;
  offset?: number;
}

export interface MatchCalculationTrace {
  observationId: string;
  canonicalMatchId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  scoreDisplay: string;
  side: AhSide;
  marketLineHome: number;
  selectionLine: number;
  odds: number;
  oppositeOdds: number | null;
  provenance: AhProvenance;
  favoriteStatus: AhFavoriteStatus;
  isQuarterLine: boolean;
  componentLines: [number, number] | null;
  componentOutcomes: [AhSettlementOutcome, AhSettlementOutcome] | null;
  settlementOutcome: AhSettlementOutcome;
  settlementFraction: number;
  stake: number;
  pnl: number;
  returnAmount: number;
  calculationExplanation: string;
}

export interface AggregatedHistoryMetrics {
  sampleSize: number;
  evaluatedBets: number;
  fullWins: number;
  halfWins: number;
  pushes: number;
  halfLosses: number;
  fullLosses: number;
  hitRatePct: number;
  averageOdds: number;
  totalPnl: number;
  yieldRoiPct: number;
  maxDrawdownPct: number;
  sampleStatus: SampleSizeStatus;
  historicalColor: 'GREEN' | 'YELLOW' | 'RED' | 'GREY';
  historicalStatusLabel: string;
}

export interface AhHistoryQueryResult {
  filtersApplied: AhHistoryFilters;
  summary: AggregatedHistoryMetrics;
  totalMatchesAvailable: number;
  observations: AhBetObservation[];
  datasetUpdated: string;
}

export interface AhAvailableFilters {
  leagues: Array<{ id: string; name: string }>;
  seasons: string[];
  lines: number[];
  sides: AhSide[];
  favoriteStatuses: AhFavoriteStatus[];
  provenances: AhProvenance[];
}

export type { AhBetObservation, AhFavoriteStatus, AhProvenance, AhSide };
