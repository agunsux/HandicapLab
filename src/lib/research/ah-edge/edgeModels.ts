// AH EDGE ENGINE — Models and baselines.
//
// One shared feature builder with perspective (own/opponent) transform, so the
// Poisson goal model is symmetric and sees every match twice. All training is
// deterministic (zero/prior init, fixed schedule, no randomness).

import type { AhSide } from '../ah-yield/ahTypes';
import {
  fitIndependencePoissonToOutcomes,
  goalDifferencePmf,
  settlementProbabilitiesFromPmf,
  normalizeCategories,
  type AhCategoryProbabilities,
} from './edgeProbability';
import type { EdgeMatch, EdgeModelConfig, EdgeModelId, FeatureGroup } from './edgeTypes';

// ─────────────────────────────── Feature vector ───────────────────────────────

export function featureNames(perspective: 'home' | 'away', groups: FeatureGroup[]): string[] {
  const names: string[] = [];
  if (groups.includes('market')) {
    names.push('mlProbOwn', 'mlProbDraw', 'mlProbOpp', 'ahLineOwn', 'lineMovement', 'pOver25');
  }
  if (groups.includes('form')) {
    names.push('ownPpg5', 'oppPpg5', 'ownGf5', 'ownGa5', 'oppGf5', 'oppGa5');
  }
  if (groups.includes('rest')) names.push('ownRest', 'oppRest');
  if (groups.includes('elo')) names.push('eloDiffOwn');
  if (groups.includes('league')) names.push('leagueOwnGoals', 'leagueOppGoals', 'homeAdvantageOwn');
  return names.map((n) => `${perspective}:${n}`);
}

function featureValues(m: EdgeMatch, perspective: 'home' | 'away', groups: FeatureGroup[]): number[] {
  const home = perspective === 'home';
  const values: number[] = [];
  const f = m.features;

  if (groups.includes('market')) {
    const pH = m.mlClosing?.pHome ?? 1 / 3;
    const pD = m.mlClosing?.pDraw ?? 1 / 3;
    const pA = m.mlClosing?.pAway ?? 1 / 3;
    const line = home ? m.ah.line : -m.ah.line;
    const openingLine = m.ahOpening ? (home ? m.ahOpening.line : -m.ahOpening.line) : line;
    values.push(
      home ? pH : pA,
      pD,
      home ? pA : pH,
      line,
      openingLine - line,
      m.ouClosingOver25 ?? 0.5
    );
  }
  if (groups.includes('form')) {
    values.push(
      home ? f.homePpg5 : f.awayPpg5,
      home ? f.awayPpg5 : f.homePpg5,
      home ? f.homeGf5 : f.awayGf5,
      home ? f.homeGa5 : f.awayGa5,
      home ? f.awayGf5 : f.homeGf5,
      home ? f.awayGa5 : f.homeGa5
    );
  }
  if (groups.includes('rest')) {
    values.push(home ? f.homeRestDays : f.awayRestDays, home ? f.awayRestDays : f.homeRestDays);
  }
  if (groups.includes('elo')) {
    values.push(home ? f.eloDiff : -f.eloDiff);
  }
  if (groups.includes('league')) {
    values.push(
      home ? f.leagueHomeGoalsPerMatch : f.leagueAwayGoalsPerMatch,
      home ? f.leagueAwayGoalsPerMatch : f.leagueHomeGoalsPerMatch,
      home ? f.homeAdvantageGoals : -f.homeAdvantageGoals
    );
  }
  return values;
}

// ─────────────────────────────── Training utilities ───────────────────────────────

interface Standardizer {
  mean: number[];
  std: number[];
}

function fitStandardizer(rows: number[][]): Standardizer {
  const d = rows[0]?.length ?? 0;
  const mean = new Array(d).fill(0);
  const std = new Array(d).fill(1);
  for (let j = 0; j < d; j++) {
    let s = 0;
    for (const r of rows) s += r[j];
    mean[j] = s / Math.max(1, rows.length);
    let v = 0;
    for (const r of rows) v += (r[j] - mean[j]) ** 2;
    std[j] = Math.sqrt(v / Math.max(1, rows.length - 1)) || 1;
  }
  return { mean, std };
}

function applyStandardizer(s: Standardizer, x: number[]): number[] {
  return x.map((v, j) => (v - s.mean[j]) / s.std[j]);
}

export interface TrainedEdgeModel {
  id: string;
  label: string;
  predict(m: EdgeMatch, line: number, side: AhSide): AhCategoryProbabilities;
  predictRates(m: EdgeMatch): { lambdaHome: number; lambdaAway: number } | null;
  coefficients?: Record<string, number[]>;
}

