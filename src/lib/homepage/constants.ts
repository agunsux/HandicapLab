// ============================================================================
// HOMEPAGE INTELLIGENCE — Canonical configuration (SINGLE SOURCE OF TRUTH)
// All thresholds for value classification and the backtest methodology live
// here so the product rules are auditable and documented — never scattered.
// ============================================================================

export const HOMEPAGE_INTELLIGENCE = {
  // --- Dataset provenance (must match verified europe dataset) ---
  datasetVersion: 'europe-dataset-v1',
  backtestVersion: 'walk-forward-v1',
  calculationVersion: 'homepage-intelligence-v1',

  // --- Model ---
  modelVersion: 'prematch-v1',
  dcRhoInit: -0.10,
  dcXi: 0.0018,
  maxGoals: 10,

  // --- Walk-forward methodology (mirrors python_engine/engine/backtester.py) ---
  skipFirstN: 80, // minimum training matches per league
  retrainEvery: 40, // retrain checkpoint interval
  minLeagueMatches: 90, // skip leagues with fewer than skipFirstN + 10

  // --- Edge / confidence filters (project-configured rules) ---
  minEdgePct: 3.0, // MIN_EDGE_PCT from python_engine/config.py
  minConfidence: 70, // MIN_CONFIDENCE from python_engine/config.py
  layakEdgePct: 5.0, // LAYAK verdict edge threshold
  layakConfidence: 80, // LAYAK verdict confidence threshold

  // --- Staking ---
  stakeUnits: 1.0, // flat 1-unit staking (explicit, validated methodology)

  // --- Value classification thresholds (documented product rules) ---
  valueClassification: {
    noValueEvPct: 0.0, // EV < 0       → NO_VALUE
    lowEdgeEvPct: 2.0, // 0 ≤ EV < 2   → LOW_EDGE
    valueEvPct: 5.0, //   2 ≤ EV < 5   → VALUE
    strongValueEvPct: 5.0, // EV ≥ 5   → STRONG_VALUE
  },

  // --- Confidence grading (reuse existing rules from EdgeScanner) ---
  gradeThresholds: {
    eliteEv: 0.15, // EV ≥ 15% → ELITE (A)
    proEv: 0.05, //   EV ≥  5% → PRO (B)
  },

  // --- Odds freshness ---
  oddsStaleAfterMinutes: 30, // beyond this, odds are STALE and not eligible
} as const;

// Market whitelist — only display a market when sufficient data exists.
// Determined dynamically by the backtest results; this is the ordering.
export const MARKET_ORDER = ['ML', 'AH', 'OU', 'BTTS'] as const;
export type MarketKey = (typeof MARKET_ORDER)[number];

// League whitelist — Top Leagues the model is allowed to execute/evaluate on.
// Hardcoded here as the whitelist policy (GOVERNANCE), fixtures themselves are
// never hardcoded — they always originate from the database.
export const LEAGUE_WHITELIST = new Set([
  'ENG-PL',
  'ESP-LALIGA',
  'DEU-BUNDESLIGA',
  'ITA-SERIEA',
  'FRA-LIGUE1',
]);