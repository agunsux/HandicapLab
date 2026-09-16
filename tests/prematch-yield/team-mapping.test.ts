import { describe, it, expect } from 'vitest';
import { normalizeTeamName, joinFixtures, CanonicalGoldMatch, MatchCandidate } from '../../src/lib/research/prematch-yield/teamMapping';

describe('Prematch Yield Team Mapping & Fixture Join', () => {
  it('normalizes common EPL team alias strings accurately', () => {
    expect(normalizeTeamName('AFC Bournemouth')).toBe('bournemouth');
    expect(normalizeTeamName('Arsenal')).toBe('arsenal');
    expect(normalizeTeamName('Brighton & Hove Albion')).toBe('brighton');
    expect(normalizeTeamName('Manchester United')).toBe('man united');
    expect(normalizeTeamName('Manchester City')).toBe('man city');
    expect(normalizeTeamName('Nottingham Forest')).toBe("nott'm forest");
    expect(normalizeTeamName('Tottenham Hotspur')).toBe('tottenham');
    expect(normalizeTeamName('Wolverhampton Wanderers')).toBe('wolves');
  });

  it('joins fixtures deterministically on (season, normalized teams, date window)', () => {
    const goldMatches: CanonicalGoldMatch[] = [
      {
        canonicalId: 'ENG-PL|2024-2025|2024-08-16|man-united|fulham',
        leagueId: 'ENG-PL',
        season: '2024-2025',
        matchDate: '2024-08-16',
        homeTeam: 'Man United',
        awayTeam: 'Fulham',
        homeGoals: 1,
        awayGoals: 0,
        resultVerified: true,
      },
      {
        canonicalId: 'ENG-PL|2024-2025|2024-08-17|arsenal|wolves',
        leagueId: 'ENG-PL',
        season: '2024-2025',
        matchDate: '2024-08-17',
        homeTeam: 'Arsenal',
        awayTeam: 'Wolves',
        homeGoals: 2,
        awayGoals: 0,
        resultVerified: true,
      },
    ];

    const footyMatches: MatchCandidate[] = [
      {
        id: 101,
        home_name: 'Manchester United',
        away_name: 'Fulham',
        date_unix: 1723834800, // 2024-08-16
        status: 'complete',
      },
      {
        id: 102,
        home_name: 'Arsenal',
        away_name: 'Wolverhampton Wanderers',
        date_unix: 1723903200, // 2024-08-17
        status: 'complete',
      },
    ];

    const result = joinFixtures(footyMatches, goldMatches, '2024-2025');

    expect(result.canonicalEplFixtureCount).toBe(2);
    expect(result.footystatsFixtureCount).toBe(2);
    expect(result.successfulJoinCount).toBe(2);
    expect(result.joinRatePct).toBe(100);
    expect(result.unmatchedFootyStats.length).toBe(0);
    expect(result.unmatchedGold.length).toBe(0);
    expect(result.ambiguousMatches.length).toBe(0);
    expect(result.pairs[0].canonicalId).toBe('ENG-PL|2024-2025|2024-08-16|man-united|fulham');
    expect(result.pairs[1].canonicalId).toBe('ENG-PL|2024-2025|2024-08-17|arsenal|wolves');
  });

  it('handles unmatched fixtures and date shifts exceeding tolerance', () => {
    const goldMatches: CanonicalGoldMatch[] = [
      {
        canonicalId: 'ENG-PL|2024-2025|2024-08-16|man-united|fulham',
        leagueId: 'ENG-PL',
        season: '2024-2025',
        matchDate: '2024-08-16',
        homeTeam: 'Man United',
        awayTeam: 'Fulham',
        homeGoals: 1,
        awayGoals: 0,
        resultVerified: true,
      },
    ];

    const footyMatches: MatchCandidate[] = [
      {
        id: 999,
        home_name: 'Chelsea',
        away_name: 'Liverpool',
        date_unix: 1723834800,
        status: 'complete',
      },
    ];

    const result = joinFixtures(footyMatches, goldMatches, '2024-2025');
    expect(result.successfulJoinCount).toBe(0);
    expect(result.joinRatePct).toBe(0);
    expect(result.unmatchedFootyStats.length).toBe(1);
    expect(result.unmatchedGold).toContain('ENG-PL|2024-2025|2024-08-16|man-united|fulham');
  });
});

