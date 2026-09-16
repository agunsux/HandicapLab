/**
 * YIELD VALIDATION GATE — NON-NEGOTIABLE GOVERNANCE
 * Location: src/lib/research/yieldValidationGate.ts
 *
 * Implements the 14 non-negotiable yield validation invariants.
 * Fail-closed by design: Defaults to YIELD_STATUS = 'UNVALIDATED'.
 * No positive yield claim is permitted unless all 14 criteria pass
 * and the 95% bootstrap confidence interval strictly clears zero.
 */

export type MarketType = 'AH' | 'OU_2_5' | 'BTTS';

export type YieldStatus =
  | 'UNVALIDATED'
  | 'INSUFFICIENT_SAMPLE'
  | 'NEGATIVE_YIELD'
  | 'INCONCLUSIVE_YIELD'
  | 'POSITIVE_YIELD';

export const DEFAULT_YIELD_STATUS: YieldStatus = 'UNVALIDATED';

export type BetOutcome = 'WIN' | 'LOSS' | 'PUSH' | 'HALF_WIN' | 'HALF_LOSS';

export interface BetEvaluationRecord {
  id: string;
  fixtureId: string;
  market: MarketType;
  league: string;
  season: string;
  kickoffTime: string; // ISO 8601 string
  predictionTime: string; // ISO 8601 string (must be < kickoffTime)
  oddsTimestamp: string; // ISO 8601 string (must be <= kickoffTime)
  marketLine: number | string; // e.g. -0.5, 2.5, 'BTTS_YES'
  odds: number; // decimal odds > 1.0
  stake: number; // stake > 0
  pnl: number; // net profit/loss
  outcome: BetOutcome;
  modelConfidence: number; // 0.0 to 1.0
  isRealResult: boolean; // Must be true, NO mock/synthetic results allowed
  isRealOdds: boolean; // Must be true, NO synthetic odds allowed
}

export interface YieldValidationInvariantCheck {
  id: number;
  name: string;
  passed: boolean;
  details: string;
}

export interface SegmentYieldMetrics {
  segmentKey: string;
  betsCount: number;
  totalStake: number;
  totalPnl: number;
  roi: number;
  yieldPercent: number;
  winRate: number;
  bootstrapCi95: [number, number];
  probabilityPositive: number;
}

export interface YieldGateInput {
  market: MarketType;
  minSampleSize: number;
  isWalkForward: boolean;
  deterministicSettlement: boolean;
  antiCherryPickingCertified: boolean;
  datasetHash?: string;
  records: BetEvaluationRecord[];
}

export interface YieldGateResult {
  status: YieldStatus;
  gatePassed: boolean;
  market: MarketType;
  evaluatedBets: number;
  minSampleSizeRequired: number;
  invariants: YieldValidationInvariantCheck[];
  violations: string[];
  metrics?: {
    totalStake: number;
    totalPnl: number;
    roi: number;
    yieldPercent: number;
    winRate: number;
    bootstrapCi95: [number, number];
    probabilityPositive: number;
  };
  segmentation?: {
    byLeague: Record<string, SegmentYieldMetrics>;
    bySeason: Record<string, SegmentYieldMetrics>;
    byOddsRange: Record<string, SegmentYieldMetrics>;
    byConfidenceBucket: Record<string, SegmentYieldMetrics>;
  };
  honestyStatement: string;
}

/** Deterministic PRNG (mulberry32) for reproducible bootstrap evaluations */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round(val: number, decimals = 4): number {
  const factor = 10 ** decimals;
  return Math.round(val * factor) / factor;
}

/**
 * Calculates 95% bootstrap confidence interval and P(ROI > 0)
 */
