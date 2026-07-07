// HandicapLab Live Data Platform - Time Travel Engine
// Location: src/lib/data-platform/timeTravel.ts

import * as path from 'path';
import { ParquetHelper } from './parquetHelper';
import { GoldDatasetBuilder } from './goldDatasetBuilder';
import {
  CanonicalFixture,
  CanonicalOdds,
  CanonicalLineup,
  CanonicalInjury,
  CanonicalReferee,
  CanonicalTeamStats
} from './canonicalModel';

export class TimeTravelSnapshot {
  private static cachedFixtures: CanonicalFixture[] | null = null;
  private static cachedOddsOpen: CanonicalOdds[] | null = null;
  private static cachedOddsClose: CanonicalOdds[] | null = null;
  private static cachedLineups: CanonicalLineup[] | null = null;
  private static cachedInjuries: CanonicalInjury[] | null = null;
  private static cachedStandings: any[] | null = null;
  private static cachedElo: any[] | null = null;
  private static cachedReferees: CanonicalReferee[] | null = null;
  private static cachedTeamStats: CanonicalTeamStats[] | null = null;

  public static clearCache(): void {
    this.cachedFixtures = null;
    this.cachedOddsOpen = null;
    this.cachedOddsClose = null;
    this.cachedLineups = null;
    this.cachedInjuries = null;
    this.cachedStandings = null;
    this.cachedElo = null;
    this.cachedReferees = null;
    this.cachedTeamStats = null;
  }

  private cutoffDate: Date;
  private goldDir: string;

  private get fixtures(): CanonicalFixture[] {
    return TimeTravelSnapshot.cachedFixtures || [];
  }
  private get oddsOpen(): CanonicalOdds[] {
    return TimeTravelSnapshot.cachedOddsOpen || [];
  }
  private get oddsClose(): CanonicalOdds[] {
    return TimeTravelSnapshot.cachedOddsClose || [];
  }
  private get lineups(): CanonicalLineup[] {
    return TimeTravelSnapshot.cachedLineups || [];
  }
  private get injuries(): CanonicalInjury[] {
    return TimeTravelSnapshot.cachedInjuries || [];
  }
  private get standings(): any[] {
    return TimeTravelSnapshot.cachedStandings || [];
  }
  private get elo(): any[] {
    return TimeTravelSnapshot.cachedElo || [];
  }
  private get referees(): CanonicalReferee[] {
    return TimeTravelSnapshot.cachedReferees || [];
  }
  private get teamStats(): CanonicalTeamStats[] {
    return TimeTravelSnapshot.cachedTeamStats || [];
  }

  constructor(cutoffDate: Date, goldDir = GoldDatasetBuilder.getTargetDir()) {
    this.cutoffDate = cutoffDate;
    this.goldDir = goldDir;

    // Initialization must now happen via loadCache before instantiating.
  }

  public static async loadCache(goldDir: string): Promise<void> {
    if (!TimeTravelSnapshot.cachedFixtures) {
      TimeTravelSnapshot.cachedFixtures = await ParquetHelper.read(path.join(goldDir, 'fixtures.parquet'));
      TimeTravelSnapshot.cachedOddsOpen = await ParquetHelper.read(path.join(goldDir, 'odds_open.parquet'));
      TimeTravelSnapshot.cachedOddsClose = await ParquetHelper.read(path.join(goldDir, 'odds_close.parquet'));
      TimeTravelSnapshot.cachedLineups = await ParquetHelper.read(path.join(goldDir, 'lineups.parquet'));
      TimeTravelSnapshot.cachedInjuries = await ParquetHelper.read(path.join(goldDir, 'injuries.parquet'));
      TimeTravelSnapshot.cachedStandings = await ParquetHelper.read(path.join(goldDir, 'standings.parquet'));
      TimeTravelSnapshot.cachedElo = await ParquetHelper.read(path.join(goldDir, 'elo.parquet'));
      TimeTravelSnapshot.cachedReferees = await ParquetHelper.read(path.join(goldDir, 'referees.parquet'));
      TimeTravelSnapshot.cachedTeamStats = await ParquetHelper.read(path.join(goldDir, 'team_stats.parquet'));
    }
  }

