/**
 * Phase 1: Bronze Research Adapter
 *
 * Read-only adapter that loads fixture data from Bronze Lakehouse
 * without modifying any raw datasets.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ResearchFixture {
  fixtureId: string;
  date: string;
  datetime: string;
  season: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number | null;
  awayGoals: number | null;
  homeXG: number | null;
  awayXG: number | null;
}

export interface FixtureLoaderOptions {
  season: string;
  league?: string;
  provider?: string;
}

export class BronzeFixtureLoader {
  private basePath: string;

  constructor(
    private options: { dataRoot?: string } = {}
  ) {
    this.basePath = options.dataRoot || path.join(process.cwd(), 'data');
  }

  /**
   * Load fixtures from Bronze Understat source files.
   * Reads directly from git-tracked source files to ensure stability.
   */
  loadFixtures(opts: FixtureLoaderOptions): ResearchFixture[] {
    const season = opts.season;
    const league = opts.league || 'EPL';
    const provider = opts.provider || 'understat';

    // Try multiple source paths in order of preference
    const sourcePaths = [
      // Git-tracked Understat source files
      path.join(this.basePath, 'bronze', 'EPL', `${season}_understat.json`),
      // Bronze Lakehouse matches.json  
      path.join(this.basePath, 'bronze', provider, league, season, 'matches.json'),
    ];

    let rawData: any[] = [];

    for (const srcPath of sourcePaths) {
      if (fs.existsSync(srcPath)) {
        let content = fs.readFileSync(srcPath, 'utf8');
        // Strip BOM if present
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }
        try {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed) && parsed.length > 0) {
            rawData = parsed;
            break;
          }
        } catch {
          continue;
        }
      }
    }

    if (rawData.length === 0) {
      return [];
    }

    return this.normalizeUnderstatData(rawData, season, league);
  }

  /**
   * Load all available seasons
   */
  loadAllSeasons(league: string = 'EPL'): ResearchFixture[] {
    const seasons = this.getAvailableSeasons(league);
    const all: ResearchFixture[] = [];
    
    for (const season of seasons) {
      const fixtures = this.loadFixtures({ season, league });
      all.push(...fixtures);
    }

    return all;
  }

  /**
   * Get list of seasons that have data available
   */
  getAvailableSeasons(league: string = 'EPL'): string[] {
    const seasons = [
      '2015-2016', '2016-2017', '2017-2018', '2018-2019', '2019-2020',
      '2020-2021', '2021-2022', '2022-2023', '2023-2024', '2024-2025',
      '2025-2026'
    ];

    return seasons.filter(season => {
      // Check git-tracked source files
      const srcPath = path.join(this.basePath, 'bronze', 'EPL', `${season}_understat.json`);
      if (fs.existsSync(srcPath)) {
        let content = fs.readFileSync(srcPath, 'utf8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        try {
          const parsed = JSON.parse(content);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return false;
        }
      }
      return false;
    });
  }

  /**
   * Normalize raw Understat data to ResearchFixture format
   */
  private normalizeUnderstatData(
    raw: any[],
    season: string,
    league: string
  ): ResearchFixture[] {
    return raw
      .filter(m => m.datetime && m.h?.title && m.a?.title)
      .map(m => ({
        fixtureId: `epl_${season}_${m.id || Buffer.from(m.datetime + m.h?.title + m.a?.title).toString('hex').substring(0, 12)}`,
        date: m.datetime.substring(0, 10),
        datetime: m.datetime,
        season,
        league,
        homeTeam: m.h.title,
        awayTeam: m.a.title,
        homeGoals: m.goals?.h ?? null,
        awayGoals: m.goals?.a ?? null,
        homeXG: m.h?.xG ?? null,
        awayXG: m.a?.xG ?? null,
      }));
  }

  /**
   * Get season summary (team aggregates from season_table.json)
   */
  getSeasonSummary(season: string, league: string = 'EPL'): any[] {
    const stPath = path.join(
      this.basePath, 'bronze', 'understat', league, season, 'season_table.json'
    );
    if (fs.existsSync(stPath)) {
      return JSON.parse(fs.readFileSync(stPath, 'utf8'));
    }
    return [];
  }
}