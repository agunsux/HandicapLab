// Backtest metric computation — mirrors python_engine/engine/metrics.py.
// Computes ROI, win rate, CLV, Brier, Log Loss, drawdown, calibration
// from settled backtest bets. No hardcoded values.

import { SettledBet, Outcome } from './settlement';

export interface SettledPick {
  matchDate: string;
  leagueId: string;
  market: 'ML' | 'AH' | 'OU' | 'BTTS';
  selection: string;
  line: number | null;
  entryOdds: number;
  closingOdds: number | null;
  modelProb: number;
  edgePct: number;
  evPct: number;
  confidence: number;
  result: SettledBet;
  cumulativeProfit: number;
}

function outcomeIsWin(o: Outcome): boolean {
  return o === 'WIN' || o === 'HALF_WIN';
}

export interface BacktestSummary {
  matchesTested: number;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
  avgEvPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
  logLoss: number | null;
  maxDrawdown: number | null;
  avgOdds: number | null;
  stakeUnits: number;
  ci95Low: number | null;
  ci95High: number | null;
}

export interface MarketSummary {
  market: 'ML' | 'AH' | 'OU' | 'BTTS';
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
  avgClvPct: number | null;
  brierScore: number | null;
  avgEdgePct: number | null;
  avgEvPct: number | null;
}

export interface CalibrationBin {
  bucketLabel: string;
  bucketLow: number;
  bucketHigh: number;
  modelProbability: number;
  actualWinRate: number;
  sampleCount: number;
}

export function computeSummary(
  picks: SettledPick[],
  matchesTested: number,
  stakeUnits = 1.0
): BacktestSummary {
  if (picks.length === 0) {
    return {
      matchesTested,
      totalBets: 0,
      winRate: null,
      profitUnits: 0,
      roiPct: null,
      avgEvPct: null,
      avgClvPct: null,
      brierScore: null,
      logLoss: null,
      maxDrawdown: null,
      avgOdds: null,
      stakeUnits,
      ci95Low: null,
      ci95High: null,
    };
  }

  const countable = picks.filter((p) => p.result.outcome !== 'PUSH');
  const wins = picks.filter((p) => outcomeIsWin(p.result.outcome)).length;

  const profitUnits = picks.reduce((a, p) => a + p.result.profitUnits, 0);
  const roi = (profitUnits / (picks.length * stakeUnits)) * 100;

  const avgEv = picks.reduce((a, p) => a + p.evPct, 0) / picks.length;
  const avgOdds = picks.reduce((a, p) => a + p.entryOdds, 0) / picks.length;

  const clvVals = picks
    .filter((p) => p.closingOdds !== null && p.closingOdds! > 0 && p.entryOdds > 0)
    .map((p) => (p.entryOdds / p.closingOdds! - 1) * 100);
  const avgClv = clvVals.length > 0 ? clvVals.reduce((a, b) => a + b, 0) / clvVals.length : null;

  // Brier + Log Loss (excluding PUSH)
  const scored = countable.map((p) => ({
    prob: p.modelProb,
    outcome: outcomeIsWin(p.result.outcome) ? 1 : 0,
  }));
  const brier = scored.length > 0
    ? scored.reduce((a, s) => a + Math.pow(s.prob - s.outcome, 2), 0) / scored.length
    : null;
  const logLoss = scored.length > 0
    ? scored.reduce((a, s) => a - (s.outcome * Math.log(Math.max(1e-10, s.prob)) + (1 - s.outcome) * Math.log(Math.max(1e-10, 1 - s.prob))), 0) / scored.length
    : null;

  // Max drawdown on cumulative P&L (sorted chronologically)
  let cumulative = 0;
  let peak = 0;
  let worst = 0;
  for (const p of picks) {
    cumulative += p.result.profitUnits;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > worst) worst = dd;
  }

  // 95% CI on per-bet PnL (approximate normal CI)
  const pnl = picks.map((p) => p.result.profitUnits);
  const mean = pnl.reduce((a, b) => a + b, 0) / pnl.length;
  const variance = pnl.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / Math.max(1, pnl.length - 1);
  const sd = Math.sqrt(variance);
  const se = sd / Math.sqrt(pnl.length);
  const ciLow = mean - 1.96 * se;
  const ciHigh = mean + 1.96 * se;

  const winRate = countable.length > 0 ? (wins / countable.length) * 100 : null;

  return {
    matchesTested,
    totalBets: picks.length,
    winRate,
    profitUnits,
    roiPct: roi,
    avgEvPct: avgEv,
    avgClvPct: avgClv,
    brierScore: brier,
    logLoss,
    maxDrawdown: worst,
    avgOdds,
    stakeUnits: picks.length * stakeUnits,
    ci95Low: ciLow,
    ci95High: ciHigh,
  };
}

