// AH INFORMATION ADVANTAGE RESEARCH — Model Training, Probability Derivation & Evaluation.
// Strict Snapshot Semantics & Zero Leakage.

import type { AhSide } from '../ah-yield/ahTypes';
import { isQuarterHandicap } from '../ah-yield/ahSettlement';
import {
  devigTwoWay,
  fitIndependencePoissonToOutcomes,
  goalDifferencePmf,
  settlementProbabilitiesFromPmf,
  normalizeCategories,
  type AhCategoryProbabilities,
} from '../ah-edge/edgeProbability';
import type {
  AblationModelId,
  EarlyVsClosingModelId,
  FeatureGroup,
  InfoBetPrediction,
  InfoMatch,
  MetricSummaryStats,
} from './infoTypes';

export const ABLATION_GROUPS_MAP: Record<AblationModelId, FeatureGroup[]> = {
  M0: ['market'],
  M1: ['market', 'form'],
  M2: ['market', 'strength'],
  M3: ['market', 'context'],
  M4: ['market', 'goal_env'],
  M5: ['market', 'form', 'strength'],
  M6: ['market', 'form', 'strength', 'context'],
  M7: ['market', 'form', 'strength', 'context', 'goal_env'],
  F0: ['form', 'strength', 'context', 'goal_env'],
};

interface Standardizer {
  mean: number[];
  std: number[];
}

function fitStandardizer(rows: number[][]): Standardizer {
  const d = rows[0]?.length ?? 0;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(1);
  if (rows.length === 0) return { mean, std };

  for (let j = 0; j < d; j++) {
    let s = 0;
    for (const r of rows) s += r[j];
    mean[j] = s / rows.length;
    let v = 0;
    for (const r of rows) v += (r[j] - mean[j]) ** 2;
    std[j] = Math.sqrt(v / Math.max(1, rows.length - 1)) || 1;
  }
  return { mean, std };
}

function transform(v: number[], s: Standardizer): number[] {
  return v.map((x, j) => (x - s.mean[j]) / s.std[j]);
}

