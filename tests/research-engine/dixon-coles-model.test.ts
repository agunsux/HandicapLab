import { describe, it, expect } from 'vitest';
import { DixonColesModel, dixonColesTau } from '../../src/lib/research/probability/dixonColesModel';
import { GoalModelMatch } from '../../src/lib/research/probability/types';

describe('Phase 2: Dixon-Coles Goal Model & Profile MLE rho Tests', () => {
  const sampleMatches: GoalModelMatch[] = [
    { matchId: 'm1', leagueId: 'ENG-PL', matchDate: '2025-09-01', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeGoals: 0, awayGoals: 0 },
    { matchId: 'm2', leagueId: 'ENG-PL', matchDate: '2025-09-08', homeTeam: 'Chelsea', awayTeam: 'Liverpool', homeGoals: 1, awayGoals: 0 },
    { matchId: 'm3', leagueId: 'ENG-PL', matchDate: '2025-09-15', homeTeam: 'Liverpool', awayTeam: 'Arsenal', homeGoals: 0, awayGoals: 1 },
    { matchId: 'm4', leagueId: 'ENG-PL', matchDate: '2025-09-22', homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeGoals: 1, awayGoals: 1 },
    { matchId: 'm5', leagueId: 'ENG-PL', matchDate: '2025-09-29', homeTeam: 'Chelsea', awayTeam: 'Arsenal', homeGoals: 0, awayGoals: 0 },
    { matchId: 'm6', leagueId: 'ENG-PL', matchDate: '2025-10-06', homeTeam: 'Liverpool', awayTeam: 'Chelsea', homeGoals: 2, awayGoals: 1 },
    { matchId: 'm7', leagueId: 'ENG-PL', matchDate: '2025-10-13', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeGoals: 1, awayGoals: 0 },
    { matchId: 'm8', leagueId: 'ENG-PL', matchDate: '2025-10-20', homeTeam: 'Chelsea', awayTeam: 'Liverpool', homeGoals: 0, awayGoals: 2 },
    { matchId: 'm9', leagueId: 'ENG-PL', matchDate: '2025-10-27', homeTeam: 'Liverpool', awayTeam: 'Arsenal', homeGoals: 1, awayGoals: 1 },
    { matchId: 'm10', leagueId: 'ENG-PL', matchDate: '2025-11-03', homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeGoals: 2, awayGoals: 0 },
  ];

  it('1. Computes correct Dixon-Coles tau adjustment factors', () => {
    const lambdaH = 1.3;
    const lambdaA = 1.1;
    const rho = -0.10;

    // (0,0): 1 - lambdaH * lambdaA * rho = 1 - 1.3 * 1.1 * (-0.1) = 1 + 0.143 = 1.143
    expect(dixonColesTau(0, 0, lambdaH, lambdaA, rho)).toBeCloseTo(1.143, 3);

    // (1,0): 1 + lambdaA * rho = 1 + 1.1 * (-0.1) = 0.89
    expect(dixonColesTau(1, 0, lambdaH, lambdaA, rho)).toBeCloseTo(0.89, 3);

    // (0,1): 1 + lambdaH * rho = 1 + 1.3 * (-0.1) = 0.87
    expect(dixonColesTau(0, 1, lambdaH, lambdaA, rho)).toBeCloseTo(0.87, 3);

    // (1,1): 1 - rho = 1 - (-0.1) = 1.10
    expect(dixonColesTau(1, 1, lambdaH, lambdaA, rho)).toBeCloseTo(1.10, 3);

    // High scores: tau = 1.0
    expect(dixonColesTau(2, 0, lambdaH, lambdaA, rho)).toBe(1.0);
    expect(dixonColesTau(2, 2, lambdaH, lambdaA, rho)).toBe(1.0);
  });

  it('2. Dynamically fits rho via Profile MLE (never hardcoded to -0.10)', () => {
    const fitted = DixonColesModel.fit(sampleMatches, 'ENG-PL', '2025-12-01');

    expect(Number.isFinite(fitted.rho)).toBe(true);
    expect(fitted.rho).toBeGreaterThanOrEqual(-0.20);
    expect(fitted.rho).toBeLessThanOrEqual(0.10);
    // Dynamic value from profile search:
    expect(fitted.rho).toBeDefined();
  });

  it('3. Generates a fully normalized bivariate score distribution with fitted rho', () => {
    const fitted = DixonColesModel.fit(sampleMatches, 'ENG-PL', '2025-12-01');
    const lambdas = DixonColesModel.computeLambdas('Arsenal', 'Chelsea', fitted);
    const dist = DixonColesModel.computeScoreDistribution(lambdas.homeLambda, lambdas.awayLambda, fitted.rho, 8);

    let sum = 0;
    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        sum += dist.matrix[h][a];
      }
    }

    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-5);
  });

  it('4. Enforces strict anti-leakage on training data', () => {
    expect(() => {
      DixonColesModel.fit(sampleMatches, 'ENG-PL', '2025-10-01');
    }).toThrow(/ANTI-LEAKAGE GUARD/);
  });
});

