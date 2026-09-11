import type { AhSide } from '../ah-yield/ahTypes';
import { isQuarterHandicap } from '../ah-yield/ahSettlement';
import type {
  AblationModelId,
  EarlyVsClosingModelId,
  FeatureGroup,
  InfoBetPrediction,
  InfoMatch,
  MetricSummaryStats,
  MovementPattern,
} from './infoTypes';
import { ABLATION_GROUPS_MAP, computeStats } from './infoModels';
import { runInfoWalkForward, type WalkForwardRunResult } from './infoWalkForward';

export interface LineMovementPatternResult {
  pattern: MovementPattern;
  n: number;
  wins: number;
  pushes: number;
  losses: number;
  hitRate: number;
  roi: number;
  ci95: [number, number];
  brier: number;
  avgClv: number | null;
}

export interface ClvDecompositionResult {
  totalEarlyBets: number;
  betsWithClosingQuote: number;
  avgClv: number;
  positiveClvPct: number;
  realizedRoiAll: number;
  realizedRoiPositiveClv: number;
  realizedRoiNegativeClv: number;
  clvToRoiPearsonCorr: number;
  conclusion: string;
}

export interface IncrementalTestRow {
  testedAddition: string;
  baselineModel: string;
  augmentedModel: string;
  deltaBrier: number;
  deltaBrierCi95: [number, number];
  zScore: number;
  pValue: number;
  deltaLogLoss: number;
  deltaEce: number;
  deltaRoi: number;
  isStatisticallySignificant: boolean;
}

export interface LeagueStabilityRow {
  leagueId: string;
  leagueName: string;
  n: number;
  modelBrier: number;
  marketBrier: number;
  deltaBrier: number;
  evPositiveBets: number;
  evPositiveRoi: number;
  ci95: [number, number];
  signalDirection: 'OUTPERFORM' | 'UNDERPERFORM' | 'NEUTRAL';
}

export interface RobustnessSliceRow {
  sliceCategory: string;
  sliceValue: string;
  n: number;
  hitRate: number;
  roi: number;
  ci95: [number, number];
  clv: number | null;
}

export interface MultipleTestingAuditRow {
  hypothesisId: string;
  description: string;
  rawPValue: number;
  bonferroniThreshold: number;
  fdrQValue: number;
  isFdrSignificant: boolean;
}

export function runAblationMatrix(matches: InfoMatch[]): {
  runResult: WalkForwardRunResult;
  ablationStats: Record<AblationModelId, MetricSummaryStats>;
} {
  const modelDefs: { id: AblationModelId; groups: FeatureGroup[]; snapshot: 'early' }[] = [
    { id: 'M0', groups: ABLATION_GROUPS_MAP.M0, snapshot: 'early' },
    { id: 'M1', groups: ABLATION_GROUPS_MAP.M1, snapshot: 'early' },
    { id: 'M2', groups: ABLATION_GROUPS_MAP.M2, snapshot: 'early' },
    { id: 'M3', groups: ABLATION_GROUPS_MAP.M3, snapshot: 'early' },
    { id: 'M4', groups: ABLATION_GROUPS_MAP.M4, snapshot: 'early' },
    { id: 'M5', groups: ABLATION_GROUPS_MAP.M5, snapshot: 'early' },
    { id: 'M6', groups: ABLATION_GROUPS_MAP.M6, snapshot: 'early' },
    { id: 'M7', groups: ABLATION_GROUPS_MAP.M7, snapshot: 'early' },
    { id: 'F0', groups: ABLATION_GROUPS_MAP.F0, snapshot: 'early' },
  ];

  const runResult = runInfoWalkForward(matches, modelDefs, 'early', 2);
  const ablationStats: Record<AblationModelId, MetricSummaryStats> = runResult.statsByModel as any;

  return { runResult, ablationStats };
}

