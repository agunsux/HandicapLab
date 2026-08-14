import type { FeatureSnapshot } from '../types';

export interface PoissonParams {
  leagueHomeAvg: number;
  leagueAwayAvg: number;
  homeAdv: number;
  eloScale: number;
  maxGoals: number;
}

export interface MarketProbs {
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver: Record<string, number>;
  pUnder: Record<string, number>;
  pBttsYes: number;
  pAhHome: Record<string, number>;
  xgHome: number;
  xgAway: number;
}

export function poissonPmf(lambda: number, k: number): number {
  return Math.exp(-lambda) * Math.pow(lambda, k) / factorial(k);
}

function factorial(n: number): number {
  let r = 1;
  for (let i = 2; i <= n; i++) r *= i;
  return r;
}

export interface LambdaInput {
  homeAvgGoalsFor: number;
  awayAvgGoalsAgainst: number;
  awayAvgGoalsFor: number;
  homeAvgGoalsAgainst: number;
  leagueAvgGoals: number;
  eloDelta: number;
}

export function computeLambdas(input: LambdaInput, p: PoissonParams): { home: number; away: number } {
  const homeBase = Math.max(p.leagueHomeAvg, 0.5);
  const awayBase = Math.max(p.leagueAwayAvg, 0.5);
  const homeAttack = input.homeAvgGoalsFor / homeBase;
  const awayDefense = input.awayAvgGoalsAgainst / homeBase;
  const awayAttack = input.awayAvgGoalsFor / awayBase;
  const homeDefense = input.homeAvgGoalsAgainst / awayBase;
  const eloAdjHome = Math.pow(2, input.eloDelta / (p.eloScale * 2));
  const eloAdjAway = 1 / eloAdjHome;
  const rawHome = p.leagueHomeAvg * homeAttack * awayDefense * eloAdjHome;
  const rawAway = p.leagueAwayAvg * awayAttack * homeDefense * eloAdjAway;
  return { home: clamp(rawHome, 0.1, 5), away: clamp(rawAway, 0.1, 5) };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

export function scoreMatrix(lambdas: { home: number; away: number }, maxGoals: number): number[][] {
  const matrix: number[][] = [];
  for (let h = 0; h <= maxGoals; h++) {
    matrix[h] = [];
    for (let a = 0; a <= maxGoals; a++) {
      matrix[h][a] = poissonPmf(lambdas.home, h) * poissonPmf(lambdas.away, a);
    }
  }
  return matrix;
}

export function deriveMarkets(matrix: number[][]): MarketProbs {
  const maxGoals = matrix.length - 1;
  let pHome = 0, pDraw = 0, pAway = 0, pBttsYes = 0, xgHome = 0, xgAway = 0;
  const pOver: Record<string, number> = {};
  const pUnder: Record<string, number> = {};
  const pAhHome: Record<string, number> = {};
  let sum = 0;

  for (let h = 0; h <= maxGoals; h++) {
    for (let a = 0; a <= maxGoals; a++) {
      const p = matrix[h][a];
      sum += p;
      xgHome += h * p;
      xgAway += a * p;
      if (h > a) pHome += p;
      else if (h === a) pDraw += p;
      else pAway += p;
      if (h >= 1 && a >= 1) pBttsYes += p;
    }
  }

  for (const lineStr of ['0.5', '1.5', '2.5', '3.5', '4.5']) {
    const line = parseFloat(lineStr);
    let over = 0, under = 0;
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        if (h + a > line) over += matrix[h][a];
        else under += matrix[h][a];
      }
    }
    pOver[lineStr] = over / (over + under);
    pUnder[lineStr] = under / (over + under);
  }

  for (const lineStr of ['-1.5', '-1.0', '-0.5', '0.0', '+0.5', '+1.0', '+1.5']) {
    const line = parseFloat(lineStr);
    let homeWin = 0, awayWin = 0;
    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const margin = h - a + line;
        if (margin > 0) homeWin += matrix[h][a];
        else if (margin < 0) awayWin += matrix[h][a];
      }
    }
    pAhHome[lineStr] = homeWin / (homeWin + awayWin);
  }

  return {
    pHome: pHome / sum,
    pDraw: pDraw / sum,
    pAway: pAway / sum,
    pOver,
    pUnder,
    pBttsYes: pBttsYes / sum,
    pAhHome,
    xgHome: Number(xgHome.toFixed(4)),
    xgAway: Number(xgAway.toFixed(4)),
  };
}

export function fitLeagueConstants(train: FeatureSnapshot[], results: Map<string, { home: number; away: number }>): { leagueHomeAvg: number; leagueAwayAvg: number; homeAdv: number } {
  let hg = 0, ag = 0, n = 0;
  for (const s of train) {
    const r = results.get(s.match_id);
    if (!r) continue;
    hg += r.home;
    ag += r.away;
    n += 1;
  }
  const leagueHomeAvg = n > 0 ? hg / n : 1.4;
  const leagueAwayAvg = n > 0 ? ag / n : 1.15;
  const rawAdv = n > 0 ? (hg / n) / (ag / n) : 1.22;
  const homeAdv = Math.min(1.5, Math.max(1.0, rawAdv));
  return { leagueHomeAvg: Number(leagueHomeAvg.toFixed(4)), leagueAwayAvg: Number(leagueAwayAvg.toFixed(4)), homeAdv: Number(homeAdv.toFixed(4)) };
}
