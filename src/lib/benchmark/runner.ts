// Benchmark Framework — Runner & Comparison Engine
import { BenchmarkInput, BenchmarkMetrics, BenchmarkResult, BenchmarkModelId } from './types';
import { logLoss, brierScore, calculateECE, removeVig } from '../math/metrics';

function runModel(
  data: BenchmarkInput[],
  predictFn: (i: BenchmarkInput) => { prob: number; side: 'home' | 'draw' | 'away' }
): BenchmarkMetrics {
  let profit = 0, stake = 0, wins = 0, llSum = 0, brSum = 0, evSum = 0;
  const probs: number[] = [], actuals: number[] = [];

  for (const d of data) {
    const { prob, side } = predictFn(d);
    const odds = side === 'home' ? d.oddsHome : side === 'draw' ? d.oddsDraw : d.oddsAway;
    const actual = d.outcome === side ? 1 : 0;
    stake += 1;
    if (actual === 1) { profit += odds - 1; wins++; } else { profit -= 1; }
    llSum += logLoss(prob, actual);
    brSum += brierScore(prob, actual);
    evSum += prob * odds - 1;
    probs.push(Math.min(0.99, Math.max(0.01, prob)));
    actuals.push(actual);
  }

  const n = data.length;
  return {
    roi: stake > 0 ? profit / stake : 0,
    yield: stake > 0 ? (profit / stake) * 100 : 0,
    accuracy: n > 0 ? wins / n : 0,
    logLoss: n > 0 ? llSum / n : 0,
    brierScore: n > 0 ? brSum / n : 0,
    clv: null,
    expectedValue: n > 0 ? evSum / n : 0,
    calibrationError: calculateECE(probs, actuals),
    totalBets: n, winningBets: wins, totalProfit: profit, totalStake: stake,
  };
}

const BENCHMARK_MODELS: Array<{ id: BenchmarkModelId; name: string; fn: (i: BenchmarkInput) => { prob: number; side: 'home' | 'draw' | 'away' } }> = [
  {
    id: 'CLOSING_ODDS', name: 'Closing Odds',
    fn: (i) => { const p = removeVig(i.oddsHome, i.oddsDraw, i.oddsAway); const m = Math.max(p.homeProb, p.drawProb, p.awayProb); return m === p.homeProb ? { prob: p.homeProb, side: 'home' } : m === p.drawProb ? { prob: p.drawProb, side: 'draw' } : { prob: p.awayProb, side: 'away' }; }
  },
  {
    id: 'OPENING_ODDS', name: 'Opening Odds',
    fn: (i) => { const p = removeVig(i.openingOddsHome, i.openingOddsDraw, i.openingOddsAway); const m = Math.max(p.homeProb, p.drawProb, p.awayProb); return m === p.homeProb ? { prob: p.homeProb, side: 'home' } : m === p.drawProb ? { prob: p.drawProb, side: 'draw' } : { prob: p.awayProb, side: 'away' }; }
  },
  { id: 'HOME_FAVORITE', name: 'Home Favorite', fn: () => ({ prob: 0.48, side: 'home' as const }) },
  { id: 'AWAY_FAVORITE', name: 'Away Favorite', fn: () => ({ prob: 0.48, side: 'away' as const }) },
  { id: 'ALWAYS_HOME', name: 'Always Home', fn: () => ({ prob: 0.48, side: 'home' as const }) },
  { id: 'ALWAYS_AWAY', name: 'Always Away', fn: () => ({ prob: 0.48, side: 'away' as const }) },
  { id: 'ALWAYS_DRAW', name: 'Always Draw', fn: () => ({ prob: 0.267, side: 'draw' as const }) },
  {
    id: 'RANDOM', name: 'Random',
    fn: () => { const r = Math.random(); return r < 0.45 ? { prob: 0.45, side: 'home' as const } : r < 0.55 ? { prob: 0.267, side: 'draw' as const } : { prob: 0.45, side: 'away' as const }; }
  },
  { id: 'MARKET_IMPLIED', name: 'Market Implied', fn: (i) => ({ prob: removeVig(i.oddsHome, i.oddsDraw, i.oddsAway).homeProb, side: 'home' as const }) },
  { id: 'FLAT_50', name: 'Flat 50%', fn: (i) => ({ prob: 0.50, side: i.isHomeFavorite ? 'home' as const : 'away' as const }) },
];

export function runBenchmarkSuite(
  data: BenchmarkInput[],
  customPredict?: (i: BenchmarkInput) => { prob: number; side: 'home' | 'draw' | 'away' }
): BenchmarkResult[] {
  if (data.length === 0) return [];
  const models = customPredict
    ? [{ id: 'MARKET_IMPLIED' as BenchmarkModelId, name: 'Custom Model', fn: customPredict }, ...BENCHMARK_MODELS]
    : BENCHMARK_MODELS;

  const results = models.map(m => ({
    modelId: m.id, modelName: m.name,
    metrics: runModel(data, m.fn),
  }));
  results.sort((a, b) => b.metrics.roi - a.metrics.roi);
  return results;
}

export function simulationToBenchmarkInput(
  results: Array<{
    pred: { ml_home_prob: number; ml_draw_prob: number; ml_away_prob: number };
    input: { odds_home: number; odds_draw: number; odds_away: number };
    outcome: { homeWin: boolean; draw: boolean; awayWin: boolean };
  }>
): BenchmarkInput[] {
  return results.map((r, i) => ({
    matchId: `sim_${i}`,
    modelHomeProb: r.pred.ml_home_prob, modelDrawProb: r.pred.ml_draw_prob, modelAwayProb: r.pred.ml_away_prob,
    oddsHome: r.input.odds_home, oddsDraw: r.input.odds_draw, oddsAway: r.input.odds_away,
    openingOddsHome: r.input.odds_home * 1.02, openingOddsDraw: r.input.odds_draw * 1.02, openingOddsAway: r.input.odds_away * 1.02,
    outcome: r.outcome.homeWin ? 'home' : r.outcome.awayWin ? 'away' : 'draw',
    isHomeFavorite: r.input.odds_home <= r.input.odds_away,
    isAwayFavorite: r.input.odds_away < r.input.odds_home,
  }));
}