export function categoriesFromRates(lambdaHome: number, lambdaAway: number, line: number, side: AhSide): AhCategoryProbabilities {
  return settlementProbabilitiesFromPmf(goalDifferencePmf(lambdaHome, lambdaAway), line, side);
}

// ─────────────────────────────── Poisson GLM ───────────────────────────────

const POISSON_EPOCHS_DEFAULT = 900;
const POISSON_LR = 0.15;
const POISSON_L2 = 1e-4;

interface PoissonGlm {
  beta: number[];
  standardizer: Standardizer;
  names: string[];
  groups: FeatureGroup[];
}

function trainPoissonGlm(train: EdgeMatch[], groups: FeatureGroup[], epochs = POISSON_EPOCHS_DEFAULT): PoissonGlm {
  const rawHome: number[][] = [];
  const rawAway: number[][] = [];
  const yHome: number[] = [];
  const yAway: number[] = [];
  for (const m of train) {
    rawHome.push(featureValues(m, 'home', groups));
    rawAway.push(featureValues(m, 'away', groups));
    yHome.push(m.homeGoals);
    yAway.push(m.awayGoals);
  }
  const allRaw = [...rawHome, ...rawAway];
  const standardizer = fitStandardizer(allRaw);
  const xs: number[][] = allRaw.map((r) => applyStandardizer(standardizer, r));
  const ys = [...yHome, ...yAway];

  const d = xs[0]?.length ?? 0;
  const beta = new Array(d).fill(0);
  const meanY = ys.reduce((s, v) => s + v, 0) / Math.max(1, ys.length);
  let b0 = Math.log(Math.max(0.05, meanY));

  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(d).fill(0);
    let g0 = 0;
    for (let i = 0; i < xs.length; i++) {
      let eta = b0;
      for (let j = 0; j < d; j++) eta += beta[j] * xs[i][j];
      eta = Math.min(Math.log(8), Math.max(Math.log(0.05), eta));
      const lambda = Math.exp(eta);
      const err = lambda - ys[i];
      g0 += err;
      for (let j = 0; j < d; j++) grad[j] += err * xs[i][j];
    }
    const lr = POISSON_LR / (1 + epoch / 300);
    b0 -= lr * (g0 / xs.length);
    for (let j = 0; j < d; j++) {
      beta[j] -= lr * (grad[j] / xs.length + POISSON_L2 * beta[j]);
    }
  }

  return { beta: [b0, ...beta], standardizer, names: featureNames('home', groups), groups };
}

function poissonPredictRates(glm: PoissonGlm, m: EdgeMatch, perspective: 'home' | 'away'): number {
  const x = applyStandardizer(glm.standardizer, featureValues(m, perspective, glm.groups));
  let eta = glm.beta[0];
  for (let j = 0; j < x.length; j++) eta += glm.beta[j + 1] * x[j];
  eta = Math.min(Math.log(8), Math.max(Math.log(0.05), eta));
  return Math.exp(eta);
}

// ─────────────────────────────── Softmax classifier ───────────────────────────────

const SOFTMAX_EPOCHS_DEFAULT = 900;
const SOFTMAX_LR = 0.2;
const SOFTMAX_L2 = 1e-4;

interface SoftmaxGlm {
  weights: number[][]; // 3 x d
  intercepts: number[];
  standardizer: Standardizer;
  groups: FeatureGroup[];
  names: string[];
}

function trainSoftmaxGlm(train: EdgeMatch[], groups: FeatureGroup[], epochs = SOFTMAX_EPOCHS_DEFAULT): SoftmaxGlm {
  const xs: number[][] = [];
  const labels: number[] = [];
  for (const m of train) {
    xs.push(featureValues(m, 'home', groups));
    labels.push(m.homeGoals > m.awayGoals ? 0 : m.homeGoals < m.awayGoals ? 2 : 1);
  }
  const standardizer = fitStandardizer(xs);
  const zs = xs.map((x) => applyStandardizer(standardizer, x));
  const d = zs[0]?.length ?? 0;

  const weights: number[][] = [new Array(d).fill(0), new Array(d).fill(0), new Array(d).fill(0)];
  const intercepts = new Array(3).fill(0);
  const counts = [0, 0, 0];
  for (const l of labels) counts[l] += 1;
  for (let c = 0; c < 3; c++) intercepts[c] = Math.log(Math.max(1, counts[c]) / labels.length + 1e-6);

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gW = [new Array(d).fill(0), new Array(d).fill(0), new Array(d).fill(0)];
    const gB = new Array(3).fill(0);
    for (let i = 0; i < zs.length; i++) {
      const logits = [0, 0, 0];
      for (let c = 0; c < 3; c++) {
        let v = intercepts[c];
        for (let j = 0; j < d; j++) v += weights[c][j] * zs[i][j];
        logits[c] = v;
      }
      const max = Math.max(...logits);
      const exps = logits.map((v) => Math.exp(v - max));
      const sum = exps.reduce((s, v) => s + v, 0);
      const p = exps.map((v) => v / sum);
      for (let c = 0; c < 3; c++) {
        const err = p[c] - (labels[i] === c ? 1 : 0);
        gB[c] += err;
        for (let j = 0; j < d; j++) gW[c][j] += err * zs[i][j];
      }
    }
    const lr = SOFTMAX_LR / (1 + epoch / 300);
    for (let c = 0; c < 3; c++) {
      intercepts[c] -= lr * (gB[c] / zs.length);
      for (let j = 0; j < d; j++) {
        weights[c][j] -= lr * (gW[c][j] / zs.length + SOFTMAX_L2 * weights[c][j]);
      }
    }
  }

  return { weights, intercepts, standardizer, groups, names: featureNames('home', groups) };
}

