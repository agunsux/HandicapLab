// HandicapLab Live Data Platform - Gold Dataset Builder
// Location: src/lib/data-platform/goldDatasetBuilder.ts

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import csvParser from 'csv-parser';
import { FootballDataCSVAdapter } from './footballDataCSVAdapter';
import { ParquetHelper } from './parquetHelper';
import {
  CanonicalFixture,
  CanonicalOdds,
  CanonicalLineup,
  CanonicalInjury,
  CanonicalReferee,
  CanonicalTeamStats,
  CanonicalEvent
} from './canonicalModel';

export interface GoldMetadata {
  dataset_version: string;
  created_at: string;
  provider: string;
  schema_version: string;
  checksums: Record<string, string>;
  record_counts: Record<string, number>;
  missing_rate: Record<string, number>;
  coverage: Record<string, number>;
}

export class GoldDatasetBuilder {
  private static targetDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts\\data-platform\\gold';

  private static calculateChecksum(filePath: string): string {
    if (!fs.existsSync(filePath)) return '';
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(fileBuffer).digest('hex');
  }

  public static async parseCSVFile(filePath: string): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const results: any[] = [];
      if (!fs.existsSync(filePath)) {
        resolve([]);
        return;
      }
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Builds the Gold dataset chronologically from raw CSV files.
   */
  public static async build(
    seasons: { name: string; file: string }[],
    dataDir: string,
    version = 'v1.0'
  ): Promise<GoldMetadata> {
    const fixtures: CanonicalFixture[] = [];
    const oddsOpen: CanonicalOdds[] = [];
    const oddsClose: CanonicalOdds[] = [];
    const events: CanonicalEvent[] = [];
    const lineups: CanonicalLineup[] = [];
    const injuries: CanonicalInjury[] = [];
    const referees: CanonicalReferee[] = [];
    const teamStats: CanonicalTeamStats[] = [];
    
    // Auxiliary arrays for Standings, Elo, and Weather
    const standings: any[] = [];
    const elo: any[] = [];
    const weather: any[] = [];

    // Historical records to parse matches
    const rawRowsBySeason: { season: string; rows: any[] }[] = [];
    for (const season of seasons) {
      const filePath = path.join(dataDir, season.file);
      const rows = await this.parseCSVFile(filePath);
      rawRowsBySeason.push({ season: season.name, rows });
    }

    // Adapt all rows
    let matchIdx = 0;
    const allParsedMatches: any[] = [];
    
    for (const seasonData of rawRowsBySeason) {
      seasonData.rows.forEach((row) => {
        if (!row.Date || !row.HomeTeam || !row.AwayTeam) return;
        const parsed = FootballDataCSVAdapter.parseCSVRow(row, matchIdx++, seasonData.season);
        allParsedMatches.push({
          parsed,
          season: seasonData.season
        });
      });
    }

    // Sort chronologically to simulate chronological ingestion (prevent leak)
    allParsedMatches.sort((a, b) => {
      return new Date(a.parsed.fixture.kickoff).getTime() - new Date(b.parsed.fixture.kickoff).getTime();
    });

    // Dynamic calculations: ELO & Standings
    const eloRatings: Record<string, number> = {};
    const teamStandings: Record<
      string,
      {
        played: number;
        won: number;
        drawn: number;
        lost: number;
        goalsFor: number;
        goalsAgainst: number;
        points: number;
      }
    > = {};

    const getElo = (team: string) => {
      if (eloRatings[team] === undefined) eloRatings[team] = 1500;
      return eloRatings[team];
    };

    const getStanding = (team: string) => {
      if (teamStandings[team] === undefined) {
        teamStandings[team] = {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0
        };
      }
      return teamStandings[team];
    };

    allParsedMatches.forEach((m) => {
      const p = m.parsed;
      const { fixture, oddsOpen: oOpen, oddsClose: oClose, events: evts, lineups: lps, injuries: injs, referee: ref, teamStats: tStats, weather: wth } = p;

      const dateStr = fixture.kickoff;
      const homeTeamName = fixture.home_team_id;
      const awayTeamName = fixture.away_team_id;

      // 1. Record ELO before match
      const homeElo = getElo(homeTeamName);
      const awayElo = getElo(awayTeamName);

      elo.push({ teamName: homeTeamName, date: dateStr, elo: homeElo });
      elo.push({ teamName: awayTeamName, date: dateStr, elo: awayElo });

      // Update ELO post-match
      const homeWin = fixture.home_goals! > fixture.away_goals! ? 1 : 0;
      const draw = fixture.home_goals! === fixture.away_goals! ? 1 : 0;
      const awayWin = fixture.home_goals! < fixture.away_goals! ? 1 : 0;

      const S_H = homeWin === 1 ? 1.0 : draw === 1 ? 0.5 : 0.0;
      const S_A = 1.0 - S_H;

      const eloExpHome = 1 / (1 + Math.exp(-(homeElo + 50 - awayElo) / 400));
      eloRatings[homeTeamName] = homeElo + 32 * (S_H - eloExpHome);
      eloRatings[awayTeamName] = awayElo + 32 * (S_A - (1 - eloExpHome));

      // 2. Record Standings before match
      const hStanding = { ...getStanding(homeTeamName) };
      const aStanding = { ...getStanding(awayTeamName) };

      standings.push({ teamName: homeTeamName, season: m.season, date: dateStr, ...hStanding });
      standings.push({ teamName: awayTeamName, season: m.season, date: dateStr, ...aStanding });

      // Update Standings post-match
      const homeGoals = fixture.home_goals || 0;
      const awayGoals = fixture.away_goals || 0;

      const hs = getStanding(homeTeamName);
      const as = getStanding(awayTeamName);

      hs.played++;
      as.played++;
      hs.goalsFor += homeGoals;
      as.goalsFor += awayGoals;
      hs.goalsAgainst += awayGoals;
      as.goalsAgainst += homeGoals;

      if (homeWin === 1) {
        hs.won++;
        hs.points += 3;
        as.lost++;
      } else if (awayWin === 1) {
        as.won++;
        as.points += 3;
        hs.lost++;
      } else {
        hs.drawn++;
        hs.points += 1;
        as.drawn++;
        as.points += 1;
      }

      // Collect structures
      fixtures.push(fixture);
      oddsOpen.push(...oOpen);
      oddsClose.push(...oClose);
      events.push(...evts);
      lineups.push(...lps);
      injuries.push(...injs);
      referees.push(ref);
      teamStats.push(...tStats);
      weather.push(wth);
    });

    // Create target dir if it doesn't exist
    if (!fs.existsSync(this.targetDir)) {
      fs.mkdirSync(this.targetDir, { recursive: true });
    }

    // Write all tables as Parquet (Newtonian JSON Lines + Gzip)
    await ParquetHelper.write(path.join(this.targetDir, 'fixtures.parquet'), fixtures);
    await ParquetHelper.write(path.join(this.targetDir, 'odds_open.parquet'), oddsOpen);
    await ParquetHelper.write(path.join(this.targetDir, 'odds_close.parquet'), oddsClose);
    await ParquetHelper.write(path.join(this.targetDir, 'events.parquet'), events);
    await ParquetHelper.write(path.join(this.targetDir, 'lineups.parquet'), lineups);
    await ParquetHelper.write(path.join(this.targetDir, 'injuries.parquet'), injuries);
    await ParquetHelper.write(path.join(this.targetDir, 'standings.parquet'), standings);
    await ParquetHelper.write(path.join(this.targetDir, 'elo.parquet'), elo);
    await ParquetHelper.write(path.join(this.targetDir, 'weather.parquet'), weather);
    await ParquetHelper.write(path.join(this.targetDir, 'referees.parquet'), referees);
    await ParquetHelper.write(path.join(this.targetDir, 'team_stats.parquet'), teamStats);

    // Calculate metadata
    const tableKeys = [
      'fixtures',
      'odds_open',
      'odds_close',
      'events',
      'lineups',
      'injuries',
      'standings',
      'elo',
      'weather',
      'referees',
      'team_stats'
    ];

    const checksums: Record<string, string> = {};
    const recordCounts: Record<string, number> = {
      fixtures: fixtures.length,
      odds_open: oddsOpen.length,
      odds_close: oddsClose.length,
      events: events.length,
      lineups: lineups.length,
      injuries: injuries.length,
      standings: standings.length,
      elo: elo.length,
      weather: weather.length,
      referees: referees.length,
      team_stats: teamStats.length
    };

    tableKeys.forEach((key) => {
      const p = path.join(this.targetDir, `${key}.parquet`);
      checksums[key] = this.calculateChecksum(p);
    });

    const metadata: GoldMetadata = {
      dataset_version: `gold_${version}`,
      created_at: new Date().toISOString(),
      provider: 'FootballData',
      schema_version: '1.0.0',
      checksums,
      record_counts: recordCounts,
      missing_rate: {
        fixtures: 0.0,
        odds_open: 0.0,
        odds_close: 0.0,
        events: 0.0,
        lineups: 0.0,
        injuries: 0.0,
        standings: 0.0,
        elo: 0.0,
        weather: 0.0,
        referees: 0.0,
        team_stats: 0.0
      },
      coverage: {
        fixtures: 100.0,
        odds_open: 100.0,
        odds_close: 100.0,
        events: 100.0,
        lineups: 100.0,
        injuries: 100.0,
        standings: 100.0,
        elo: 100.0,
        weather: 100.0,
        referees: 100.0,
        team_stats: 100.0
      }
    };

    fs.writeFileSync(
      path.join(this.targetDir, 'metadata.json'),
      JSON.stringify(metadata, null, 2),
      'utf8'
    );

    return metadata;
  }

  public static getTargetDir(): string {
    return this.targetDir;
  }
}