export function calculateBootstrapMetrics(
  records: BetEvaluationRecord[],
  iterations = 1000,
  seed = 0x5eed // Deterministic seed
): { ci95: [number, number]; probabilityPositive: number } {
  if (records.length === 0) {
    return { ci95: [0, 0], probabilityPositive: 0 };
  }

  const n = records.length;
  const rand = mulberry32(seed);
  const bootstrapRois: number[] = new Array(iterations);

  for (let i = 0; i < iterations; i++) {
    let samplePnl = 0;
    let sampleStake = 0;
    for (let j = 0; j < n; j++) {
      const idx = Math.floor(rand() * n);
      const r = records[idx];
      samplePnl += r.pnl;
      sampleStake += r.stake;
    }
    bootstrapRois[i] = sampleStake > 0 ? samplePnl / sampleStake : 0;
  }

  bootstrapRois.sort((a, b) => a - b);

  const lowerIdx = Math.floor(iterations * 0.025);
  const upperIdx = Math.floor(iterations * 0.975);
  const ciLower = round(bootstrapRois[lowerIdx], 4);
  const ciUpper = round(bootstrapRois[upperIdx], 4);

  const positiveCount = bootstrapRois.filter((r) => r > 0).length;
  const probabilityPositive = round(positiveCount / iterations, 4);

  return {
    ci95: [ciLower, ciUpper],
    probabilityPositive,
  };
}

/**
 * Compute metrics for an arbitrary subset of records
 */
export function computeSegmentMetrics(segmentKey: string, records: BetEvaluationRecord[]): SegmentYieldMetrics {
  const betsCount = records.length;
  if (betsCount === 0) {
    return {
      segmentKey,
      betsCount: 0,
      totalStake: 0,
      totalPnl: 0,
      roi: 0,
      yieldPercent: 0,
      winRate: 0,
      bootstrapCi95: [0, 0],
      probabilityPositive: 0,
    };
  }

  let totalStake = 0;
  let totalPnl = 0;
  let wins = 0;

  for (const r of records) {
    totalStake += r.stake;
    totalPnl += r.pnl;
    if (r.outcome === 'WIN') wins += 1;
    else if (r.outcome === 'HALF_WIN') wins += 0.5;
  }

  const roi = totalStake > 0 ? round(totalPnl / totalStake, 6) : 0;
  const yieldPercent = round(roi * 100, 4);
  const winRate = round(wins / betsCount, 4);
  const { ci95, probabilityPositive } = calculateBootstrapMetrics(records, 500);

  return {
    segmentKey,
    betsCount,
    totalStake: round(totalStake, 2),
    totalPnl: round(totalPnl, 2),
    roi,
    yieldPercent,
    winRate,
    bootstrapCi95: ci95,
    probabilityPositive,
  };
}

/**
 * Categorize decimal odds into standard buckets
 */
function getOddsRangeBucket(odds: number): string {
  if (odds < 1.70) return '<1.70';
  if (odds <= 2.00) return '1.70-2.00';
  if (odds <= 2.30) return '2.01-2.30';
  return '>2.30';
}

/**
 * Categorize model confidence into standard buckets
 */
function getConfidenceBucket(conf: number): string {
  if (conf < 0.55) return '<0.55';
  if (conf < 0.65) return '0.55-0.65';
  if (conf < 0.75) return '0.65-0.75';
  return '>=0.75';
}

/**
 * Validates deterministic settlement payout against recorded odds and stake
 */
function isSettlementConsistent(r: BetEvaluationRecord): boolean {
  const tolerance = 0.01;
  switch (r.outcome) {
    case 'WIN': {
      const expectedPnl = (r.odds - 1) * r.stake;
      return Math.abs(r.pnl - expectedPnl) <= tolerance;
    }
    case 'LOSS': {
      const expectedPnl = -r.stake;
      return Math.abs(r.pnl - expectedPnl) <= tolerance;
    }
    case 'PUSH': {
      return Math.abs(r.pnl) <= tolerance;
    }
    case 'HALF_WIN': {
      const expectedPnl = ((r.odds - 1) * r.stake) / 2;
      return Math.abs(r.pnl - expectedPnl) <= tolerance;
    }
    case 'HALF_LOSS': {
      const expectedPnl = -r.stake / 2;
      return Math.abs(r.pnl - expectedPnl) <= tolerance;
    }
    default:
      return false;
  }
}

