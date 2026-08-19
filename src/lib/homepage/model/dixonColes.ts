// Dixon-Coles (1997) model — MLE fit + prediction, TypeScript mirror of
// python_engine/models/dixon_coles.py. Fits per-team attack/defense, home
// advantage, and rho with exponential time-decay weighting (xi). Used by the
// walk-forward backtest engine ONLY on data strictly BEFORE each kickoff
// (no look-ahead).

import { nelderMead } from '../math/nelderMead';
import { poissonPmf } from '../math';

export interface DCParams {
  alpha: Record<string, number>;
  beta: Record<string, number>;
  gamma: number;
  rho: number;
}

export interface DCTrainingMatch {
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  date: string; // ISO date (YYYY-MM-DD)
}

export interface DCPrediction {
  pHome: number;
  pDraw: number;
  pAway: number;
  pOver25: number;
  pUnder25: number;
  pBtts: number;
  ahProbs: Record<string, { home: number; push: number; away: number }>;
  lambdaHome: number;
  lambdaAway: number;
  scoreMatrix: number[][];
}

function tau(x: number, y: number, lh: number, la: number, rho: number): number {
  if (x === 0 && y === 0) return 1 - lh * la * rho;
  if (x === 0 && y === 1) return 1 + lh * rho;
  if (x === 1 && y === 0) return 1 + la * rho;
  if (x === 1 && y === 1) return 1 - rho;
  return 1.0;
}

export class DixonColesFitter {
  readonly rhoInit: number;
  readonly xi: number;
  readonly maxGoals: number;

  private alpha: Record<string, number> = {};
  private beta: Record<string, number> = {};
  private gamma = 0.25;
  private rho = -0.10;

  constructor(rhoInit = -0.10, xi = 0.0018, maxGoals = 10) {
    this.rhoInit = rhoInit;
    this.xi = xi;
    this.maxGoals = maxGoals;
  }

  fit(matches: DCTrainingMatch[]): void {
    if (matches.length < 20) {
      this._setLeagueAverage(matches);
      return;
    }

    const teams = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))].sort();
    const n = teams.length;
    const idx = new Map(teams.map((t, i) => [t, i]));

    // Reference date = latest match date (point-in-time safe: all matches are
    // before the current prediction).
    const reference = new Date(Math.max(...matches.map((m) => new Date(m.date).getTime())));

    const weights = matches.map((m) => {
      const days = (reference.getTime() - new Date(m.date).getTime()) / 86400000;
      return Math.exp(-this.xi * days);
    });

    const homeI = matches.map((m) => idx.get(m.homeTeam)!);
    const awayI = matches.map((m) => idx.get(m.awayTeam)!);
    const hg = matches.map((m) => m.homeGoals);
    const ag = matches.map((m) => m.awayGoals);
    const M = matches.length;

    // Parameters: [alpha_0..n-1, beta_0..n-1, gamma, rho]
    const nParams = 2 * n + 2;

    const negLogLikelihood = (params: number[]): number => {
      const alphas = params.slice(0, n);
      const betas = params.slice(n, 2 * n);
      const gamma = params[2 * n];
      const rho = Math.max(-0.5, Math.min(0.5, params[2 * n + 1]));

      let nll = 0;
      for (let i = 0; i < M; i++) {
        const lh = Math.max(0.01, Math.exp(alphas[homeI[i]] + betas[awayI[i]] + gamma));
        const la = Math.max(0.01, Math.exp(alphas[awayI[i]] + betas[homeI[i]]));
        const x = hg[i];
        const y = ag[i];

        const logPx = Math.log(poissonPmf(x, lh));
        const logPy = Math.log(poissonPmf(y, la));
        const t = Math.max(1e-10, tau(x, y, lh, la, rho));
        nll += -weights[i] * (logPx + logPy + Math.log(t));
      }

      // Soft identifiability constraint: sum(alpha) ~ 0
      nll += 100.0 * Math.pow(alphas.reduce((a, b) => a + b, 0), 2);
      return nll;
    };

    const x0 = new Array(nParams).fill(0);
    x0[2 * n] = 0.25; // gamma
    x0[2 * n + 1] = this.rhoInit; // rho

    const result = nelderMead(negLogLikelihood, x0, { maxIter: 300 });

    teams.forEach((t, i) => {
      this.alpha[t] = result.x[i];
      this.beta[t] = result.x[n + i];
    });
    this.gamma = result.x[2 * n];
    this.rho = Math.max(-0.5, Math.min(0.5, result.x[2 * n + 1]));
  }

  private _setLeagueAverage(matches: DCTrainingMatch[]): void {
    const teams = [...new Set(matches.flatMap((m) => [m.homeTeam, m.awayTeam]))].sort();
    teams.forEach((t) => {
      this.alpha[t] = 0.0;
      this.beta[t] = 0.0;
    });
    this.gamma = 0.25;
  }

  predict(homeTeam: string, awayTeam: string): DCPrediction {
    const alphaH = this.alpha[homeTeam] ?? 0.0;
    const betaH = this.beta[homeTeam] ?? 0.0;
    const alphaA = this.alpha[awayTeam] ?? 0.0;
    const betaA = this.beta[awayTeam] ?? 0.0;

    const lambdaHome = Math.max(0.1, Math.exp(alphaH + betaA + this.gamma));
    const lambdaAway = Math.max(0.1, Math.exp(alphaA + betaH));

    const max = this.maxGoals;
    const scoreMatrix: number[][] = [];
    let total = 0;
    for (let x = 0; x < max; x++) {
      scoreMatrix[x] = [];
      for (let y = 0; y < max; y++) {
        const p = poissonPmf(x, lambdaHome) * poissonPmf(y, lambdaAway) * tau(x, y, lambdaHome, lambdaAway, this.rho);
        scoreMatrix[x][y] = Math.max(0, p);
        total += scoreMatrix[x][y];
      }
    }
    if (total > 0) {
      for (let x = 0; x < max; x++) {
        for (let y = 0; y < max; y++) scoreMatrix[x][y] /= total;
      }
    }

    let pHome = 0;
    let pDraw = 0;
    let pAway = 0;
    let pUnder25 = 0;
    let pOver25 = 0;
    let pBtts = 0;
    for (let x = 0; x < max; x++) {
      for (let y = 0; y < max; y++) {
        const p = scoreMatrix[x][y];
        if (x > y) pHome += p;
        else if (x === y) pDraw += p;
        else pAway += p;
        if (x + y <= 2) pUnder25 += p;
        else pOver25 += p;
        if (x >= 1 && y >= 1) pBtts += p;
      }
    }

    const ahProbs: Record<string, { home: number; push: number; away: number }> = {};
    for (const line of [-2.5, -2.0, -1.5, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.5]) {
      let pHomeCover = 0;
      let pPush = 0;
      for (let x = 0; x < max; x++) {
        for (let y = 0; y < max; y++) {
          const margin = x - y + line;
          if (margin > 0) pHomeCover += scoreMatrix[x][y];
          else if (margin === 0) pPush += scoreMatrix[x][y];
        }
      }
      ahProbs[String(line)] = {
        home: pHomeCover,
        push: pPush,
        away: 1 - pHomeCover - pPush,
      };
    }

    return {
      pHome,
      pDraw,
      pAway,
      pUnder25,
      pOver25,
      pBtts,
      ahProbs,
      lambdaHome,
      lambdaAway,
      scoreMatrix,
    };
  }

  getParams(): DCParams {
    return { alpha: { ...this.alpha }, beta: { ...this.beta }, gamma: this.gamma, rho: this.rho };
  }
}