export function extractFeatureVector(
  m: InfoMatch,
  side: 'home' | 'away',
  groups: FeatureGroup[],
  snapshot: 'early' | 'closing' | 'movement_bridge'
): number[] {
  const isHome = side === 'home';
  const f = m.features;
  const vals: number[] = [];

  // 1. GROUP A — MARKET
  if (groups.includes('market')) {
    const ahQuote = snapshot === 'closing' ? m.closingAh : m.earlyAh;
    const mlQuote = snapshot === 'closing' ? m.closingMl : m.earlyMl;
    const ouOver25 = snapshot === 'closing' ? m.closingOuOver25 : m.earlyOuOver25;

    const line = ahQuote ? (isHome ? ahQuote.line : -ahQuote.line) : 0;
    const price = ahQuote ? (isHome ? ahQuote.homeOdds : ahQuote.awayOdds) : 2.0;
    const pH = mlQuote ? (isHome ? mlQuote.pHome : mlQuote.pAway) : 1 / 3;
    const pD = mlQuote ? mlQuote.pDraw : 1 / 3;
    const pA = mlQuote ? (isHome ? mlQuote.pAway : mlQuote.pHome) : 1 / 3;
    const pOu = ouOver25 ?? 0.5;
    const devigAh = ahQuote ? (isHome ? devigTwoWay(ahQuote.homeOdds, ahQuote.awayOdds).pA : devigTwoWay(ahQuote.homeOdds, ahQuote.awayOdds).pB) : 0.5;

    vals.push(line, price, pH, pD, pA, pOu, devigAh);
  }

  // 2. GROUP B — MOVEMENT (Only used when snapshot is movement_bridge)
  if (groups.includes('movement') && snapshot === 'movement_bridge') {
    const lineMov = isHome ? m.lineMovementHome : -m.lineMovementHome;
    const priceMov = isHome ? m.priceMovementHome : -m.priceMovementHome;
    const probMov = isHome ? m.probMovementHome : -m.probMovementHome;
    vals.push(lineMov, priceMov, probMov);
  }

  // 3. GROUP C — FORM
  if (groups.includes('form')) {
    const ppg3 = isHome ? f.formPpg3Home : f.formPpg3Away;
    const oppPpg3 = isHome ? f.formPpg3Away : f.formPpg3Home;
    const gd3 = isHome ? f.formGd3Home : f.formGd3Away;
    const oppGd3 = isHome ? f.formGd3Away : f.formGd3Home;

    const ppg5 = isHome ? f.formPpg5Home : f.formPpg5Away;
    const oppPpg5 = isHome ? f.formPpg5Away : f.formPpg5Home;
    const gd5 = isHome ? f.formGd5Home : f.formGd5Away;
    const oppGd5 = isHome ? f.formGd5Away : f.formGd5Home;

    const ppg10 = isHome ? f.formPpg10Home : f.formPpg10Away;
    const oppPpg10 = isHome ? f.formPpg10Away : f.formPpg10Home;

    const venuePpg = isHome ? f.homeFormPpg : f.awayFormPpg;
    const venueGf = isHome ? f.homeFormGf : f.awayFormGf;
    const ppm = isHome ? f.ppmHome : f.ppmAway;
    const oppPpm = isHome ? f.ppmAway : f.ppmHome;

    vals.push(ppg3, oppPpg3, gd3, oppGd3, ppg5, oppPpg5, gd5, oppGd5, ppg10, oppPpg10, venuePpg, venueGf, ppm, oppPpm);
  }

  // 4. GROUP D — STRENGTH
  if (groups.includes('strength')) {
    const eloDiff = isHome ? f.eloDiff : -f.eloDiff;
    const rollingStr = isHome ? f.rollingStrengthHome : f.rollingStrengthAway;
    const oppRollingStr = isHome ? f.rollingStrengthAway : f.rollingStrengthHome;
    const oppAdjStr = isHome ? f.oppAdjustedStrengthHome : f.oppAdjustedStrengthAway;

    vals.push(eloDiff, rollingStr, oppRollingStr, oppAdjStr);
  }

  // 5. GROUP E — CONTEXT
  if (groups.includes('context')) {
    const restOwn = isHome ? f.restDaysHome : f.restDaysAway;
    const restOpp = isHome ? f.restDaysAway : f.restDaysHome;
    const restDiff = isHome ? f.restDiff : -f.restDiff;
    const haGoals = isHome ? f.homeAdvantageGoals : -f.homeAdvantageGoals;
    const matchesPlayed = isHome ? f.seasonProgressionHome : f.seasonProgressionAway;
    const density14 = isHome ? f.scheduleDensity14dHome : f.scheduleDensity14dAway;

    vals.push(restOwn, restOpp, restDiff, haGoals, matchesPlayed, density14);
  }

  // 6. GROUP F — GOAL ENVIRONMENT
  if (groups.includes('goal_env')) {
    const leagueGoals = f.leagueGoalsPerMatch;
    const teamGf = isHome ? f.teamSeasonGfHome : f.teamSeasonGfAway;
    const teamGa = isHome ? f.teamSeasonGaHome : f.teamSeasonGaAway;
    const oppGf = isHome ? f.teamSeasonGfAway : f.teamSeasonGfHome;
    const oppGa = isHome ? f.teamSeasonGaAway : f.teamSeasonGaHome;

    vals.push(leagueGoals, teamGf, teamGa, oppGf, oppGa);
  }

  return vals;
}

export interface TrainedModel {
  groups: FeatureGroup[];
  weights: number[];
  biasHome: number;
  biasAway: number;
  standardizer: Standardizer;
}

export function trainPoissonGlm(
  trainMatches: InfoMatch[],
  groups: FeatureGroup[],
  snapshot: 'early' | 'closing' | 'movement_bridge' = 'early',
  epochs = 70,
  lr = 0.05,
  l2 = 1e-4
): TrainedModel {
  const X: number[][] = [];
  const yOwn: number[] = [];
  const yOpp: number[] = [];

  for (const m of trainMatches) {
    const xHome = extractFeatureVector(m, 'home', groups, snapshot);
    X.push(xHome);
    yOwn.push(m.homeGoals);
    yOpp.push(m.awayGoals);

    const xAway = extractFeatureVector(m, 'away', groups, snapshot);
    X.push(xAway);
    yOwn.push(m.awayGoals);
    yOpp.push(m.homeGoals);
  }

  const standardizer = fitStandardizer(X);
  const Xnorm = X.map((r) => transform(r, standardizer));
  const d = standardizer.mean.length;

  const weights = new Array(d).fill(0);
  let biasHome = 0.35;
  let biasAway = 0.15;

  for (let epoch = 0; epoch < epochs; epoch++) {
    const currentLr = lr / (1 + 0.01 * epoch);
    for (let i = 0; i < Xnorm.length; i++) {
      const isHomeRow = i % 2 === 0;
      const xi = Xnorm[i];
      let dot = 0;
      for (let j = 0; j < d; j++) dot += weights[j] * xi[j];
      const bias = isHomeRow ? biasHome : biasAway;
      const lambda = Math.max(0.05, Math.min(8.0, Math.exp(bias + dot)));
      const actual = yOwn[i];

      const err = lambda - actual; // Poisson gradient dLoss/dz = lambda - y

      for (let j = 0; j < d; j++) {
        weights[j] -= currentLr * (err * xi[j] + l2 * weights[j]);
      }
      if (isHomeRow) biasHome -= currentLr * err;
      else biasAway -= currentLr * err;
    }
  }

  return { groups, weights, biasHome, biasAway, standardizer };
}

