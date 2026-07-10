/**
 * HandicapLab Dataset Builder
 * ============================
 * Constructs an immutable CanonicalDataset step by step.
 *
 * Usage:
 *   const dataset = new DatasetBuilder()
 *     .addTeam(team)
 *     .addCompetition(comp)
 *     .addSeason(season)
 *     .addMatch(match)
 *     .build('my-dataset', 'My Dataset', 'api-football-2024');
 *
 * After build(), the dataset is frozen and cannot be modified.
 */

import crypto from 'crypto';
import { CanonicalDataset, CanonicalTeam, CanonicalCompetition, CanonicalSeason, CanonicalMatch, DatasetManifest } from './types';
import { DatasetValidator } from './validator';

export class DatasetBuilder {
  private teams: Map<string, CanonicalTeam> = new Map();
  private competitions: Map<string, CanonicalCompetition> = new Map();
  private seasons: Map<string, CanonicalSeason> = new Map();
  private matches: Map<string, CanonicalMatch> = new Map();

  addTeam(team: CanonicalTeam): this {
    this.teams.set(team.id, team);
    return this;
  }

  addCompetition(comp: CanonicalCompetition): this {
    this.competitions.set(comp.id, comp);
    return this;
  }

  addSeason(season: CanonicalSeason): this {
    this.seasons.set(season.id, season);
    return this;
  }

  addMatch(match: CanonicalMatch): this {
    this.matches.set(match.fixture.id, match);
    return this;
  }

  build(name: string, description?: string, provenance?: string): CanonicalDataset {
    const teamsArr = Array.from(this.teams.values());
    const compsArr = Array.from(this.competitions.values());
    const seasonsArr = Array.from(this.seasons.values());
    const matchesArr = Array.from(this.matches.values());

    const data = { teams: teamsArr, competitions: compsArr, seasons: seasonsArr, matches: matchesArr };
    const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

    const manifest: DatasetManifest = {
      id: `dataset:${hash.substring(0, 12)}`,
      version: '1.0.0',
      name: name || 'Unnamed Dataset',
      description,
      hash,
      createdAt: new Date().toISOString(),
      recordCount: matchesArr.length,
      fixtureCount: matchesArr.length,
      competitions: compsArr.map((c) => c.id),
      seasons: seasonsArr.map((s) => s.id),
      provenance: provenance || 'unknown',
      schema: 'v1',
    };

    const dataset: CanonicalDataset = {
      manifest,
      teams: teamsArr,
      competitions: compsArr,
      seasons: seasonsArr,
      matches: matchesArr,
    };

    // Validate before returning
    const validator = new DatasetValidator();
    const report = validator.validate(dataset, teamsArr, compsArr);
    if (!report.valid) {
      const errors = report.errors.map((e) => `${e.fixtureId}: ${e.message}`).join('; ');
      throw new Error(`Dataset validation failed: ${errors}`);
    }

    return dataset;
  }

  static buildFromNormalized(
    fixtures: Array<{ id: string; competitionId: string; seasonId: string; homeTeamId: string; awayTeamId: string; kickoff: string; status: 'scheduled' | 'finished' | 'postponed' | 'cancelled'; round?: string }>,
    odds: Array<{ fixtureId: string; market: 'ML' | 'AH' | 'OU' | 'BTTS'; homeOdds: number; drawOdds: number | null; awayOdds: number; timestamp: string }>,
    results: Array<{ fixtureId: string; homeGoals: number; awayGoals: number; status: 'finished' | 'postponed' | 'cancelled' }>,
    teams: CanonicalTeam[],
    comps: CanonicalCompetition[],
    seasons: CanonicalSeason[],
    provenance: string
  ): CanonicalDataset {
    const builder = new DatasetBuilder();

    for (const t of teams) builder.addTeam(t);
    for (const c of comps) builder.addCompetition(c);
    for (const s of seasons) builder.addSeason(s);

    for (const f of fixtures) {
      const matchOdds = odds.filter((o) => o.fixtureId === f.id);
      const result = results.find((r) => r.fixtureId === f.id);
      builder.addMatch({
        fixture: {
          id: f.id,
          competitionId: f.competitionId,
          seasonId: f.seasonId,
          homeTeamId: f.homeTeamId,
          awayTeamId: f.awayTeamId,
          kickoff: f.kickoff,
          round: f.round,
          status: f.status,
        },
        odds: matchOdds.map((o) => ({
          fixtureId: o.fixtureId,
          market: o.market,
          homeOdds: o.homeOdds,
          drawOdds: o.drawOdds,
          awayOdds: o.awayOdds,
          timestamp: o.timestamp,
        })),
        result: result ? { fixtureId: result.fixtureId, homeGoals: result.homeGoals, awayGoals: result.awayGoals, status: result.status } : undefined,
      });
    }

    return builder.build(`Dataset from ${provenance}`, undefined, provenance);
  }
}