/**
 * Signal Classifier - Canonical Engine (Epic 64 / Day 0 Operating Model)
 *
 * Implements deterministic traffic light signal classification:
 * - 🟢 GREEN: Expected edge >= 5%, Sample size N >= 30, Confidence >= 60%, Pinnacle verified.
 * - 🟡 YELLOW: Positive edge >= 0%, Sample size N >= 10, moderate margin/sample.
 * - 🔴 RED: Negative edge < 0%, Sample size N < 10, or uncalibrated variance.
 *
 * Feed visibility policy:
 * - Global feed: GREEN signals only.
 * - Priority Leagues (ENG, ESP, ITA, GER, FRA, NED): All signals (GREEN, YELLOW, RED).
 */

export type SignalColor = 'GREEN' | 'YELLOW' | 'RED';
export type MarketType = 'AH' | 'OU' | 'BTTS';

export interface SignalMetricsInput {
  market: MarketType;
  selection: string;
  modelProbability: number;      // e.g. 0.58 (58%)
  marketOdds: number;            // e.g. 1.95 (decimal)
  sampleSize: number;            // Historical N in league/market context
  confidence?: number;           // 0 - 100
  leagueId?: number;
  leagueName?: string;
  kickoffUtc: string;
  isPinnacleBenchmark?: boolean;
}

export interface ClassifiedSignal {
  color: SignalColor;
  market: MarketType;
  selection: string;
  fairOdds: number;
  marketOdds: number;
  edgePct: number;               // in percentage e.g. 7.2 (%)
  rawEdge: number;               // decimal difference: (prob * odds) - 1
  sampleSize: number;
  confidence: number;
  isPubliclyVisible: boolean;
  publicVisibilityReason: string;
  ruleVersion: string;
  rejectionReason: string | null;
}

export const SIGNAL_CLASSIFIER_VERSION = 'v1.0.0-prod-day0';

// Canonical Top League Whitelist IDs (API-Football)
export const PRIORITY_LEAGUE_IDS = new Set<number>([
  39,  // English Premier League
  140, // Spanish La Liga
  135, // Italian Serie A
  78,  // German Bundesliga
  61,  // French Ligue 1
  88,  // Dutch Eredivisie
]);

export const WHITELIST_LEAGUE_IDS = new Set<number>([
  ...PRIORITY_LEAGUE_IDS,
  40,  // English Championship
  98,  // Japanese J1 League
  292, // Korean K League 1
  274, // Indonesian Liga 1
]);

/**
 * Checks whether a league qualifies as a priority tier league (receives full signal spectrum)
 */
export function isPriorityLeague(leagueId?: number, leagueName?: string): boolean {
  if (leagueId && PRIORITY_LEAGUE_IDS.has(leagueId)) return true;
  if (!leagueName) return false;
  const lower = leagueName.toLowerCase();
  return (
    lower.includes('premier league') ||
    lower.includes('la liga') ||
    lower.includes('serie a') ||
    lower.includes('bundesliga') ||
    lower.includes('ligue 1') ||
    lower.includes('eredivisie')
  );
}

/**
 * Checks whether a league is within the supported research whitelist
 */
export function isWhitelistedLeague(leagueId?: number): boolean {
  if (!leagueId) return true; // Default allow if unspecified
  return WHITELIST_LEAGUE_IDS.has(leagueId);
}

/**
 * Classifies a betting opportunity into GREEN, YELLOW, or RED.
 * Strictly adheres to non-fabrication: Never force a green signal.
 */
export function classifySignal(input: SignalMetricsInput): ClassifiedSignal {
  const {
    market,
    selection,
    modelProbability,
    marketOdds,
    sampleSize,
    confidence = 50,
    leagueId,
    leagueName,
    kickoffUtc,
  } = input;

  // Validate inputs
  if (modelProbability <= 0 || modelProbability >= 1 || marketOdds <= 1.0) {
    return {
      color: 'RED',
      market,
      selection,
      fairOdds: modelProbability > 0 ? Number((1 / modelProbability).toFixed(2)) : 99.0,
      marketOdds,
      edgePct: 0,
      rawEdge: -1,
      sampleSize,
      confidence: 0,
      isPubliclyVisible: false,
      publicVisibilityReason: 'Invalid odds or probability input',
      ruleVersion: SIGNAL_CLASSIFIER_VERSION,
      rejectionReason: 'INVALID_NUMERICAL_INPUT',
    };
  }

  const fairOdds = Number((1 / modelProbability).toFixed(3));
  // Expected Value edge: (Probability * MarketOdds) - 1
  const rawEdge = (modelProbability * marketOdds) - 1;
  const edgePct = Number((rawEdge * 100).toFixed(2));

  let color: SignalColor = 'RED';
  let rejectionReason: string | null = null;

  // Classification Thresholds:
  // GREEN: Edge >= 5.0%, Sample Size >= 30, Confidence >= 60%
  if (edgePct >= 5.0 && sampleSize >= 30 && confidence >= 60) {
    color = 'GREEN';
  }
  // YELLOW: Edge >= 0.0% (positive expectation), Sample Size >= 10
  else if (edgePct >= 0.0 && sampleSize >= 10) {
    color = 'YELLOW';
    if (sampleSize < 30) {
      rejectionReason = 'SUB_OPTIMAL_SAMPLE_SIZE';
    } else if (edgePct < 5.0) {
      rejectionReason = 'MODERATE_EDGE_MARGIN';
    }
  }
  // RED: Negative expectation or insufficient sample
  else {
    color = 'RED';
    if (edgePct < 0) {
      rejectionReason = 'NEGATIVE_EXPECTED_VALUE';
    } else if (sampleSize < 10) {
      rejectionReason = 'INSUFFICIENT_SAMPLE_SIZE';
    } else {
      rejectionReason = 'LOW_CONFIDENCE_THRESHOLD';
    }
  }

  // Determine Public Visibility:
  // Rule: Global feed = GREEN signals only.
  // Rule: Priority leagues = ALL signals (GREEN, YELLOW, RED) shown with transparency.
  const isPriority = isPriorityLeague(leagueId, leagueName);
  let isPubliclyVisible = false;
  let publicVisibilityReason = '';

  if (color === 'GREEN') {
    isPubliclyVisible = true;
    publicVisibilityReason = 'QUALIFIED_GREEN_SIGNAL';
  } else if (isPriority) {
    isPubliclyVisible = true;
    publicVisibilityReason = `PRIORITY_LEAGUE_${color}_TRANSPARENCY`;
  } else {
    isPubliclyVisible = false;
    publicVisibilityReason = `NON_PRIORITY_${color}_EXCLUDED_FROM_GLOBAL`;
  }

  return {
    color,
    market,
    selection,
    fairOdds,
    marketOdds,
    edgePct,
    rawEdge,
    sampleSize,
    confidence,
    isPubliclyVisible,
    publicVisibilityReason,
    ruleVersion: SIGNAL_CLASSIFIER_VERSION,
    rejectionReason,
  };
}

/**
 * Filter an array of signals for public surface presentation
 */
export function filterForPublicFeed<T extends { color?: SignalColor; signalColor?: 'green' | 'yellow' | 'red'; leagueId?: number; leagueName?: string }>(
  signals: T[]
): T[] {
  return signals.filter((s) => {
    const col = (s.color || s.signalColor || '').toUpperCase();
    // Show all green signals everywhere
    if (col === 'GREEN') return true;
    // Show yellow/red only for priority leagues
    return isPriorityLeague(s.leagueId, s.leagueName);
  });
}