  /**
   * Returns all fixtures, but strictly masks/deletes full-time scores & results for fixtures played at or after the cutoff time.
   */
  public getFixtures(): CanonicalFixture[] {
    return this.fixtures.map((f) => {
      const kickoff = new Date(f.kickoff);
      if (kickoff.getTime() >= this.cutoffDate.getTime()) {
        // Lookahead leakage check: mask all scores and results
        return {
          ...f,
          home_goals: null,
          away_goals: null,
          status: 'SCHEDULED'
        };
      }
      return f;
    });
  }

  /**
   * Gets the ELO rating for a team strictly before cutoffDate (meaning it only knows outcomes of matches finished before this date).
   */
  public getElo(teamName: string): number {
    const teamElos = this.elo
      .filter((e) => e.teamName === teamName && new Date(e.date).getTime() < this.cutoffDate.getTime())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (teamElos.length === 0) return 1500;
    return teamElos[0].elo;
  }

  /**
   * Gets team standing statistics strictly before cutoffDate.
   */
  public getStanding(teamName: string): {
    played: number;
    won: number;
    drawn: number;
    lost: number;
    goalsFor: number;
    goalsAgainst: number;
    points: number;
  } {
    const teamStandings = this.standings
      .filter((s) => s.teamName === teamName && new Date(s.date).getTime() < this.cutoffDate.getTime())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    if (teamStandings.length === 0) {
      return { played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0, points: 0 };
    }
    const latest = teamStandings[0];
    return {
      played: latest.played,
      won: latest.won,
      drawn: latest.drawn,
      lost: latest.lost,
      goalsFor: latest.goalsFor,
      goalsAgainst: latest.goalsAgainst,
      points: latest.points
    };
  }

  /**
   * Returns active injuries for a team before cutoffDate.
   */
  public getInjuries(teamName: string): CanonicalInjury[] {
    // Keep only injuries for matches played before cutoff date
    return this.injuries.filter((inj) => {
      const parentFixture = this.fixtures.find((f) => f.match_id === inj.fixtureId);
      if (!parentFixture) return false;
      const kickoff = new Date(parentFixture.kickoff);
      
      // Match of injury must be before cutoff
      if (kickoff.getTime() >= this.cutoffDate.getTime()) return false;
      
      const teamMatch = inj.teamId === fixtureTeamId(teamName);
      if (!teamMatch) return false;
      
      // Still active: cutoff date is before expectedReturnDate
      if (inj.expectedReturnDate) {
        return new Date(inj.expectedReturnDate).getTime() > this.cutoffDate.getTime();
      }
      return true;
    });
  }

  /**
   * Returns lineups for a given match.
   */
  public getLineup(fixtureId: string): CanonicalLineup[] {
    return this.lineups.filter((l) => l.fixtureId === fixtureId);
  }

  /**
   * Returns referee history strictly before cutoffDate.
   */
  public getRefereeHistory(refereeName: string): CanonicalReferee[] {
    return this.referees.filter(
      (r) => r.refereeName === refereeName && new Date(r.date).getTime() < this.cutoffDate.getTime()
    );
  }

  /**
   * Returns team match statistics history strictly before cutoffDate.
   */
  public getTeamStatsHistory(teamName: string): CanonicalTeamStats[] {
    return this.teamStats.filter((ts) => {
      if (ts.teamName !== teamName) return false;
      const parentFixture = this.fixtures.find((f) => f.match_id === ts.fixtureId);
      if (!parentFixture) return false;
      return new Date(parentFixture.kickoff).getTime() < this.cutoffDate.getTime();
    });
  }
}

function fixtureTeamId(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}
