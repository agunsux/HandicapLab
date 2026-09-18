// ============================================================================
// DIXON-COLES GOAL DISTRIBUTION MODEL (DYNAMIC RHO PROFILE MLE)
// ============================================================================
// Location: src/lib/research/probability/dixonColesModel.ts
//
// Implements the Dixon & Coles (1997) bivariate model with dynamic estimation:
//   - Identifiability constraints: sum(alpha) = 0, sum(beta) = 0
//   - Dynamic low-score correlation rho fitted via Profile MLE (never hardcoded)
//   - Supports both Flat Dixon-Coles and Hierarchical (regularized + time decay)
//   - Zero future leakage: matches strictly before referenceDate
// ============================================================================

import {
  GoalModelMatch,
  BivariateScoreDistribution,
  FittedModelParameters,
} from './types';
import { poissonPmf } from './poissonModel';

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

export interface DixonColesOptions {
  hierarchical?: boolean; // true for time decay & L2 regularization
  xi?: number;            // time decay constant (default 0.0018 => ~385 day half-life)
  lambdaReg?: number;     // L2 regularization penalty (default 2.0 for hierarchical, 0.0 for flat)
  maxIter?: number;       // iterations (default 35)
}

export class DixonColesModel {
  /**
   * Fits Dixon-Coles goal model parameters strictly before referenceDate.
   * rho is dynamically fitted via Profile MLE across [-0.20, 0.10].
   */
  public static fit(
    matches: GoalModelMatch[],
    leagueId: string,
    referenceDate: string,
    options: DixonColesOptions = {}
  ): FittedModelParameters {
    const isHierarchical = options.hierarchical ?? false;
    const xi = isHierarchical ? (options.xi ?? 0.0018) : 0.0;
    const lambdaReg = isHierarchical ? (options.lambdaReg ?? 2.0) : 0.0;
    const maxIter = options.maxIter ?? 35;

    // Strict Anti-Leakage Guard
    const validMatches = matches.filter((m) => {
      if (m.matchDate >= referenceDate) {
        throw new Error(
          `[ANTI-LEAKAGE GUARD] Match ${m.matchId} (${m.matchDate}) >= referenceDate (${referenceDate})`
        );
      }
      return m.leagueId === leagueId;
    });

    const teams = Array.from(
      new Set(validMatches.flatMap((m) => [m.homeTeam, m.awayTeam]))
    ).sort();
    const nTeams = teams.length;

    if (validMatches.length < 10 || nTeams < 2) {
      return {
        modelType: isHierarchical ? 'DIXON_COLES_HIERARCHICAL' : 'DIXON_COLES_FLAT',
        leagueId,
        referenceDate,
        mu: Math.log(1.3),
        gamma: 0.2,
        alpha: {},
        beta: {},
        rho: -0.05,
        nMatches: validMatches.length,
        nTeams,
      };
    }

    const teamIdx: Record<string, number> = {};
    teams.forEach((t, i) => (teamIdx[t] = i));

    // Weights calculation (exponential time decay if hierarchical)
    const refMs = Date.parse(referenceDate);
    const weights = new Float64Array(validMatches.length);
    for (let m = 0; m < validMatches.length; m++) {
      if (xi > 0 && Number.isFinite(refMs)) {
        const mMs = Date.parse(validMatches[m].matchDate);
        const days = Math.max(0, (refMs - mMs) / (1000 * 3600 * 24));
        weights[m] = Math.exp(-xi * days);
      } else {
        weights[m] = 1.0;
      }
    }

    let mu = Math.log(1.30);
    let gamma = 0.20;
    const alpha = new Float64Array(nTeams);
    const beta = new Float64Array(nTeams);

    // Coordinate Newton-Raphson Optimization
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
        gradMu += w * ((match.homeGoals - lh) + (match.awayGoals - la));
        hessMu += -w * (lh + la);
      }
      if (Math.abs(hessMu) > 1e-12) mu -= gradMu / hessMu;