function softmaxOutcomeProbs(glm: SoftmaxGlm, m: EdgeMatch): { pHome: number; pDraw: number; pAway: number } {
  const z = applyStandardizer(glm.standardizer, featureValues(m, 'home', glm.groups));
  const logits = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    let v = glm.intercepts[c];
    for (let j = 0; j < z.length; j++) v += glm.weights[c][j] * z[j];
    logits[c] = v;
  }
  const max = Math.max(...logits);
  const exps = logits.map((v) => Math.exp(v - max));
  const sum = exps.reduce((s, v) => s + v, 0);
  return { pHome: exps[0] / sum, pDraw: exps[1] / sum, pAway: exps[2] / sum };
}

// ─────────────────────────────── Empirical line/side prior ───────────────────────────────

export interface TrainedPriorModel {
  byKey: Map<string, AhCategoryProbabilities>;
  global: { home: AhCategoryProbabilities; away: AhCategoryProbabilities };
}

export function trainLineSidePrior(
  samples: Array<{ line: number; side: AhSide; category: string }>
): TrainedPriorModel {
  const counts = new Map<string, number[]>();
  const globalCounts = { home: new Array(5).fill(0), away: new Array(5).fill(0) };
  const catIndex = (c: string) =>
    c === 'FULL_WIN' ? 0 : c === 'HALF_WIN' ? 1 : c === 'PUSH' ? 2 : c === 'HALF_LOSS' ? 3 : 4;

  for (const s of samples) {
    const key = `${s.line}|${s.side}`;
    const arr = counts.get(key) ?? new Array(5).fill(0);
    arr[catIndex(s.category)] += 1;
    counts.set(key, arr);
    globalCounts[s.side][catIndex(s.category)] += 1;
  }

  const smooth = (arr: number[]): AhCategoryProbabilities => {
    const total = arr.reduce((s, v) => s + v, 0);
    const denom = total + 5;
    return normalizeCategories({
      pFullWin: (arr[0] + 1) / denom,
      pHalfWin: (arr[1] + 1) / denom,
      pPush: (arr[2] + 1) / denom,
      pHalfLoss: (arr[3] + 1) / denom,
      pFullLoss: (arr[4] + 1) / denom,
    });
  };

  const byKey = new Map<string, AhCategoryProbabilities>();
  for (const [key, arr] of counts) byKey.set(key, smooth(arr));

  return { byKey, global: { home: smooth(globalCounts.home), away: smooth(globalCounts.away) } };
}

// ─────────────────────────────── Model factory ───────────────────────────────

export interface TrainContext {
  trainMatches: EdgeMatch[];
  trainSamples: Array<{ line: number; side: AhSide; category: string }>;
}