export function runEarlyVsClosingComparison(matches: InfoMatch[]): {
  earlyMarketStats: MetricSummaryStats;
  closingMarketStats: MetricSummaryStats;
  earlyPlusFootballStats: MetricSummaryStats;
  earlyPlusFootballPlusMovementStats: MetricSummaryStats;
  footballOnlyStats: MetricSummaryStats;
} {
  // 1. Early market baseline
  const earlyDefs = [
    { id: 'C_early_plus_football', groups: ABLATION_GROUPS_MAP.M7, snapshot: 'early' as const },
    { id: 'D_early_plus_football_plus_movement', groups: [...ABLATION_GROUPS_MAP.M7, 'movement' as const], snapshot: 'movement_bridge' as const },
    { id: 'E_football_only', groups: ABLATION_GROUPS_MAP.F0, snapshot: 'early' as const },
  ];
  const earlyRun = runInfoWalkForward(matches, earlyDefs, 'early', 2);

  // 2. Closing market baseline
  const closingRun = runInfoWalkForward(
    matches,
    [{ id: 'closing_model', groups: ABLATION_GROUPS_MAP.M7, snapshot: 'closing' as const }],
    'closing',
    2
  );

  return {
    earlyMarketStats: earlyRun.baselineStats,
    closingMarketStats: closingRun.baselineStats,
    earlyPlusFootballStats: earlyRun.statsByModel['C_early_plus_football'],
    earlyPlusFootballPlusMovementStats: earlyRun.statsByModel['D_early_plus_football_plus_movement'],
    footballOnlyStats: earlyRun.statsByModel['E_football_only'],
  };
}

