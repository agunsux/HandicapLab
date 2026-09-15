/**
 * Hierarchical Dixon-Coles Goal Model with Regularization & Time-Decay Weighting
 * Location: src/lib/research/model-a/hierarchicalDixonColes.ts
 */

import { CanonicalMatch, FittedLeagueModel, BivariateScoreDistribution } from './types';

export function poissonPdf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let fact = 1;
  for (let i = 2; i <= k; i++) fact *= i;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / fact;
}

export function dixonColesTau(
  x: number,
  y: number,
  lambdaH: number,
  lambdaA: number,
  rho: number
): number {
  if (x === 0 && y === 0) return Math.max(0, 1 - lambdaH * lambdaA * rho);
  if (x === 1 && y === 0) return Math.max(0, 1 + lambdaA * rho);
  if (x === 0 && y === 1) return Math.max(0, 1 + lambdaH * rho);
  if (x === 1 && y === 1) return Math.max(0, 1 - rho);
  return 1.0;
}

export interface FitOptions {
  xi?: number; // Time decay constant (default 0.0018 => ~385 day half-life)
  lambdaReg?: number; // L2 penalty on attack/defense parameters (default 2.0)
  maxIter?: number; // Newton-Raphson coordinate descent iterations (default 35)
}

export class HierarchicalDixonColesModel {
  /**
   * Fits league-specific hierarchical goal model parameters on historical matches strictly before referenceDate.
   * Enforces hard anti-leakage: any match with matchDate >= referenceDate causes an immediate error.
   */
  public static fitLeague(
    matches: CanonicalMatch[],
    leagueId: string,
    referenceDate: string,
    options: FitOptions = {}
  ): FittedLeagueModel {
    const xi = options.xi ?? 0.0018;
    const lambdaReg = options.lambdaReg ?? 2.0;
    const maxIter = options.maxIter ?? 35;

    // Strict Anti-Leakage Guard
    const validMatches = matches.filter((m) => {
      if (m.matchDate >= referenceDate) {
        throw new Error(
          `[ANTI-LEAKAGE VIOLATION] Match ${m.canonicalId} date ${m.matchDate} >= referenceDate ${referenceDate}`
        );
      }
      return m.leagueId === leagueId;
    });

    if (validMatches.length < 10) {
      // Fallback for minimal sample size
      return {
        leagueId,
        referenceDate,
        mu: 0.15,
        gamma: 0.20,
        alpha: {},
        beta: {},
        rho: -0.05,
        nMatches: validMatches.length,
        nTeams: 0,
      };
    }

    const teams = Array.from(
      new Set(validMatches.flatMap((m) => [m.homeTeam, m.awayTeam]))
    ).sort();
    const nTeams = teams.length;
    const teamIdx: Record<string, number> = {};
    teams.forEach((t, i) => (teamIdx[t] = i));

    // Exponential form/time decay weights
    const refTime = new Date(referenceDate).getTime();
    const weights = new Float64Array(validMatches.length);
    for (let m = 0; m < validMatches.length; m++) {
      const mTime = new Date(validMatches[m].matchDate).getTime();
      const days = Math.max(0, (refTime - mTime) / (1000 * 3600 * 24));
      weights[m] = Math.exp(-xi * days);
    }

    let mu = Math.log(1.30);
    let gamma = 0.20;
    const alpha = new Float64Array(nTeams);
    const beta = new Float64Array(nTeams);

    // Coordinate Newton-Raphson Optimization on concave penalized log-likelihood
    for (let iter = 0; iter < maxIter; iter++) {
      // 1. Update league baseline mu
      let gradMu = 0;
      let hessMu = 0;
      for (let m = 0; m < validMatches.length; m++) {
        const match = validMatches[m];
        const w = weights[m];
        const hi = teamIdx[match.homeTeam];
        const ai = teamIdx[match.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
        const la = Math.exp(mu + alpha[ai] + beta[hi]);

        gradMu += w * (match.homeGoals - lh + match.awayGoals - la);
        hessMu += -w * (lh + la);
      }
      if (Math.abs(hessMu) > 1e-12) mu -= gradMu / hessMu;

      // 2. Update league home advantage gamma
      let gradGamma = 0;
      let hessGamma = 0;
      for (let m = 0; m < validMatches.length; m++) {
        const match = validMatches[m];
        const w = weights[m];
        const hi = teamIdx[match.homeTeam];
        const ai = teamIdx[match.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);

        gradGamma += w * (match.homeGoals - lh);
        hessGamma += -w * lh;
      }
      if (Math.abs(hessGamma) > 1e-12) {
        gamma -= gradGamma / hessGamma;
        // Keep home advantage within realistic boundaries [0.02, 0.60]
        gamma = Math.max(0.02, Math.min(0.60, gamma));
      }

      // 3. Update attack parameters alpha with L2 regularization
      for (let i = 0; i < nTeams; i++) {
        let gradA = -lambdaReg * alpha[i];
        let hessA = -lambdaReg;
        for (let m = 0; m < validMatches.length; m++) {
          const match = validMatches[m];
          const w = weights[m];
          const hi = teamIdx[match.homeTeam];
          const ai = teamIdx[match.awayTeam];

          if (hi === i) {
            const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
            gradA += w * (match.homeGoals - lh);
            hessA += -w * lh;
          } else if (ai === i) {
            const la = Math.exp(mu + alpha[ai] + beta[hi]);
            gradA += w * (match.awayGoals - la);
            hessA += -w * la;
          }
        }
        if (Math.abs(hessA) > 1e-12) alpha[i] -= gradA / hessA;
      }

      // Identifiability constraint: sum(alpha) = 0
      let sumAlpha = 0;
      for (let i = 0; i < nTeams; i++) sumAlpha += alpha[i];
      const meanAlpha = sumAlpha / nTeams;
      for (let i = 0; i < nTeams; i++) alpha[i] -= meanAlpha;
      mu += meanAlpha;

      // 4. Update defense parameters beta with L2 regularization
      for (let i = 0; i < nTeams; i++) {
        let gradB = -lambdaReg * beta[i];
        let hessB = -lambdaReg;
        for (let m = 0; m < validMatches.length; m++) {
          const match = validMatches[m];
          const w = weights[m];
          const hi = teamIdx[match.homeTeam];
          const ai = teamIdx[match.awayTeam];

          if (ai === i) {
            // Team i is away defense against home attack
            const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
            gradB += w * (match.homeGoals - lh);
            hessB += -w * lh;
          } else if (hi === i) {
            // Team i is home defense against away attack
            const la = Math.exp(mu + alpha[ai] + beta[hi]);
            gradB += w * (match.awayGoals - la);
            hessB += -w * la;
          }
        }
        if (Math.abs(hessB) > 1e-12) beta[i] -= gradB / hessB;
      }

      // Identifiability constraint: sum(beta) = 0
      let sumBeta = 0;
      for (let i = 0; i < nTeams; i++) sumBeta += beta[i];
      const meanBeta = sumBeta / nTeams;
      for (let i = 0; i < nTeams; i++) beta[i] -= meanBeta;
      mu += meanBeta;
    }

    // 5. Profile Maximum Likelihood Estimation of low-score parameter rho
    let bestRho = -0.05;
    let bestLl = -Infinity;
    for (let r = -0.18; r <= 0.05; r += 0.01) {
      let ll = 0;
      let valid = true;
      for (let m = 0; m < validMatches.length; m++) {
        const match = validMatches[m];
        const hi = teamIdx[match.homeTeam];
        const ai = teamIdx[match.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
        const la = Math.exp(mu + alpha[ai] + beta[hi]);
        const x = match.homeGoals;
        const y = match.awayGoals;

        if (x <= 1 && y <= 1) {
          const tau = dixonColesTau(x, y, lh, la, r);
          if (tau <= 0) {
            valid = false;
            break;
          }
          ll += weights[m] * Math.log(tau);
        }
      }
      if (valid && ll > bestLl) {
        bestLl = ll;
        bestRho = Number(r.toFixed(3));
      }
    }

    const alphaMap: Record<string, number> = {};
    const betaMap: Record<string, number> = {};
    teams.forEach((t, i) => {
      alphaMap[t] = Number(alpha[i].toFixed(4));
      betaMap[t] = Number(beta[i].toFixed(4));
    });

    return {
      leagueId,
      referenceDate,
      mu: Number(mu.toFixed(4)),
      gamma: Number(gamma.toFixed(4)),
      alpha: alphaMap,
      beta: betaMap,
      rho: bestRho,
      nMatches: validMatches.length,
      nTeams,
    };
  }

  /**
   * Computes expected goal rates lambda_home and lambda_away from fitted model.
   */
  public static computeLambdas(
    homeTeam: string,
    awayTeam: string,
    model: FittedLeagueModel
  ): { homeLambda: number; awayLambda: number } {
    const alphaH = model.alpha[homeTeam] ?? 0.0;
    const betaA = model.beta[awayTeam] ?? 0.0;
    const alphaA = model.alpha[awayTeam] ?? 0.0;
    const betaH = model.beta[homeTeam] ?? 0.0;

    const rawHome = Math.exp(model.mu + model.gamma + alphaH + betaA);
    const rawAway = Math.exp(model.mu + alphaA + betaH);

    // Safeguard: clamp expected goals to [0.10, 8.00]
    const homeLambda = Math.max(0.10, Math.min(8.00, Number(rawHome.toFixed(4))));
    const awayLambda = Math.max(0.10, Math.min(8.00, Number(rawAway.toFixed(4))));

    return { homeLambda, awayLambda };
  }

  /**
   * Generates a fully normalized bivariate score distribution matrix up to maxGoals.
   * Satisfies: P(h,a) >= 0 and sum(P) == 1.0.
   */
  public static computeScoreDistribution(
    homeLambda: number,
    awayLambda: number,
    rho: number,
    maxGoals = 10
  ): BivariateScoreDistribution {
    const matrix: number[][] = [];
    let sum = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      const ph = poissonPdf(h, homeLambda);
      for (let a = 0; a <= maxGoals; a++) {
        const pa = poissonPdf(a, awayLambda);
        const tau = h <= 1 && a <= 1 ? dixonColesTau(h, a, homeLambda, awayLambda, rho) : 1.0;
        const p = Math.max(0, ph * pa * tau);
        matrix[h][a] = p;
        sum += p;
      }
    }

    // Explicit tail probability normalization
    if (sum > 0) {
      for (let h = 0; h <= maxGoals; h++) {
        for (let a = 0; a <= maxGoals; a++) {
          matrix[h][a] /= sum;
        }
      }
    }

    return {
      matrix,
      maxGoals,
      homeLambda,
      awayLambda,
      rho,
    };
  }

  /**
   * Computes Match Outcome 1X2 Probabilities directly from score distribution.
   */
  public static matrixToOutcomeProbabilities(
    scoreDist: BivariateScoreDistribution
  ): { pHomeWin: number; pDraw: number; pAwayWin: number } {
    let pHomeWin = 0;
    let pDraw = 0;
    let pAwayWin = 0;
    const maxGoals = scoreDist.maxGoals;

    for (let h = 0; h <= maxGoals; h++) {
      for (let a = 0; a <= maxGoals; a++) {
        const p = scoreDist.matrix[h][a];
        if (h > a) pHomeWin += p;
        else if (h === a) pDraw += p;
        else pAwayWin += p;
      }
    }

    const total = pHomeWin + pDraw + pAwayWin || 1.0;
    return {
      pHomeWin: Number((pHomeWin / total).toFixed(4)),
      pDraw: Number((pDraw / total).toFixed(4)),
      pAwayWin: Number((pAwayWin / total).toFixed(4)),
    };
  }
}

