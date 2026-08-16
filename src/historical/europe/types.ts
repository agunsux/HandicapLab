// Historical European dataset — shared types.
// Location: src/historical/europe/types.ts

export type ClusterId = 'A' | 'B' | 'C';
export type LeagueStatus = 'INCLUDED' | 'EXCLUDED';
export type ResultCode = 'H' | 'D' | 'A';
export type ReadinessLevel = 'READY' | 'PARTIAL' | 'INSUFFICIENT';

export interface LeagueEntry {
  cluster: ClusterId;
  /** Deterministic normalized identifier, e.g. ENG-PL. */
  leagueId: string;
  name: string;
  country: string;
  /** football-data.co.uk division code, e.g. E0. */
  footballDataCode: string;
  status: LeagueStatus;
  /** Non-empty when EXCLUDED — exact reason, never fabricated data. */
  excludeReason?: string;
}

/**
 * Raw odds preserved verbatim from the source file. Every field is optional and
 * a missing value is stored as absent (undefined → serialized null). No field is
 * ever derived from another odds field (no pseudo-AH/pseudo-OU).
 */
export interface OddsMarkets {
  /** Pinnacle 1X2 (open). */
  h1?: number | null;
  d1?: number | null;
  a1?: number | null;
  /** Pinnacle 1X2 (closing). */
  ch1?: number | null;
  cd1?: number | null;
  ca1?: number | null;
  /** Asian Handicap (open). AHh is the handicap line. */
  ahLine?: number | null;
  ahHome?: number | null;
  ahAway?: number | null;
  /** Asian Handicap (closing). */
  chLine?: number | null;
  chHome?: number | null;
  chAway?: number | null;
  /** Over/Under line (open) — football-data.co.uk provides 2.5 for Pinnacle. */
  ouLine?: number | null;
  over?: number | null;
  under?: number | null;
  /** Over/Under line (closing). */
  couLine?: number | null;
  cover?: number | null;
  cunder?: number | null;
  /** Canonical bookmaker the odds columns came from (e.g. 'pinnacle'|'bet365'). */
  bookmakerSource: string;
}

export interface CanonicalMatch {
  canonicalId: string;
  leagueId: string;
  cluster: ClusterId;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: ResultCode;
  resultVerified: boolean;
  // Deterministically derived markets (never from odds, always from the score).
  totalGoals: number;
  homeWin: boolean;
  draw: boolean;
  awayWin: boolean;
  btts: boolean;
  over15: boolean;
  over25: boolean;
  over35: boolean;
  under15: boolean;
  under25: boolean;
  under35: boolean;
  odds: OddsMarkets | null;
  // Provenance — every record traceable back to a source file + row.
  sourceProvider: string;
  sourceFile: string;
  sourceRow: number;
  normalizationVersion: string;
  schemaVersion: string;
}

export interface DedupDecision {
  canonicalId: string;
  keptSource: string;
  discardedSources: string[];
}

export interface LeagueMeta {
  leagueId: string;
  name: string;
  country: string;
  cluster: ClusterId;
  status: LeagueStatus;
  excludeReason?: string;
  seasons: string[];
  earliestMatchDate: string | null;
  latestMatchDate: string | null;
  matches: number;
  valid: number;
  rejected: number;
  duplicates: number;
}

export interface MarketAvailability {
  ml: number;
  ah: number;
  ou: number;
  btts: number;
}

export interface LeagueCoverage extends LeagueMeta {
  coverage: MarketAvailability;
  mlPct: number;
  ahPct: number;
  ouPct: number;
  bttsPct: number;
  readiness: { ml: ReadinessLevel; ah: ReadinessLevel; ou: ReadinessLevel; btts: ReadinessLevel };
}

export interface ClusterCoverage {
  cluster: ClusterId;
  leaguesIncluded: number;
  seasons: number;
  matches: number;
  valid: number;
  ml: number;
  ah: number;
  ou: number;
  btts: number;
}

export interface HistoricalManifest {
  dataset_version: string;
  generated_at: string;
  source: string;
  schema_version: string;
  normalization_version: string;
  leagues: LeagueCoverage[];
  clusters: ClusterCoverage[];
  seasons: string[];
  /** Total raw rows parsed from source files (before dedup/rejection). */
  raw_record_count: number;
  match_count: number;
  valid_match_count: number;
  rejected_match_count: number;
  /** Duplicates RESOLVED during canonicalization (source-priority dedup). */
  duplicate_resolved_count: number;
  /** Duplicates REMAINING in the canonical dataset — target 0. */
  duplicate_count: number;
  odds_coverage: { ml: number; ah: number; ou: number; btts: number };
  /** Stable digest over the sorted canonical records — reproducibility check. */
  hash: string;
}
