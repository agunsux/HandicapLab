import { describe, it, expect } from 'vitest';
import { computePointInTimeFeatures } from '../../src/lib/research/ah-edge/edgeFeatures';
import type { EdgeMatch } from '../../src/lib/research/ah-edge/edgeTypes';
import { makeEdgeMatch } from './helpers';

function teamMatch(overrides: Partial<EdgeMatch> & { homeTeam: string; awayTeam: string; matchDate: string }): EdgeMatch {
  return makeEdgeMatch({ canonicalId: `${overrides.matchDate}|${overrides.homeTeam}|${overrides.awayTeam}`, ...overrides });
}

describe('Point-in-time features (temporal integrity)', () => {
  it('first match sees default Elo and zero form; later matches see the update', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B', homeGoals: 2, awayGoals: 0 }),
      teamMatch({ matchDate: '2021-01-08', homeTeam: 'A', awayTeam: 'B', homeGoals: 1, awayGoals: 1 }),
    ];
    computePointInTimeFeatures(matches);

    expect(matches[0].features.eloHome).toBe(1500);
    expect(matches[0].features.eloAway).toBe(1500);
    expect(matches[0].features.homePpg5).toBe(0);
    expect(matches[0].features.leagueHomeGoalsPerMatch).toBeCloseTo(1.5, 6);
    expect(matches[0].features.leagueAwayGoalsPerMatch).toBeCloseTo(1.15, 6);

    // After A beats B, A's Elo must rise above 1500 and B's must fall.
    expect(matches[1].features.eloHome).toBeGreaterThan(1500);
    expect(matches[1].features.eloAway).toBeLessThan(1500);
    // A's form: one win => 3 points per game; B lost => 0.
    expect(matches[1].features.homePpg5).toBeCloseTo(3, 10);
    expect(matches[1].features.awayPpg5).toBeCloseTo(0, 10);
    // League context after one match: home 2 goals, away 0.
    expect(matches[1].features.leagueHomeGoalsPerMatch).toBeCloseTo(2, 10);
    expect(matches[1].features.leagueAwayGoalsPerMatch).toBeCloseTo(0, 10);
  });

  it('same-day matches cannot see each other', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B', homeGoals: 3, awayGoals: 0 }),
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'C', awayTeam: 'D', homeGoals: 0, awayGoals: 2 }),
      teamMatch({ matchDate: '2021-01-02', homeTeam: 'A', awayTeam: 'D' }),
    ];
    computePointInTimeFeatures(matches);

    // Both first-day matches start from defaults, regardless of processing order.
    expect(matches[0].features.eloHome).toBe(1500);
    expect(matches[0].features.homePpg5).toBe(0);
    expect(matches[1].features.eloHome).toBe(1500);
    expect(matches[1].features.homePpg5).toBe(0);
    // Same-day results are visible the NEXT day: A won, D won.
    expect(matches[2].features.homePpg5).toBeCloseTo(3, 10);
    expect(matches[2].features.awayPpg5).toBeCloseTo(3, 10);
  });

  it('feature-flip test: changing a future result does not change earlier features', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B', homeGoals: 2, awayGoals: 0 }),
      teamMatch({ matchDate: '2021-01-05', homeTeam: 'B', awayTeam: 'C', homeGoals: 1, awayGoals: 1 }),
      teamMatch({ matchDate: '2021-01-10', homeTeam: 'A', awayTeam: 'C', homeGoals: 0, awayGoals: 1 }),
      teamMatch({ matchDate: '2021-01-15', homeTeam: 'B', awayTeam: 'A', homeGoals: 3, awayGoals: 3 }),
    ];
    computePointInTimeFeatures(matches);
    const before = matches.slice(0, 3).map((m) => JSON.stringify(m.features));

    // Flip the FUTURE result (last match).
    matches[3].homeGoals = 0;
    matches[3].awayGoals = 5;
    computePointInTimeFeatures(matches);

    const after = matches.slice(0, 3).map((m) => JSON.stringify(m.features));
    expect(after).toEqual(before);
  });

  it('same-date feature-flip: changing one same-day result does not change the other same-day features', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B', homeGoals: 2, awayGoals: 0 }),
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'C', awayTeam: 'D', homeGoals: 0, awayGoals: 2 }),
    ];
    computePointInTimeFeatures(matches);
    const first = JSON.stringify(matches[0].features);
    matches[1].homeGoals = 4;
    matches[1].awayGoals = 1;
    computePointInTimeFeatures(matches);
    expect(JSON.stringify(matches[0].features)).toBe(first);
  });

  it('Elo arithmetic follows the documented update rule', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B', homeGoals: 1, awayGoals: 0 }),
    ];
    computePointInTimeFeatures(matches);
    // Expected home score with 1500 vs 1500 and HA=60: 1 / (1 + 10^(-60/400))
    const expectedHome = 1 / (1 + 10 ** (-60 / 400));
    const delta = 20 * (1 - expectedHome);
    // Features are captured BEFORE the update, so assert the update via a follow-up match.
    const followUp = teamMatch({ matchDate: '2021-01-08', homeTeam: 'A', awayTeam: 'C' });
    computePointInTimeFeatures([...matches, followUp]);
    expect(followUp.features.eloHome).toBeCloseTo(1500 + delta, 6);
  });

  it('rest days are capped and derived from the previous match date', () => {
    const matches = [
      teamMatch({ matchDate: '2021-01-01', homeTeam: 'A', awayTeam: 'B' }),
      teamMatch({ matchDate: '2021-01-04', homeTeam: 'A', awayTeam: 'B' }),
    ];
    computePointInTimeFeatures(matches);
    expect(matches[1].features.homeRestDays).toBe(3);
    expect(matches[1].features.awayRestDays).toBe(3);
    expect(matches[0].features.homeRestDays).toBe(30);
  });
});
