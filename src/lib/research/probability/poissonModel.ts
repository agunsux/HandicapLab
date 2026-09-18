// ============================================================================
// INDEPENDENT POISSON BASELINE GOAL MODEL
// ============================================================================
// Location: src/lib/research/probability/poissonModel.ts
//
// Baseline model assuming independence between home and away scores:
//   P(Home = h, Away = a) = Poisson(h; lambda_H) * Poisson(a; lambda_A)
//   rho = 0.0 (strictly zero low-score correlation)
//
// Guarantees:
//   1. Strict Anti-Leakage: matchDate < referenceDate enforced.
//   2. Identifiability Constraints: sum(alpha) = 0, sum(beta) = 0.
//   3. Exact Normalization: sum(matrix) == 1.0.
// ============================================================================

import {
  GoalModelMatch,
  BivariateScoreDistribution,
  FittedModelParameters,
} from './types';

export function factorial(n: number): number {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

export function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  return (Math.pow(lambda, k) * Math.exp(-lambda)) / factorial(k);
}

export class IndependentPoissonModel {
  /**
   * Fits standard independent Poisson goal parameters strictly before referenceDate.
   */
  public static fit(
    matches: GoalModelMatch[],
    leagueId: string,
    referenceDate: string,
    maxIter = 30
  ): FittedModelParameters {
    // 1. Strict Anti-Leakage Filter
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
        modelType: 'POISSON',
        leagueId,
        referenceDate,
        mu: Math.log(1.3),
        gamma: 0.2,
        alpha: {},
        beta: {},
        rho: 0.0,
        nMatches: validMatches.length,
        nTeams,
      };
    }

    const teamIdx: Record<string, number> = {};
    teams.forEach((t, i) => (teamIdx[t] = i));

    let mu = Math.log(1.25);
    let gamma = 0.20;
    const alpha = new Float64Array(nTeams);
    const beta = new Float64Array(nTeams);

    // Iterative Newton-Raphson / Coordinate Descent for standard Poisson MLE
    for (let iter = 0; iter < maxIter; iter++) {
      // 1. Update mu
      let gradMu = 0;
      let hessMu = 0;
      for (const m of validMatches) {
        const hi = teamIdx[m.homeTeam];
        const ai = teamIdx[m.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
        const la = Math.exp(mu + alpha[ai] + beta[hi]);
        gradMu += (m.homeGoals - lh) + (m.awayGoals - la);
        hessMu += -(lh + la);
      }
      if (Math.abs(hessMu) > 1e-12) mu -= gradMu / hessMu;

      // 2. Update gamma (home advantage)
      let gradG = 0;
      let hessG = 0;
      for (const m of validMatches) {
        const hi = teamIdx[m.homeTeam];
        const ai = teamIdx[m.awayTeam];
        const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
        gradG += m.homeGoals - lh;
        hessG += -lh;
      }
      if (Math.abs(hessG) > 1e-12) gamma -= gradG / hessG;

      // 3. Update alpha (attack)
      for (let i = 0; i < nTeams; i++) {
        let gradA = 0;
        let hessA = 0;
        for (const m of validMatches) {
          const hi = teamIdx[m.homeTeam];
          const ai = teamIdx[m.awayTeam];
          if (hi === i) {
            const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
            gradA += m.homeGoals - lh;
            hessA += -lh;
          } else if (ai === i) {
            const la = Math.exp(mu + alpha[ai] + beta[hi]);
            gradA += m.awayGoals - la;
            hessA += -la;
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

      // 4. Update beta (defense)
      for (let i = 0; i < nTeams; i++) {
        let gradB = 0;
        let hessB = 0;
        for (const m of validMatches) {
          const hi = teamIdx[m.homeTeam];
          const ai = teamIdx[m.awayTeam];
          if (ai === i) {
            const lh = Math.exp(mu + gamma + alpha[hi] + beta[ai]);
            gradB += m.homeGoals - lh;
            hessB += -lh;
          } else if (hi === i) {
            const la = Math.exp(mu + alpha[ai] + beta[hi]);
            gradB += m.awayGoals - la;
            hessB += -la;
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

    const alphaMap: Record<string, number> = {};
    const betaMap: Record<string, number> = {};
    teams.forEach((t, i) => {
      alphaMap[t] = Number(alpha[i].toFixed(4));
      betaMap[t] = Number(beta[i].toFixed(4));
    });

    return {
      modelType: 'POISSON',
      leagueId,
      referenceDate,
      mu: Number(mu.toFixed(4)),
      gamma: Number(gamma.toFixed(4)),
      alpha: alphaMap,
      beta: betaMap,
      rho: 0.0, // Strictly 0.0 for independent Poisson
      nMatches: validMatches.length,
      nTeams,
    };
  }

  /**
   * Computes expected goal rates lambda_H and lambda_A for a matchup.
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

    // Safeguard bounds [0.10, 8.00]
    const homeLambda = Math.max(0.10, Math.min(8.00, Number(rawH.toFixed(4))));
    const awayLambda = Math.max(0.10, Math.min(8.00, Number(rawA.toFixed(4))));

    return { homeLambda, awayLambda };
  }

  /**
   * Computes exact bivariate score distribution matrix up to maxGoals.
   */
  public static computeScoreDistribution(
    homeLambda: number,
    awayLambda: number,
    maxGoals = 10
  ): BivariateScoreDistribution {
    const matrix: number[][] = [];
    let sum = 0;

    for (let h = 0; h <= maxGoals; h++) {
      matrix[h] = [];
      const ph = poissonPmf(h, homeLambda);
      for (let a = 0; a <= maxGoals; a++) {
        const pa = poissonPmf(a, awayLambda);
        const p = ph * pa; // strictly independent
        matrix[h][a] = p;
        sum += p;
      }
    }

    // Exact tail renormalization
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
      rho: 0.0,
      sum: 1.0,
    };
  }
}

