import { describe, it, expect } from 'vitest';
import { AhSharedStateEngine } from '../src/lib/research/ah-solo/ahSharedState';
import { CanonicalMatch } from '../src/lib/research/ah-solo/ahTypes';

describe('EPIC 56: Anti-Leakage & Point-in-Time Football State', () => {
  const baseMatches: CanonicalMatch[] = [
    {
      canonicalId: 'M1',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2020-2021',
      matchDate: '2020-09-12',
      homeTeam: 'Arsenal',
      awayTeam: 'Fulham',
      homeGoals: 3,
      awayGoals: 0,
      result: 'H',
      resultVerified: true,
      totalGoals: 3,
    },
    {
      canonicalId: 'M2',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2020-2021',
      matchDate: '2020-09-19',
      homeTeam: 'Arsenal',
      awayTeam: 'West Ham',
      homeGoals: 2,
      awayGoals: 1,
      result: 'H',
      resultVerified: true,
      totalGoals: 3,
    },
  ];

  const targetMatch: CanonicalMatch = {
    canonicalId: 'TARGET',
    leagueId: 'ENG-PL',
    cluster: 'A',
    season: '2020-2021',
    matchDate: '2020-09-28',
    homeTeam: 'Liverpool',
    awayTeam: 'Arsenal',
    homeGoals: 3,
    awayGoals: 1,
    result: 'H',
    resultVerified: true,
    totalGoals: 4,
  };

  it('computes state strictly before target match date', () => {
    const state = AhSharedStateEngine.computeState(targetMatch, baseMatches);
    expect(state.expectedHomeGoals).toBeGreaterThan(0.5);
    expect(state.expectedAwayGoals).toBeGreaterThan(0.5);
    expect(state.homeAttack).toBeGreaterThan(0);
    expect(state.awayDefense).toBeGreaterThan(0);
  });

  it('proves zero leakage when future matches are injected into warehouse', () => {
    const stateBefore = AhSharedStateEngine.computeState(targetMatch, baseMatches);

    // Injected adversarial future match happening AFTER targetMatch
    const futureAdversarialMatch: CanonicalMatch = {
      canonicalId: 'FUTURE_LEAK',
      leagueId: 'ENG-PL',
      cluster: 'A',
      season: '2020-2021',
      matchDate: '2020-10-04',
      homeTeam: 'Arsenal',
      awayTeam: 'Sheffield United',
      homeGoals: 9,
      awayGoals: 0,
      result: 'H',
      resultVerified: true,
      totalGoals: 9,
    };

    const contaminatedMatches = [...baseMatches, futureAdversarialMatch];
    const stateAfter = AhSharedStateEngine.computeState(targetMatch, contaminatedMatches);

    // State vectors must remain identical bitwise
    expect(stateAfter.expectedHomeGoals).toBe(stateBefore.expectedHomeGoals);
    expect(stateAfter.expectedAwayGoals).toBe(stateBefore.expectedAwayGoals);
    expect(stateAfter.awayAttack).toBe(stateBefore.awayAttack);
    expect(stateAfter.awayDefense).toBe(stateBefore.awayDefense);
  });
});