export function predictMatchProbabilities(
  model: TrainedModel,
  m: InfoMatch,
  targetLine: number,
  snapshot: 'early' | 'closing' | 'movement_bridge'
): { homeCats: AhCategoryProbabilities; awayCats: AhCategoryProbabilities } {
  const xHome = transform(extractFeatureVector(m, 'home', model.groups, snapshot), model.standardizer);
  const xAway = transform(extractFeatureVector(m, 'away', model.groups, snapshot), model.standardizer);

  let dotH = 0;
  for (let j = 0; j < model.weights.length; j++) dotH += model.weights[j] * xHome[j];
  let dotA = 0;
  for (let j = 0; j < model.weights.length; j++) dotA += model.weights[j] * xAway[j];

  const lambdaHome = Math.max(0.1, Math.min(6.0, Math.exp(model.biasHome + dotH)));
  const lambdaAway = Math.max(0.1, Math.min(6.0, Math.exp(model.biasAway + dotA)));

  const gdPmf = goalDifferencePmf(lambdaHome, lambdaAway, 6);

  const homeCats = normalizeCategories(settlementProbabilitiesFromPmf(gdPmf, targetLine, 'home'));
  const awayCats = normalizeCategories(settlementProbabilitiesFromPmf(gdPmf, targetLine, 'away'));

  return { homeCats, awayCats };
}

export function predictMarketBaselineProbabilities(
  m: InfoMatch,
  targetLine: number,
  snapshot: 'early' | 'closing'
): { homeCats: AhCategoryProbabilities; awayCats: AhCategoryProbabilities } {
  const ml = snapshot === 'closing' ? m.closingMl : m.earlyMl;
  const ah = snapshot === 'closing' ? m.closingAh : m.earlyAh;

  if (ml) {
    const fitted = fitIndependencePoissonToOutcomes({ pHome: ml.pHome, pDraw: ml.pDraw, pAway: ml.pAway });
    const gdPmf = goalDifferencePmf(fitted.lambdaHome, fitted.lambdaAway, 6);
    return {
      homeCats: normalizeCategories(settlementProbabilitiesFromPmf(gdPmf, targetLine, 'home')),
      awayCats: normalizeCategories(settlementProbabilitiesFromPmf(gdPmf, targetLine, 'away')),
    };
  }

  // Fallback to devigged 2-way if available
  const pHomeBinary = ah ? devigTwoWay(ah.homeOdds, ah.awayOdds).pA : 0.5;
  const pAwayBinary = 1 - pHomeBinary;
  return {
    homeCats: { pFullWin: pHomeBinary, pHalfWin: 0, pPush: 0, pHalfLoss: 0, pFullLoss: pAwayBinary },
    awayCats: { pFullWin: pAwayBinary, pHalfWin: 0, pPush: 0, pHalfLoss: 0, pFullLoss: pHomeBinary },
  };
}