      // 2. Update home advantage gamma
      let gradG = 0;
      let hessG = 0;
      for (let m = 0; m < validMatches.length; m++) {
        const match = validMatches[m];
        const w = weights[m];
        const hi = teamIdx[match.homeTeam];
        const ai = teamIdx[match.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
        gradG += w * (match.homeGoals - lh);
        hessG += -w * lh;
      }
      if (Math.abs(hessG) > 1e-12) gamma -= gradG / hessG;

      // 3. Update attack parameters alpha
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
      let sumA = 0;
      for (let i = 0; i < nTeams; i++) sumA += alpha[i];
      const meanA = sumA / nTeams;
      for (let i = 0; i < nTeams; i++) alpha[i] -= meanA;
      mu += meanA;

      // 4. Update defense parameters beta
      for (let i = 0; i < nTeams; i++) {
        let gradB = -lambdaReg * beta[i];
        let hessB = -lambdaReg;
        for (let m = 0; m < validMatches.length; m++) {
          const match = validMatches[m];
          const w = weights[m];
          const hi = teamIdx[match.homeTeam];
          const ai = teamIdx[match.awayTeam];
          if (ai === i) {
            const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
            gradB += w * (match.homeGoals - lh);
            hessB += -w * lh;
          } else if (hi === i) {
            const la = Math.exp(mu + alpha[ai] + beta[hi]);
            gradB += w * (match.awayGoals - la);
            hessB += -w * la;
          }
        }
        if (Math.abs(hessB) > 1e-12) beta[i] -= gradB / hessB;
      }

      // Identifiability constraint: sum(beta) = 0
      let sumB = 0;
      for (let i = 0; i < nTeams; i++) sumB += beta[i];
      const meanB = sumB / nTeams;
      for (let i = 0; i < nTeams; i++) beta[i] -= meanB;
      mu += meanB;
    }

    // 5. Dynamic Profile Maximum Likelihood Estimation for rho
    // NEVER hardcoded! Grid search across [-0.20, 0.10]
    let bestRho = -0.05;
    let bestLl = -Infinity;

    for (let r = -0.20; r <= 0.10; r += 0.01) {
      const rhoCandidate = Number(r.toFixed(3));
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
          const tau = dixonColesTau(x, y, lh, la, rhoCandidate);
          if (tau <= 0) {
            valid = false;
            break;
          }
          ll += weights[m] * Math.log(tau);
        }
      }

      if (valid && ll > bestLl) {
        bestLl = ll;
        bestRho = rhoCandidate;
      }
    }

    const alphaMap: Record<string, number> = {};
    const betaMap: Record<string, number> = {};
    teams.forEach((t, i) => {
      alphaMap[t] = Number(alpha[i].toFixed(4));
      betaMap[t] = Number(beta[i].toFixed(4));
    });

    return {
      modelType: isHierarchical ? 'DIXON_COLES_HIERARCHICAL' : 'DIXON_COLES_FLAT',
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
   * Computes expected goal rates lambda_H and lambda_A.
   */
  public static computeLambdas(
    homeTeam: string,
    awayTeam: string,
    params: FittedModelParameters
  ): { homeLambda: number; awayLambda: number } {
    const aH = params.alpha[homeTeam] ?? 0.0;
    const bA = params.beta[awayTeam] ?? 0.0;
    const aA = params.alpha[awayTeam] ?? 0.0;
    const bH = params.beta[homeTeam] ?? 0.0;

    const rawH = Math.exp(params.mu + params.gamma + aH + bA);
    const rawA = Math.exp(params.mu + aA + bH);

    const homeLambda = Math.max(0.10, Math.min(8.00, Number(rawH.toFixed(4))));
    const awayLambda = Math.max(0.10, Math.min(8.00, Number(rawA.toFixed(4))));

    return { homeLambda, awayLambda };
  }

  /**
   * Computes full normalized bivariate score distribution with fitted rho tau adjustment.
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
      const ph = poissonPmf(h, homeLambda);
      for (let a = 0; a <= maxGoals; a++) {
        const pa = poissonPmf(a, awayLambda);
        const tau = h <= 1 && a <= 1 ? dixonColesTau(h, a, homeLambda, awayLambda, rho) : 1.0;
        const p = Math.max(0, ph * pa * tau);
        matrix[h][a] = p;
        sum += p;
      }
    }

    // Exact tail normalization
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
      sum: 1.0,
    };
  }
}

