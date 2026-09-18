import { describe, it, expect } from 'vitest';
import { IndependentPoissonModel } from '../../src/lib/research/probability/poissonModel';
import { GoalModelMatch } from '../../src/lib/research/probability/types';

describe('Phase 2: Independent Poisson Baseline Model Tests', () => {
  const sampleMatches: GoalModelMatch[] = [
    { matchId: 'm1', leagueId: 'ENG-PL', matchDate: '2025-09-01', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeGoals: 2, awayGoals: 1 },
    { matchId: 'm2', leagueId: 'ENG-PL', matchDate: '2025-09-08', homeTeam: 'Chelsea', awayTeam: 'Liverpool', homeGoals: 1, awayGoals: 1 },
    { matchId: 'm3', leagueId: 'ENG-PL', matchDate: '2025-09-15', homeTeam: 'Liverpool', awayTeam: 'Arsenal', homeGoals: 0, awayGoals: 2 },
    { matchId: 'm4', leagueId: 'ENG-PL', matchDate: '2025-09-22', homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeGoals: 3, awayGoals: 1 },
    { matchId: 'm5', leagueId: 'ENG-PL', matchDate: '2025-09-29', homeTeam: 'Chelsea', awayTeam: 'Arsenal', homeGoals: 0, awayGoals: 1 },
    { matchId: 'm6', leagueId: 'ENG-PL', matchDate: '2025-10-06', homeTeam: 'Liverpool', awayTeam: 'Chelsea', homeGoals: 2, awayGoals: 2 },
    { matchId: 'm7', leagueId: 'ENG-PL', matchDate: '2025-10-13', homeTeam: 'Arsenal', awayTeam: 'Chelsea', homeGoals: 1, awayGoals: 0 },
    { matchId: 'm8', leagueId: 'ENG-PL', matchDate: '2025-10-20', homeTeam: 'Chelsea', awayTeam: 'Liverpool', homeGoals: 2, awayGoals: 3 },
    { matchId: 'm9', leagueId: 'ENG-PL', matchDate: '2025-10-27', homeTeam: 'Liverpool', awayTeam: 'Arsenal', homeGoals: 1, awayGoals: 2 },
    { matchId: 'm10', leagueId: 'ENG-PL', matchDate: '2025-11-03', homeTeam: 'Arsenal', awayTeam: 'Liverpool', homeGoals: 2, awayGoals: 0 },
  ];

  it('1. Fits Poisson parameters strictly before referenceDate and enforces rho = 0', () => {
    const fitted = IndependentPoissonModel.fit(sampleMatches, 'ENG-PL', '2025-12-01');

    expect(fitted.modelType).toBe('POISSON');
    expect(fitted.rho).toBe(0.0); // Strictly zero
    expect(fitted.nMatches).toBe(10);
    expect(fitted.nTeams).toBe(3);
    expect(Number.isFinite(fitted.mu)).toBe(true);
    expect(Number.isFinite(fitted.gamma)).toBe(true);
  });

  it('2. Enforces strict anti-leakage: throws if matchDate >= referenceDate', () => {
    expect(() => {
      IndependentPoissonModel.fit(sampleMatches, 'ENG-PL', '2025-10-01');
    }).toThrow(/ANTI-LEAKAGE GUARD/);
  });

  it('3. Generates a normalized bivariate score matrix that sums to 1.0', () => {
    const fitted = IndependentPoissonModel.fit(sampleMatches, 'ENG-PL', '2025-12-01');
    const lambdas = IndependentPoissonModel.computeLambdas('Arsenal', 'Chelsea', fitted);

    expect(lambdas.homeLambda).toBeGreaterThan(0.1);
    expect(lambdas.awayLambda).toBeGreaterThan(0.1);

    const dist = IndependentPoissonModel.computeScoreDistribution(lambdas.homeLambda, lambdas.awayLambda, 8);

    let sum = 0;
    for (let h = 0; h <= dist.maxGoals; h++) {
      for (let a = 0; a <= dist.maxGoals; a++) {
        sum += dist.matrix[h][a];
      }
    }

    expect(Math.abs(sum - 1.0)).toBeLessThan(1e-5);
    expect(dist.rho).toBe(0.0);
  });
});