export function trainEdgeModel(id: EdgeModelId, context: TrainContext, config: EdgeModelConfig): TrainedEdgeModel {
  const groups = config.groups;

  switch (id) {
    case 'market_poisson': {
      return {
        id,
        label: 'Market baseline (Poisson fitted to devigged 1X2)',
        predict(m, line, side) {
          if (!m.mlClosing) return normalizeCategories({ pFullWin: 0.2, pHalfWin: 0.2, pPush: 0.2, pHalfLoss: 0.2, pFullLoss: 0.2 });
          const fit = fitIndependencePoissonToOutcomes(m.mlClosing);
          return categoriesFromRates(fit.lambdaHome, fit.lambdaAway, line, side);
        },
        predictRates(m) {
          if (!m.mlClosing) return null;
          const fit = fitIndependencePoissonToOutcomes(m.mlClosing);
          return { lambdaHome: fit.lambdaHome, lambdaAway: fit.lambdaAway };
        },
      };
    }
    case 'league_line_prior': {
      const prior = trainLineSidePrior(context.trainSamples);
      return {
        id,
        label: 'Historical line/side settlement prior (train seasons)',
        predict(_m, line, side) {
          return prior.byKey.get(`${line}|${side}`) ?? prior.global[side];
        },
        predictRates() {
          return null;
        },
      };
    }
    case 'form_poisson': {
      return {
        id,
        label: 'Recent-form Poisson (shrunk team scoring rates)',
        predict(m, line, side) {
          const rates = formRates(m);
          return categoriesFromRates(rates.lambdaHome, rates.lambdaAway, line, side);
        },
        predictRates(m) {
          return formRates(m);
        },
      };
    }
    case 'elo_poisson': {
      return {
        id,
        label: 'Elo rating baseline (Poisson fitted to Elo outcome probability)',
        predict(m, line, side) {
          const probs = eloOutcomeProbs(m);
          const fit = fitIndependencePoissonToOutcomes(probs);
          return categoriesFromRates(fit.lambdaHome, fit.lambdaAway, line, side);
        },
        predictRates(m) {
          const fit = fitIndependencePoissonToOutcomes(eloOutcomeProbs(m));
          return { lambdaHome: fit.lambdaHome, lambdaAway: fit.lambdaAway };
        },
      };
    }
    case 'poisson_glm': {
      const glm = trainPoissonGlm(context.trainMatches, groups, config.training?.poissonEpochs);
      const coefficients: Record<string, number[]> = { intercept: [glm.beta[0]], };
      glm.names.forEach((n, j) => {
        coefficients[n] = [glm.beta[j + 1]];
      });
      return {
        id,
        label: `Poisson GLM goals (${groups.join('+')})`,
        predict(m, line, side) {
          const lh = poissonPredictRates(glm, m, 'home');
          const la = poissonPredictRates(glm, m, 'away');
          return categoriesFromRates(lh, la, line, side);
        },
        predictRates(m) {
          return { lambdaHome: poissonPredictRates(glm, m, 'home'), lambdaAway: poissonPredictRates(glm, m, 'away') };
        },
        coefficients,
      };
    }
    case 'softmax_glm': {
      const glm = trainSoftmaxGlm(context.trainMatches, groups, config.training?.softmaxEpochs);
      const coefficients: Record<string, number[]> = { intercepts: glm.intercepts };
      glm.names.forEach((n, j) => {
        coefficients[n] = [glm.weights[0][j], glm.weights[1][j], glm.weights[2][j]];
      });
      return {
        id,
        label: `Softmax outcome classifier -> Poisson (${groups.join('+')})`,
        predict(m, line, side) {
          const probs = softmaxOutcomeProbs(glm, m);
          const fit = fitIndependencePoissonToOutcomes(probs);
          return categoriesFromRates(fit.lambdaHome, fit.lambdaAway, line, side);
        },
        predictRates(m) {
          const probs = softmaxOutcomeProbs(glm, m);
          const fit = fitIndependencePoissonToOutcomes(probs);
          return { lambdaHome: fit.lambdaHome, lambdaAway: fit.lambdaAway };
        },
        coefficients,
      };
    }
  }
}

// ─────────────────────────────── Baseline formulas ───────────────────────────────

function shrink(value: number, prior: number, pseudo = 5): number {
  return (value * pseudo + prior * pseudo) / (2 * pseudo);
}

function formRates(m: EdgeMatch): { lambdaHome: number; lambdaAway: number } {
  const f = m.features;
  const attackHome = shrink(f.homeGf5, f.leagueHomeGoalsPerMatch);
  const defenseAway = shrink(f.awayGa5, f.leagueAwayGoalsPerMatch);
  const attackAway = shrink(f.awayGf5, f.leagueAwayGoalsPerMatch);
  const defenseHome = shrink(f.homeGa5, f.leagueHomeGoalsPerMatch);
  const lambdaHome = (attackHome * defenseAway) / Math.max(0.2, f.leagueAwayGoalsPerMatch);
  const lambdaAway = (attackAway * defenseHome) / Math.max(0.2, f.leagueHomeGoalsPerMatch);
  return {
    lambdaHome: clamp(lambdaHome, 0.1, 6),
    lambdaAway: clamp(lambdaAway, 0.1, 6),
  };
}

function eloOutcomeProbs(m: EdgeMatch): { pHome: number; pDraw: number; pAway: number } {
  const eloDiff = m.features.eloDiff;
  const pHomeExpected = 1 / (1 + 10 ** (-eloDiff / 400));
  const pDraw = clamp(0.28 - 0.0006 * Math.abs(eloDiff), 0.14, 0.32);
  let pHome = pHomeExpected - pDraw / 2;
  let pAway = 1 - pHomeExpected - pDraw / 2;
  pHome = clamp(pHome, 0.02, 0.96);
  pAway = clamp(pAway, 0.02, 0.96);
  const sum = pHome + pDraw + pAway;
  return { pHome: pHome / sum, pDraw: pDraw / sum, pAway: pAway / sum };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
