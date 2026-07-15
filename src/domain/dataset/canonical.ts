/**
 * EPIC 31B.6 — Canonical Data Model (CDM)
 * Immutable domain entity schemas with field-level traceability and lineage.
 */

export type DatasetState = 'INGESTING' | 'MERGING' | 'VALIDATING' | 'FROZEN' | 'DEPRECATED' | 'ARCHIVED';

export type MergeReasonType =
  | 'highest_confidence'
  | 'majority_vote'
  | 'derived'
  | 'manual_override'
  | 'computed';

export interface CanonicalField<T> {
  value: T | null;
  source: string;
  confidence: number;
  mergeReason: MergeReasonType;
}

export interface FixtureLineage {
  provider: string;
  providerVersion: string;
  importTimestamp: string;
  checksum: string;
  rawJsonString: string;
}

export interface CanonicalFixture {
  fixtureId: string; // unique UUID/hash
  fixtureNaturalKey: string; // e.g., EPL|2023-2024|ARS|MCI|2023-10-08
  competitionId: string; // canonical competition ID (e.g. 'EPL')
  seasonId: string; // canonical season ID (e.g. '2023-2024')
  homeTeamId: string; // normalized team ID
  awayTeamId: string; // normalized team ID

  // Traceable fields
  kickoff: CanonicalField<string>; // ISO UTC format
  homeGoals: CanonicalField<number>;
  awayGoals: CanonicalField<number>;
  homeXg: CanonicalField<number>;
  awayXg: CanonicalField<number>;
  homeShots: CanonicalField<number>;
  awayShots: CanonicalField<number>;
  homeShotsOnTarget: CanonicalField<number>;
  awayShotsOnTarget: CanonicalField<number>;
  referee: CanonicalField<string>;
  regime: CanonicalField<string>; // crowd regime

  qualityScore: number; // 0 - 100
  schemaVersion: number;
  datasetVersion: number;
  lineage: FixtureLineage[];
  generatedAt: string;
}

export interface CanonicalOdds {
  fixtureId: string;
  provider: string; // Pinnacle, Bet365, AverageMarket
  marketType: 'ML' | 'AH' | 'OU';
  selection: 'home' | 'draw' | 'away' | 'over' | 'under';
  line?: number | null;
  oddsDecimal: number;
  impliedProbability: number;
  fairProbability: number;
  margin: number;
  receivedAt: string;
  processedTimestamp: string;
}

export interface CanonicalTeam {
  id: string; // lowercase, alphanumeric only, e.g. 'manchesterunited'
  name: string; // canonical display name
  aliases: string[]; // spelling variants
}

export interface CanonicalCompetition {
  id: string;
  name: string;
  country: string;
}