export function computeMarketSummary(picks: SettledPick[]): MarketSummary[] {
  const markets = ['ML', 'AH', 'OU', 'BTTS'] as const;
  const out: MarketSummary[] = [];
  for (const m of markets) {
    const filtered = picks.filter((p) => p.market === m);
    if (filtered.length === 0) continue;
    const s = computeSummary(filtered, filtered.length);
    out.push({
      market: m,
      totalBets: s.totalBets,
      winRate: s.winRate,
      profitUnits: s.profitUnits,
      roiPct: s.roiPct,
      avgClvPct: s.avgClvPct,
      brierScore: s.brierScore,
      avgEdgePct: filtered.reduce((a, p) => a + p.edgePct, 0) / filtered.length,
      avgEvPct: s.avgEvPct,
    });
  }
  return out;
}

export function computeLeagueSummary(picks: SettledPick[]): {
  leagueId: string;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
}[] {
  const byLeague = new Map<string, SettledPick[]>();
  for (const p of picks) {
    if (!byLeague.has(p.leagueId)) byLeague.set(p.leagueId, []);
    byLeague.get(p.leagueId)!.push(p);
  }
  return [...byLeague.entries()].map(([leagueId, lpicks]) => {
    const s = computeSummary(lpicks, lpicks.length);
    return { leagueId, totalBets: s.totalBets, winRate: s.winRate, profitUnits: s.profitUnits, roiPct: s.roiPct };
  });
}

export function computeSeasonSummary(picks: SettledPick[]): {
  season: string;
  totalBets: number;
  winRate: number | null;
  profitUnits: number;
  roiPct: number | null;
}[] {
  const bySeason = new Map<string, SettledPick[]>();
  for (const p of picks) {
    const season = p.matchDate.substring(0, 4);
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season)!.push(p);
  }
  return [...bySeason.entries()].map(([season, spicks]) => {
    const s = computeSummary(spicks, spicks.length);
    return { season, totalBets: s.totalBets, winRate: s.winRate, profitUnits: s.profitUnits, roiPct: s.roiPct };
  });
}

export function computeCalibration(picks: SettledPick[], nBuckets = 10): CalibrationBin[] {
  const scored = picks
    .filter((p) => p.result.outcome !== 'PUSH')
    .map((p) => ({ prob: p.modelProb, outcome: outcomeIsWin(p.result.outcome) ? 1 : 0 }));
  if (scored.length === 0) return [];

  scored.sort((a, b) => a.prob - b.prob);
  const binSize = Math.max(1, Math.floor(scored.length / nBuckets));
  const bins: CalibrationBin[] = [];
  for (let i = 0; i < scored.length; i += binSize) {
    const chunk = scored.slice(i, i + binSize);
    const low = chunk[0].prob;
    const high = chunk[chunk.length - 1].prob;
    const meanProb = chunk.reduce((a, c) => a + c.prob, 0) / chunk.length;
    const actualRate = chunk.reduce((a, c) => a + c.outcome, 0) / chunk.length;
    bins.push({
      bucketLabel: `${(low * 100).toFixed(0)}-${(high * 100).toFixed(0)}%`,
      bucketLow: low,
      bucketHigh: high,
      modelProbability: meanProb,
      actualWinRate: actualRate,
      sampleCount: chunk.length,
    });
  }
  return bins;
}