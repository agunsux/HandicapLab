// Fixture Matcher for mapping external odds to canonical database fixtures
// Location: src/lib/data/fixtureMatcher.ts

import { TeamNormalizer } from './teamNormalizer';

export interface MatchEntity {
  id: string;
  home_team: string;
  away_team: string;
  kickoff: Date | string;
  league: string;
  competition_id?: number;
  external_match_id?: string;
}

export class FixtureMatcher {
  /**
   * Matches an incoming odds match representation to a canonical fixture from a list.
   * Tolerates kickoff variations within 24 hours.
   */
  public static findMatch<T extends MatchEntity>(
    fixtures: T[],
    target: {
      fixtureId?: string | number;
      homeTeam: string;
      awayTeam: string;
      kickoff: Date | string | number;
      league?: string;
    }
  ): T | null {
    // 1. Direct ID matching (if ID is available and matches)
    if (target.fixtureId) {
      const match = fixtures.find(
        f => 
          f.id === String(target.fixtureId) || 
          f.external_match_id === String(target.fixtureId)
      );
      if (match) return match;
    }

    // Convert target kickoff to timestamp
    const targetTime = this.getTimestamp(target.kickoff);
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;

    const normTargetHome = TeamNormalizer.normalize(target.homeTeam);
    const normTargetAway = TeamNormalizer.normalize(target.awayTeam);

    for (const f of fixtures) {
      // 2. Normalize and check team names
      const normHome = TeamNormalizer.normalize(f.home_team);
      const normAway = TeamNormalizer.normalize(f.away_team);

      // Verify home-home and away-away equivalence
      const teamsMatch = normHome === normTargetHome && normAway === normTargetAway;
      
      // Also check neutral/swapped venues just in case
      const swappedTeamsMatch = normHome === normTargetAway && normAway === normTargetHome;

      if (teamsMatch || swappedTeamsMatch) {
        // 3. Kickoff tolerance check (within 24 hours)
        const fixtureTime = this.getTimestamp(f.kickoff);
        const timeDelta = Math.abs(fixtureTime - targetTime);

        if (timeDelta <= ONE_DAY_MS) {
          return f;
        }
      }
    }

    return null;
  }

  private static getTimestamp(val: Date | string | number): number {
    if (val instanceof Date) return val.getTime();
    if (typeof val === 'number') {
      // Check if it's unix epoch in seconds
      return val < 9999999999 ? val * 1000 : val;
    }
    return new Date(val).getTime();
  }
}