export function computeStats(
  predictions: InfoBetPrediction[],
  baselinePredictions?: InfoBetPrediction[]
): MetricSummaryStats {
  const decided = predictions.filter((p) => p.y !== null);
  const n = decided.length;
  if (n === 0) {
    return {
      bets: 0,
      pushes: predictions.filter((p) => p.y === null).length,
      brier: 0,
      logLoss: 0,
      ece: 0,
      hitRate: 0,
      allBetsRoi: 0,
      evPositiveBets: 0,
      evPositiveRoi: 0,
      evPositiveCi95: [0, 0],
      evPositiveClv: null,
      positiveFolds: 0,
      medianFoldRoi: 0,
      deltaBrierVsBaseline: 0,
      deltaBrierCi95: [0, 0],
      deltaBrierPValue: 1,
      deltaBrierZ: 0,
    };
  }

  let brierSum = 0;
  let logLossSum = 0;
  let wins = 0;

  for (const p of decided) {
    const diff = p.modelBinaryProbability - p.y!;
    brierSum += diff * diff;
    const clampedP = Math.max(1e-4, Math.min(1 - 1e-4, p.modelBinaryProbability));
    logLossSum += -(p.y! * Math.log(clampedP) + (1 - p.y!) * Math.log(1 - clampedP));
    if (p.y === 1) wins++;
  }

  const brier = brierSum / n;
  const logLoss = logLossSum / n;
  const hitRate = wins / n;

  // ECE (10 bins)
  const bins: { count: number; sumP: number; sumY: number }[] = Array.from({ length: 10 }, () => ({
    count: 0,
    sumP: 0,
    sumY: 0,
  }));
  for (const p of decided) {
    const b = Math.min(9, Math.floor(p.modelBinaryProbability * 10));
    bins[b].count++;
    bins[b].sumP += p.modelBinaryProbability;
    bins[b].sumY += p.y!;
  }
  let ece = 0;
  for (const b of bins) {
    if (b.count > 0) {
      ece += (b.count / n) * Math.abs(b.sumP / b.count - b.sumY / b.count);
    }
  }

  // All bets PnL
  let totalProfit = 0;
  for (const p of predictions) {
    totalProfit += p.pnl;
  }
  const allBetsRoi = predictions.length > 0 ? (totalProfit / predictions.length) * 100 : 0;

  // EV > 0 selection
  const evPos = predictions.filter((p) => p.modelEv > 0);
  let evProfit = 0;
  let clvSum = 0;
  let clvCount = 0;
  for (const p of evPos) {
    evProfit += p.pnl;
    if (p.clv !== null) {
      clvSum += p.clv;
      clvCount++;
    }
  }
  const evPositiveRoi = evPos.length > 0 ? (evProfit / evPos.length) * 100 : 0;
  const evSe = evPos.length > 0 ? 100 / Math.sqrt(evPos.length) : 0;
  const evPositiveCi95: [number, number] = [
    Number((evPositiveRoi - 1.96 * evSe).toFixed(2)),
    Number((evPositiveRoi + 1.96 * evSe).toFixed(2)),
  ];
  const evPositiveClv = clvCount > 0 ? Number(((clvSum / clvCount) * 100).toFixed(2)) : null;

  // Folds evaluation
  const seasons = Array.from(new Set(predictions.map((p) => p.season))).sort();
  let posFolds = 0;
  const foldRois: number[] = [];
  for (const s of seasons) {
    const sBets = evPos.filter((p) => p.season === s);
    if (sBets.length > 0) {
      let pnl = 0;
      for (const p of sBets) {
        pnl += p.pnl;
      }
      const roi = (pnl / sBets.length) * 100;
      if (roi > 0) posFolds++;
      foldRois.push(roi);
    }
  }
  foldRois.sort((a, b) => a - b);
  const medianFoldRoi = foldRois.length > 0 ? foldRois[Math.floor(foldRois.length / 2)] : 0;

  // Paired test vs baseline
  let deltaBrier = 0;
  let deltaCi: [number, number] = [0, 0];
  let deltaZ = 0;
  let deltaP = 1;

  if (baselinePredictions && baselinePredictions.length === predictions.length) {
    const baseDecided = baselinePredictions.filter((p) => p.y !== null);
    if (baseDecided.length === n) {
      const diffs: number[] = [];
      for (let i = 0; i < n; i++) {
        const dModel = (decided[i].modelBinaryProbability - decided[i].y!) ** 2;
        const dBase = (baseDecided[i].modelBinaryProbability - baseDecided[i].y!) ** 2;
        diffs.push(dModel - dBase);
      }
      const meanDiff = diffs.reduce((a, b) => a + b, 0) / n;
      let varDiff = 0;
      for (const d of diffs) varDiff += (d - meanDiff) ** 2;
      const seDiff = Math.sqrt(varDiff / Math.max(1, n - 1)) / Math.sqrt(n);

      deltaBrier = meanDiff;
      deltaCi = [meanDiff - 1.96 * seDiff, meanDiff + 1.96 * seDiff];
      deltaZ = seDiff > 0 ? meanDiff / seDiff : 0;
      // standard normal p-value
      deltaP = 2 * (1 - normalCdf(Math.abs(deltaZ)));
    }
  }

  return {
    bets: n,
    pushes: predictions.length - n,
    brier: Number(brier.toFixed(4)),
    logLoss: Number(logLoss.toFixed(4)),
    ece: Number(ece.toFixed(4)),
    hitRate: Number((hitRate * 100).toFixed(2)),
    allBetsRoi: Number(allBetsRoi.toFixed(2)),
    evPositiveBets: evPos.length,
    evPositiveRoi: Number(evPositiveRoi.toFixed(2)),
    evPositiveCi95,
    evPositiveClv,
    positiveFolds: posFolds,
    medianFoldRoi: Number(medianFoldRoi.toFixed(2)),
    deltaBrierVsBaseline: Number(deltaBrier.toFixed(5)),
    deltaBrierCi95: [Number(deltaCi[0].toFixed(5)), Number(deltaCi[1].toFixed(5))],
    deltaBrierPValue: Number(deltaP.toFixed(4)),
    deltaBrierZ: Number(deltaZ.toFixed(2)),
  };
}

function normalCdf(x: number): number {
  // Abramowitz and Stegun approximation
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp((-x * x) / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