export function runLineMovementStudy(matches: InfoMatch[], predictions: InfoBetPrediction[]): LineMovementPatternResult[] {
  const patterns: MovementPattern[] = [
    'LINE_MOVES_TOWARD_FAVORITE',
    'LINE_MOVES_TOWARD_UNDERDOG',
    'PRICE_COMPRESSION',
    'PRICE_EXPANSION',
    'LINE_UNCHANGED_PRICE_CHANGES',
    'PRICE_UNCHANGED_LINE_CHANGES',
    'NO_MOVEMENT',
  ];

  const out: LineMovementPatternResult[] = [];

  for (const pat of patterns) {
    const subset = predictions.filter((p) => p.movementPattern === pat);
    const n = subset.length;
    if (n === 0) {
      out.push({
        pattern: pat,
        n: 0,
        wins: 0,
        pushes: 0,
        losses: 0,
        hitRate: 0,
        roi: 0,
        ci95: [0, 0],
        brier: 0,
        avgClv: null,
      });
      continue;
    }

    let profit = 0;
    let wins = 0;
    let pushes = 0;
    let losses = 0;
    let brierSum = 0;
    let clvSum = 0;
    let clvCount = 0;

    for (const p of subset) {
      profit += p.pnl;
      if (p.y === 1) wins++;
      else if (p.y === 0) losses++;
      else pushes++;

      if (p.y !== null) {
        brierSum += (p.modelBinaryProbability - p.y) ** 2;
      }

      if (p.clv !== null) {
        clvSum += p.clv;
        clvCount++;
      }
    }

    const decided = wins + losses;
    const hitRate = decided > 0 ? (wins / decided) * 100 : 0;
    const roi = (profit / n) * 100;
    const se = 100 / Math.sqrt(n);
    const ci95: [number, number] = [Number((roi - 1.96 * se).toFixed(2)), Number((roi + 1.96 * se).toFixed(2))];
    const brier = decided > 0 ? brierSum / decided : 0;
    const avgClv = clvCount > 0 ? Number(((clvSum / clvCount) * 100).toFixed(2)) : null;

    out.push({
      pattern: pat,
      n,
      wins,
      pushes,
      losses,
      hitRate: Number(hitRate.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      ci95,
      brier: Number(brier.toFixed(4)),
      avgClv,
    });
  }

  return out;
}

export function runClvDecompositionStudy(predictions: InfoBetPrediction[]): ClvDecompositionResult {
  const withClv = predictions.filter((p) => p.clv !== null);
  const total = predictions.length;
  const nClv = withClv.length;

  if (nClv === 0) {
    return {
      totalEarlyBets: total,
      betsWithClosingQuote: 0,
      avgClv: 0,
      positiveClvPct: 0,
      realizedRoiAll: 0,
      realizedRoiPositiveClv: 0,
      realizedRoiNegativeClv: 0,
      clvToRoiPearsonCorr: 0,
      conclusion: 'No matched opening and closing AH quotes available for CLV decomposition.',
    };
  }

  let clvSum = 0;
  let posClvCount = 0;
  let profitAll = 0;
  let profitPosClv = 0;
  let profitNegClv = 0;
  let nPos = 0;
  let nNeg = 0;

  const clvArr: number[] = [];
  const roiArr: number[] = [];

  for (const p of withClv) {
    const clv = p.clv!;
    clvSum += clv;
    if (clv > 0) posClvCount++;

    profitAll += p.pnl;

    if (clv > 0) {
      profitPosClv += p.pnl;
      nPos++;
    } else {
      profitNegClv += p.pnl;
      nNeg++;
    }

    clvArr.push(clv);
    roiArr.push(p.pnl);
  }

  const avgClv = (clvSum / nClv) * 100;
  const positiveClvPct = (posClvCount / nClv) * 100;
  const realizedRoiAll = (profitAll / nClv) * 100;
  const realizedRoiPositiveClv = nPos > 0 ? (profitPosClv / nPos) * 100 : 0;
  const realizedRoiNegativeClv = nNeg > 0 ? (profitNegClv / nNeg) * 100 : 0;

  // Pearson correlation between CLV and Realized Bet Return
  const meanClv = clvArr.reduce((a, b) => a + b, 0) / nClv;
  const meanRoi = roiArr.reduce((a, b) => a + b, 0) / nClv;
  let num = 0, denClv = 0, denRoi = 0;
  for (let i = 0; i < nClv; i++) {
    const dC = clvArr[i] - meanClv;
    const dR = roiArr[i] - meanRoi;
    num += dC * dR;
    denClv += dC * dC;
    denRoi += dR * dR;
  }
  const clvToRoiPearsonCorr = denClv > 0 && denRoi > 0 ? num / Math.sqrt(denClv * denRoi) : 0;

  let conclusion = '';
  if (avgClv > 0 && realizedRoiAll <= 0) {
    conclusion = 'Positive mean CLV does not produce positive realized ROI due to transaction friction and uncaptured variance.';
  } else if (avgClv > 0 && realizedRoiAll > 0) {
    conclusion = 'Positive mean CLV is accompanied by positive realized ROI in the evaluated sample.';
  } else {
    conclusion = 'Negative mean CLV corresponds to negative realized ROI, confirming market convergence toward closing efficiency.';
  }

  return {
    totalEarlyBets: total,
    betsWithClosingQuote: nClv,
    avgClv: Number(avgClv.toFixed(2)),
    positiveClvPct: Number(positiveClvPct.toFixed(2)),
    realizedRoiAll: Number(realizedRoiAll.toFixed(2)),
    realizedRoiPositiveClv: Number(realizedRoiPositiveClv.toFixed(2)),
    realizedRoiNegativeClv: Number(realizedRoiNegativeClv.toFixed(2)),
    clvToRoiPearsonCorr: Number(clvToRoiPearsonCorr.toFixed(4)),
    conclusion,
  };
}

export function runIncrementalInformationTests(
  ablationStats: Record<AblationModelId, MetricSummaryStats>,
  earlyBridgeStats?: MetricSummaryStats
): IncrementalTestRow[] {
  const m0 = ablationStats.M0;

  const comparisons = [
    { addition: 'Team Form (last 3/5/10, venue, PPM)', base: 'M0 (Market)', aug: 'M1 (Market + Form)', augStat: ablationStats.M1 },
    { addition: 'Team Strength (Elo, rolling, opponent-adjusted)', base: 'M0 (Market)', aug: 'M2 (Market + Strength)', augStat: ablationStats.M2 },
    { addition: 'Match Context (Rest, Home Advantage, Density)', base: 'M0 (Market)', aug: 'M3 (Market + Context)', augStat: ablationStats.M3 },
    { addition: 'Goal Environment (Scoring rates, Over/Under)', base: 'M0 (Market)', aug: 'M4 (Market + Goal Env)', augStat: ablationStats.M4 },
    { addition: 'Form + Strength combined', base: 'M0 (Market)', aug: 'M5 (Market + Form + Strength)', augStat: ablationStats.M5 },
    { addition: 'All Football Features (Form + Strength + Context + Goal)', base: 'M0 (Market)', aug: 'M7 (Market + All Football)', augStat: ablationStats.M7 },
  ];

  if (earlyBridgeStats) {
    comparisons.push({
      addition: 'Line & Price Movement (Early -> Closing bridge)',
      base: 'M7 (Early + All Football)',
      aug: 'M7 + Movement',
      augStat: earlyBridgeStats,
    });
  }

  return comparisons.map((c) => {
    const deltaBrier = c.augStat.brier - m0.brier;
    const se = Math.abs(c.augStat.deltaBrierVsBaseline) / Math.max(1, Math.abs(c.augStat.deltaBrierZ || 1));
    const zScore = se > 0 ? -deltaBrier / se : 0; // positive z if deltaBrier is negative (improvement)
    const pVal = c.augStat.deltaBrierPValue;
    const deltaLogLoss = c.augStat.logLoss - m0.logLoss;
    const deltaEce = c.augStat.ece - m0.ece;
    const deltaRoi = c.augStat.evPositiveRoi - m0.evPositiveRoi;

    return {
      testedAddition: c.addition,
      baselineModel: c.base,
      augmentedModel: c.aug,
      deltaBrier: Number(deltaBrier.toFixed(5)),
      deltaBrierCi95: [Number((deltaBrier - 1.96 * se).toFixed(5)), Number((deltaBrier + 1.96 * se).toFixed(5))],
      zScore: Number(zScore.toFixed(2)),
      pValue: Number(pVal.toFixed(4)),
      deltaLogLoss: Number(deltaLogLoss.toFixed(5)),
      deltaEce: Number(deltaEce.toFixed(5)),
      deltaRoi: Number(deltaRoi.toFixed(2)),
      isStatisticallySignificant: pVal < 0.05 && deltaBrier < 0,
    };
  });
}

export function runLeagueStabilityStudy(matches: InfoMatch[]): LeagueStabilityRow[] {
  const leagueNames: Record<string, string> = {
    'ENG-PL': 'Premier League',
    'ESP-LALIGA': 'La Liga',
    'DEU-BUNDESLIGA': 'Bundesliga',
    'ITA-SERIEA': 'Serie A',
    'FRA-LIGUE1': 'Ligue 1',
  };

  const rows: LeagueStabilityRow[] = [];
  const leagues = Array.from(new Set(matches.map((m) => m.leagueId))).sort();

  for (const lid of leagues) {
    const lMatches = matches.filter((m) => m.leagueId === lid);
    if (lMatches.length < 50) continue;

    // Run walk-forward if >= 2 seasons, otherwise 1 season split
    const seasons = Array.from(new Set(lMatches.map((m) => m.season))).sort();
    if (seasons.length < 2) continue;

    const run = runInfoWalkForward(
      lMatches,
      [{ id: 'M7_league', groups: ABLATION_GROUPS_MAP.M7, snapshot: 'early' }],
      'early',
      1
    );

    const mStat = run.statsByModel['M7_league'];
    const bStat = run.baselineStats;
    const deltaBrier = mStat.brier - bStat.brier;
    const dir: 'OUTPERFORM' | 'UNDERPERFORM' | 'NEUTRAL' =
      deltaBrier < -0.001 ? 'OUTPERFORM' : deltaBrier > 0.001 ? 'UNDERPERFORM' : 'NEUTRAL';

    rows.push({
      leagueId: lid,
      leagueName: leagueNames[lid] || lid,
      n: mStat.bets,
      modelBrier: mStat.brier,
      marketBrier: bStat.brier,
      deltaBrier: Number(deltaBrier.toFixed(4)),
      evPositiveBets: mStat.evPositiveBets,
      evPositiveRoi: mStat.evPositiveRoi,
      ci95: mStat.evPositiveCi95,
      signalDirection: dir,
    });
  }

  return rows;
}

export function runRobustnessSlices(predictions: InfoBetPrediction[]): RobustnessSliceRow[] {
  const rows: RobustnessSliceRow[] = [];

  const addSlice = (cat: string, val: string, subset: InfoBetPrediction[]) => {
    const n = subset.length;
    if (n === 0) return;
    let profit = 0;
    let wins = 0;
    let clvSum = 0;
    let clvCount = 0;

    for (const p of subset) {
      profit += p.pnl;
      if (p.y === 1) wins++;
      if (p.clv !== null) {
        clvSum += p.clv;
        clvCount++;
      }
    }
    const decided = subset.filter((p) => p.y !== null).length;
    const hitRate = decided > 0 ? (wins / decided) * 100 : 0;
    const roi = (profit / n) * 100;
    const se = 100 / Math.sqrt(n);
    const ci95: [number, number] = [Number((roi - 1.96 * se).toFixed(2)), Number((roi + 1.96 * se).toFixed(2))];
    const avgClv = clvCount > 0 ? Number(((clvSum / clvCount) * 100).toFixed(2)) : null;

    rows.push({
      sliceCategory: cat,
      sliceValue: val,
      n,
      hitRate: Number(hitRate.toFixed(1)),
      roi: Number(roi.toFixed(2)),
      ci95,
      clv: avgClv,
    });
  };

  // 1. Season Slices
  const seasons = Array.from(new Set(predictions.map((p) => p.season))).sort();
  for (const s of seasons) {
    addSlice('Season', s, predictions.filter((p) => p.season === s));
  }

  // 2. Favorite / Underdog
  addSlice('Role', 'Favorite', predictions.filter((p) => p.favoriteStatus === 'favorite'));
  addSlice('Role', 'Underdog', predictions.filter((p) => p.favoriteStatus === 'underdog'));
  addSlice('Role', 'Market Neutral (AH 0)', predictions.filter((p) => p.favoriteStatus === 'market_neutral'));

  // 3. AH Line Buckets
  addSlice('Line Type', 'Zero Line (0.0)', predictions.filter((p) => Math.abs(p.line) === 0));
  addSlice('Line Type', 'Quarter Lines (±0.25, ±0.75, ±1.25)', predictions.filter((p) => isQuarterHandicap(p.line)));
  addSlice('Line Type', 'Half Lines (±0.5, ±1.5)', predictions.filter((p) => Math.abs(p.line) % 1 === 0.5));
  addSlice('Line Type', 'Integer Lines (±1.0, ±2.0)', predictions.filter((p) => Math.abs(p.line) > 0 && Math.abs(p.line) % 1 === 0));

  // 4. Odds Ranges
  addSlice('Odds Range', '< 1.80', predictions.filter((p) => p.odds < 1.80));
  addSlice('Odds Range', '1.80 - 2.05', predictions.filter((p) => p.odds >= 1.80 && p.odds <= 2.05));
  addSlice('Odds Range', '> 2.05', predictions.filter((p) => p.odds > 2.05));

  // 5. Minimum EV Thresholds
  for (const t of [0, 0.01, 0.02, 0.03, 0.05, 0.07, 0.1]) {
    addSlice('EV Threshold', `EV >= ${(t * 100).toFixed(0)}%`, predictions.filter((p) => p.modelEv >= t));
  }

  return rows;
}

export function runMultipleTestingAudit(tests: { id: string; desc: string; pValue: number }[]): MultipleTestingAuditRow[] {
  const m = tests.length;
  const sorted = [...tests].sort((a, b) => a.pValue - b.pValue);
  const bonferroniThreshold = 0.05 / Math.max(1, m);

  return sorted.map((t, idx) => {
    const rank = idx + 1;
    const fdrThreshold = (rank / m) * 0.05;
    const qValue = Math.min(1, t.pValue * (m / rank));
    return {
      hypothesisId: t.id,
      description: t.desc,
      rawPValue: Number(t.pValue.toFixed(4)),
      bonferroniThreshold: Number(bonferroniThreshold.toFixed(5)),
      fdrQValue: Number(qValue.toFixed(4)),
      isFdrSignificant: t.pValue <= fdrThreshold,
    };
  });
}
