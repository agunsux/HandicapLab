/**
 * HandicapLab Canonical Dataset — Core Types
 * ============================================
 * The canonical schema for ALL historical match data.
 *
 * Every data source (API, CSV, JSON, Supabase) MUST be normalized
 * into these types before reaching ReplayRunner.
 *
 * No `any` types. All fields are strongly typed.
 */

// ─── Canonical Team Identity ─────────────────────────────────────────────

export interface CanonicalTeam {
  id: string;            // e.g. "team:epl:liverpool"
  name: string;          // e.g. "Liverpool"
  shortName: string;     // e.g. "LIV"
  country: string;       // e.g. "England"
  aliases: string[];     // e.g. ["Liverpool FC", "LFC"]
}

// ─── Canonical Competition ───────────────────────────────────────────────

export interface CanonicalCompetition {
  id: string;            // e.g. "comp:epl"
  name: string;          // e.g. "English Premier League"
  shortName: string;     // e.g. "EPL"
  country: string;
  tier: number;
  timezone: string;
  sport: string;         // e.g. "football"
}

// ─── Canonical Season ────────────────────────────────────────────────────

export interface CanonicalSeason {
  id: string;            // e.g. "season:epl:2024-2025"
  competitionId: string;
  name: string;          // e.g. "2024-2025"
  startDate: string;     // ISO 8601
  endDate: string;       // ISO 8601
}

// ─── Canonical Fixture ───────────────────────────────────────────────────

export interface CanonicalFixture {
  id: string;            // e.g. "fix:epl:2024-08-17:liverpool-wolves"
  competitionId: string;
  seasonId: string;
  homeTeamId: string;    // References CanonicalTeam.id
  awayTeamId: string;
  kickoff: string;       // ISO 8601
  round?: string;
  status: 'scheduled' | 'finished' | 'postponed' | 'cancelled';
}

// ─── Canonical Odds ──────────────────────────────────────────────────────

export interface CanonicalOdds {
  fixtureId: string;     // References CanonicalFixture.id
  market: 'ML' | 'AH' | 'OU' | 'BTTS';
  line?: number;
  homeOdds: number;
  drawOdds: number | null;  // null for AH/OU/BTTS
  awayOdds: number;
  openingHomeOdds?: number;
  openingDrawOdds?: number;
  openingAwayOdds?: number;
  closingHomeOdds?: number;
  closingDrawOdds?: number;
  closingAwayOdds?: number;
  timestamp: string;     // ISO 8601
  provider?: string;
}

// ─── Canonical Result ────────────────────────────────────────────────────

export interface CanonicalResult {
  fixtureId: string;
  homeGoals: number;
  awayGoals: number;
  status: 'finished' | 'postponed' | 'cancelled';
}

// ─── Canonical Match (Complete) ──────────────────────────────────────────

export interface CanonicalMatch {
  fixture: CanonicalFixture;
  odds: CanonicalOdds[];
  result?: CanonicalResult;
}

// ─── Dataset Manifest ────────────────────────────────────────────────────

export interface DatasetManifest {
  id: string;
  version: string;
  name: string;
  description?: string;
  hash: string;           // SHA-256 of all canonical data
  createdAt: string;       // ISO 8601
  recordCount: number;
  fixtureCount: number;
  competitions: string[];
  seasons: string[];
  provenance: string;      // e.g. "api-football-2024-08-17"
  schema: 'v1';
}

// ─── Dataset (Immutable) ────────────────────────────────────────────────

export interface CanonicalDataset {
  manifest: DatasetManifest;
  teams: CanonicalTeam[];
  competitions: CanonicalCompetition[];
  seasons: CanonicalSeason[];
  matches: CanonicalMatch[];
}

// ─── Validation ──────────────────────────────────────────────────────────

export interface DatasetValidationError {
  fixtureId: string;
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DatasetValidationReport {
  datasetId: string;
  valid: boolean;
  totalFixtures: number;
  validFixtures: number;
  invalidFixtures: number;
  errors: DatasetValidationError[];
  warnings: DatasetValidationError[];
  duplicateFixtures: number;
  missingResults: number;
  missingOdds: number;
}