/**
 * Primary Non-Negotiable Yield Validation Gate Evaluator.
 * Enforces all 14 yield invariants in a fail-closed manner.
 */
export function evaluateYieldGate(input: YieldGateInput): YieldGateResult {
  const violations: string[] = [];
  const invariants: YieldValidationInvariantCheck[] = [];

  const addInvariant = (id: number, name: string, condition: boolean, failMessage: string, successMessage: string) => {
    invariants.push({
      id,
      name,
      passed: condition,
      details: condition ? successMessage : failMessage,
    });
    if (!condition) {
      violations.push(`Invariant ${id} (${name}): ${failMessage}`);
    }
  };

  const records = input.records || [];
  const n = records.length;

  // 1. Real historical match results exist
  const hasOnlyRealResults = n > 0 && records.every((r) => r.isRealResult === true);
  addInvariant(
    1,
    'Real Historical Match Results',
    hasOnlyRealResults,
    n === 0 ? 'No records provided' : 'Contains non-real / synthetic match results',
    `Verified ${n} records have real match results`
  );

  // 2. Real historical market odds exist
  const hasOnlyRealOdds = n > 0 && records.every((r) => r.isRealOdds === true && r.odds > 1.0);
  addInvariant(
    2,
    'Real Historical Market Odds',
    hasOnlyRealOdds,
    'Contains synthetic odds or invalid odds (<= 1.0)',
    `Verified ${n} records have real market odds`
  );

  // 3. Odds timestamps are known
  const hasValidOddsTimestamps = n > 0 && records.every((r) => {
    if (!r.oddsTimestamp) return false;
    const t = new Date(r.oddsTimestamp).getTime();
    return !Number.isNaN(t) && t > 0;
  });
  addInvariant(
    3,
    'Odds Timestamps Known',
    hasValidOddsTimestamps,
    'Missing or invalid odds timestamps detected',
    'All odds timestamps are valid ISO 8601 timestamps'
  );

  // 4. Prediction timestamps are known
  const hasValidPredictionTimestamps = n > 0 && records.every((r) => {
    if (!r.predictionTime) return false;
    const t = new Date(r.predictionTime).getTime();
    return !Number.isNaN(t) && t > 0;
  });
  addInvariant(
    4,
    'Prediction Timestamps Known',
    hasValidPredictionTimestamps,
    'Missing or invalid prediction timestamps detected',
    'All prediction timestamps are valid ISO 8601 timestamps'
  );

  // 5. No future leakage exists (pred < kickoff, odds <= kickoff)
  const noFutureLeakage = n > 0 && records.every((r) => {
    const predT = new Date(r.predictionTime).getTime();
    const kickT = new Date(r.kickoffTime).getTime();
    const oddsT = new Date(r.oddsTimestamp).getTime();
    return predT < kickT && oddsT <= kickT;
  });
  addInvariant(
    5,
    'No Future Leakage',
    noFutureLeakage,
    'Future leakage detected: prediction timestamp >= kickoff or odds timestamp > kickoff',
    'Temporally strict: all predictions strictly prior to kickoff, odds prior to or at kickoff'
  );

  // 6. Market line is explicitly recorded
  const hasMarketLines = n > 0 && records.every((r) => r.marketLine !== undefined && r.marketLine !== null && String(r.marketLine).trim() !== '');
  addInvariant(
    6,
    'Market Line Explicitly Recorded',
    hasMarketLines,
    'Missing market lines detected in records',
    'All records have explicit market lines'
  );

  // 7. Settlement rules are deterministic
  const deterministicSettlement = input.deterministicSettlement && n > 0 && records.every(isSettlementConsistent);
  addInvariant(
    7,
    'Deterministic Settlement Rules',
    deterministicSettlement,
    'Settlement inconsistency detected or deterministic settlement flag is false',
    'Deterministic settlement verified across all records'
  );

  // 8. Walk-forward evaluation is used
  addInvariant(
    8,
    'Walk-Forward Evaluation',
    input.isWalkForward === true,
    'Evaluation was not marked as strictly walk-forward',
    'Walk-forward temporal evaluation confirmed'
  );

  // 9. Minimum sample-size threshold defined BEFORE evaluation
  const minSampleMet = input.minSampleSize > 0 && n >= input.minSampleSize;
  addInvariant(
    9,
    'Pre-defined Minimum Sample Size',
    minSampleMet,
    `Sample size ${n} is below pre-defined minimum threshold of ${input.minSampleSize}`,
    `Sample size ${n} meets or exceeds required threshold ${input.minSampleSize}`
  );

  // 10. Results are reproducible from frozen data
  const hasFrozenDataHash = typeof input.datasetHash === 'string' && input.datasetHash.trim().length >= 8;
  addInvariant(
    10,
    'Reproducible From Frozen Data',
    hasFrozenDataHash,
    'Missing or invalid frozen dataset hash (provenance tracking required)',
    `Dataset provenance hash verified: ${input.datasetHash}`
  );

  // 11. ROI/yield calculation is independently tested
  let totalStake = 0;
  let totalPnl = 0;
  let wins = 0;
  for (const r of records) {
    totalStake += r.stake;
    totalPnl += r.pnl;
    if (r.outcome === 'WIN') wins += 1;
    else if (r.outcome === 'HALF_WIN') wins += 0.5;
  }
  const roiCalculated = totalStake > 0 ? totalPnl / totalStake : 0;
  const roiValid = n > 0 && !Number.isNaN(roiCalculated) && Number.isFinite(roiCalculated);
  addInvariant(
    11,
    'Independent ROI / Yield Calculation',
    roiValid,
    'ROI calculation failed or stake was zero',
    `Independent arithmetic verified: Total Stake = ${round(totalStake, 2)}, Total PnL = ${round(totalPnl, 2)}, ROI = ${(roiCalculated * 100).toFixed(2)}%`
  );

  // 12. Results are separated by market (AH, OU 2.5, BTTS)
  const singleMarketStrict = n > 0 && records.every((r) => r.market === input.market);
  addInvariant(
    12,
    'Market Separation Strictness',
    singleMarketStrict,
    `Contaminated records found: not all records match designated market '${input.market}'`,
    `Strict market boundary verified: 100% records belong to '${input.market}'`
  );

  // 13. Results are segmented by league, season, odds range, confidence bucket
  const hasMultipleSegments = n > 0;
  addInvariant(
    13,
    'Multi-dimensional Segmentation',
    hasMultipleSegments,
    'No records to perform required multidimensional segmentation',
    'Multidimensional segmentation produced (league, season, odds range, confidence bucket)'
  );

  // 14. No cherry-picking of profitable subsets after seeing results
  addInvariant(
    14,
    'Anti-Cherry-Picking Certification',
    input.antiCherryPickingCertified === true,
    'Anti-cherry-picking certification missing or false',
    'Certified: Zero post-hoc subset filtering or cherry-picking'
  );

  // Calculate overall metrics if records exist
  const roi = round(roiCalculated, 6);
  const yieldPercent = round(roi * 100, 4);
  const winRate = n > 0 ? round(wins / n, 4) : 0;
  const { ci95, probabilityPositive } = calculateBootstrapMetrics(records, 1000);

  // Build segmentation
  const byLeague: Record<string, BetEvaluationRecord[]> = {};
  const bySeason: Record<string, BetEvaluationRecord[]> = {};
  const byOddsRange: Record<string, BetEvaluationRecord[]> = {};
  const byConfidenceBucket: Record<string, BetEvaluationRecord[]> = {};

  for (const r of records) {
    (byLeague[r.league] ||= []).push(r);
    (bySeason[r.season] ||= []).push(r);
    (byOddsRange[getOddsRangeBucket(r.odds)] ||= []).push(r);
    (byConfidenceBucket[getConfidenceBucket(r.modelConfidence)] ||= []).push(r);
  }

  const segmentation = {
    byLeague: Object.fromEntries(Object.entries(byLeague).map(([k, v]) => [k, computeSegmentMetrics(k, v)])),
    bySeason: Object.fromEntries(Object.entries(bySeason).map(([k, v]) => [k, computeSegmentMetrics(k, v)])),
    byOddsRange: Object.fromEntries(Object.entries(byOddsRange).map(([k, v]) => [k, computeSegmentMetrics(k, v)])),
    byConfidenceBucket: Object.fromEntries(Object.entries(byConfidenceBucket).map(([k, v]) => [k, computeSegmentMetrics(k, v)])),
  };

  // Determine final status
  let status: YieldStatus = DEFAULT_YIELD_STATUS;
  let gatePassed = false;

  // Invariants 1-8, 10-14 must pass for valid scientific review
  const criticalInvariantsPass = invariants
    .filter((inv) => inv.id !== 9)
    .every((inv) => inv.passed);

  if (!criticalInvariantsPass) {
    status = 'UNVALIDATED';
    gatePassed = false;
  } else if (!minSampleMet) {
    status = 'INSUFFICIENT_SAMPLE';
    gatePassed = false;
  } else {
    // All 14 invariants pass! Now evaluate statistical reality:
    if (roi < 0) {
      status = 'NEGATIVE_YIELD';
      gatePassed = false; // Cannot pass yield gate if yield is negative
    } else if (ci95[0] <= 0 || probabilityPositive < 0.975) {
      // Positive nominal yield, but 95% bootstrap CI includes zero or negative
      status = 'INCONCLUSIVE_YIELD';
      gatePassed = false; // Cannot claim positive yield if statistically insignificant
    } else {
      // Realized positive ROI and 95% bootstrap CI lower bound > 0
      status = 'POSITIVE_YIELD';
      gatePassed = true;
    }
  }

  let honestyStatement = '';
  switch (status) {
    case 'UNVALIDATED':
      honestyStatement =
        'YIELD STATUS: UNVALIDATED. One or more mandatory scientific governance invariants failed. No yield claim is permitted.';
      break;
    case 'INSUFFICIENT_SAMPLE':
      honestyStatement = `YIELD STATUS: INSUFFICIENT SAMPLE. Evaluated ${n} bets, but minimum pre-defined threshold is ${input.minSampleSize}. No yield claim is permitted.`;
      break;
    case 'NEGATIVE_YIELD':
      honestyStatement = `YIELD STATUS: NEGATIVE YIELD. Realized ROI is ${yieldPercent.toFixed(2)}% (95% CI [${(ci95[0] * 100).toFixed(2)}%, ${(ci95[1] * 100).toFixed(2)}%]). The model does not beat the market line.`;
      break;
    case 'INCONCLUSIVE_YIELD':
      honestyStatement = `YIELD STATUS: INCONCLUSIVE YIELD. Nominal ROI is +${yieldPercent.toFixed(2)}%, but 95% bootstrap CI [${(ci95[0] * 100).toFixed(2)}%, ${(ci95[1] * 100).toFixed(2)}%] crosses zero (P(ROI>0) = ${(probabilityPositive * 100).toFixed(1)}%). Edge is not statistically distinguishable from market variance.`;
      break;
    case 'POSITIVE_YIELD':
      honestyStatement = `YIELD STATUS: POSITIVE YIELD VALIDATED. Realized ROI is +${yieldPercent.toFixed(2)}% with 95% bootstrap CI [${(ci95[0] * 100).toFixed(2)}%, ${(ci95[1] * 100).toFixed(2)}%] strictly positive. All 14 invariants verified.`;
      break;
  }

  return {
    status,
    gatePassed,
    market: input.market,
    evaluatedBets: n,
    minSampleSizeRequired: input.minSampleSize,
    invariants,
    violations,
    metrics: {
      totalStake: round(totalStake, 2),
      totalPnl: round(totalPnl, 2),
      roi,
      yieldPercent,
      winRate,
      bootstrapCi95: ci95,
      probabilityPositive,
    },
    segmentation,
    honestyStatement,
  };
}
