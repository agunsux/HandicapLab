// AH YIELD ENGINE — Canonical types (P0/P1 Asian Handicap research)
// One canonical observation → one settlement → one P&L, fully traceable.

export type AhSide = 'home' | 'away';

/**
 * Snapshot semantics actually available in the sources:
 * - 'opening' / 'closing' — genuine pre-match open/close columns
 *   (football-data.co.uk AHh/PAHH vs AHCh/PCAHH and B365AHH vs B365CAHH).
 * - 'single_quote' — the source only publishes ONE aggregate quote
 *   (BetBrain BbAHh/BbAvAHH/BbAvAHA); it has no open/close semantics.
 * Intraday snapshots (T-24h/T-6h/T-1h) are NOT available in the data.
 */
export type AhSnapshot = 'opening' | 'closing' | 'single_quote';

/**
 * True provenance of an AH quote, resolved from the actual source CSV columns
 * (never from the legacy bookmaker_source label, which mislabels BetBrain
 * aggregate columns as Pinnacle in pre-2019 sources).
 * - 'best_available' is a derived cohort: the highest price across genuine
 *   Pinnacle/Bet365 at the same match, line, snapshot and side. It is never
 *   merged with any single-bookmaker cohort.
 */
export type AhProvenance = 'pinnacle' | 'bet365' | 'betbrain_avg' | 'best_available' | 'unknown';

export type AhSettlementOutcome =
  | 'FULL_WIN'
  | 'HALF_WIN'
  | 'PUSH'
  | 'HALF_LOSS'
  | 'FULL_LOSS'
  | 'VOID';

export type AhFavoriteStatus = 'favorite' | 'underdog' | 'market_neutral';

export type SampleSizeStatus =
  | 'INSUFFICIENT_SAMPLE'
  | 'LOW_SAMPLE'
  | 'MODERATE_SAMPLE'
  | 'STRONG_SAMPLE';

export interface CanonicalMatchRecord {
  canonicalId: string;
  leagueId: string;
  cluster: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  result: string;
  resultVerified: boolean;
  totalGoals: number;
}

export interface MarketOddsRecord {
  oddsId: string;
  canonicalId: string;
  leagueId: string;
  cluster: string;
  season: string;
  matchDate: string;
  market: string;
  observation: string;
  bookmakerSource: string;
  line: number | null;
  homeOdds: number | null;
  drawOdds: number | null;
  awayOdds: number | null;
  overOdds: number | null;
  underOdds: number | null;
  sourceFile: string;
  sourceRow: number;
  datasetVersion: string;
  ingestionVersion: string;
}

/** One directional, settlement-ready bet observation (1-unit stake). */
export interface AhBetObservation {
  observationId: string;
  oddsId: string;
  canonicalMatchId: string;
  leagueId: string;
  season: string;
  matchDate: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  side: AhSide;
  /** Line as quoted on the home side (e.g. -0.5). */
  marketLineHome: number;
  /** Line from the selected side's perspective (home: L, away: -L). */
  selectionLine: number;
  odds: number;
  /** Price of the opposite side of the same market row (for two-way devig). */
  oppositeOdds: number | null;
  snapshot: AhSnapshot;
  provenance: AhProvenance;
  favoriteStatus: AhFavoriteStatus;
  sourceFile: string;
  sourceRow: number;
  dataSource: string;
  settlement: AhSettlementOutcome;
  /**
   * Signed settlement score s ∈ {-1, -0.5, 0, +0.5, +1}:
   * fraction of the stake won (positive) or lost (negative) at the
   * win/loss level, before odds. P&L = s * (odds - 1) for s > 0, s for s <= 0.
   */
  settlementFraction: number;
  stake: number;
  pnl: number;
  returnAmount: number;
}

export interface RejectedAhRow {
  oddsId: string;
  canonicalId: string;
  reason: string;
}

export interface BuildObservationsResult {
  observations: AhBetObservation[];
  rejected: RejectedAhRow[];
  duplicates: number;
  duplicateKeys: string[];
  unmatchedOddsRows: number;
  provenanceCounts: Record<string, number>;
  snapshotCounts: Record<string, number>;
}

export interface AhYieldMetrics {
  line: number;
  side: AhSide;
  bets: number;
  evaluatedBets: number;
  fullWins: number;
  halfWins: number;
  pushes: number;
  halfLosses: number;
  fullLosses: number;
  voidBets: number;
  /** wins (full + 0.5*half) / evaluated non-push bets. */
  weightedHitRate: number;
  /** (fullWins + halfWins) / evaluated non-push bets. */
  cleanHitRate: number;
  /** probability that a non-push bet returned a positive amount. */
  profitProbability: number;
  totalStake: number;
  totalPnl: number;
  roi: number;
  yieldPct: number;
  roiStdError: number;
  roiCi95: [number, number];
  probabilityOfPositiveRoi: number;
  averageOdds: number;
  medianOdds: number;
  minOdds: number;
  maxOdds: number;
  sampleStart: string;
  sampleEnd: string;
  leagueCount: number;
  matchCount: number;
  sampleSizeStatus: SampleSizeStatus;
  maxDrawdown: number;
  longestLosingStreak: number;
  returnStdDev: number;
  profitFactor: number | null;
  sharpeLike: number | null;
}

export interface AhYieldCurvePoint {
  matchDate: string;
  betsCumulative: number;
  pnlCumulative: number;
  stakeCumulative: number;
  roiCumulative: number;
}

export interface AhProvenanceLayout {
  sourceFile: string;
  openBranch: AhProvenance | 'none';
  closeBranch: AhProvenance | 'none';
}
