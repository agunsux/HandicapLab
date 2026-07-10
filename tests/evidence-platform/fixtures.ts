// Historical Evidence Platform — shared test fixtures
// Builds valid CanonicalDataset objects for platform unit tests.

import type {
  CanonicalCompetition,
  CanonicalDataset,
  CanonicalMatch,
  CanonicalOdds,
  CanonicalSeason,
  CanonicalTeam,
  DatasetManifest,
} from '../../src/lib/dataset/types';
import crypto from 'crypto';

export const TEAMS: CanonicalTeam[] = [
  { id: 'team:epl:alpha', name: 'Alpha', shortName: 'ALP', country: 'England', aliases: [] },
  { id: 'team:epl:bravo', name: 'Bravo', shortName: 'BRA', country: 'England', aliases: [] },
  { id: 'team:epl:charlie', name: 'Charlie', shortName: 'CHA', country: 'England', aliases: [] },
  { id: 'team:epl:delta', name: 'Delta', shortName: 'DEL', country: 'England', aliases: [] },
];

export const COMPETITIONS: CanonicalCompetition[] = [
  { id: 'comp:epl', name: 'English Premier League', shortName: 'EPL', country: 'England', tier: 1, timezone: 'Europe/London', sport: 'football' },
];

export const SEASONS: CanonicalSeason[] = [
  { id: 'season:epl:2024-2025', competitionId: 'comp:epl', name: '2024-2025', startDate: '2024-08-01T00:00:00Z', endDate: '2025-05-31T23:59:59Z' },
];

export interface MatchSpec {
  id: string;
  home: string;
  away: string;
  kickoff: string;
  status?: 'scheduled' | 'finished' | 'postponed' | 'cancelled';
  homeGoals?: number;
  awayGoals?: number;
  odds?: Partial<CanonicalOdds>[];
  withResult?: boolean;
}

export function makeMatch(spec: MatchSpec): CanonicalMatch {
  const status = spec.status ?? 'finished';
  const odds: CanonicalOdds[] = (spec.odds ?? [
    { market: 'ML', homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8, provider: 'book-a' },
  ]).map((o) => ({
    fixtureId: spec.id,
    market: o.market ?? 'ML',
    line: o.line,
    homeOdds: o.homeOdds ?? 2.0,
    drawOdds: o.drawOdds ?? 3.4,
    awayOdds: o.awayOdds ?? 3.8,
    openingHomeOdds: o.openingHomeOdds,
    openingDrawOdds: o.openingDrawOdds,
    openingAwayOdds: o.openingAwayOdds,
    closingHomeOdds: o.closingHomeOdds,
    closingDrawOdds: o.closingDrawOdds,
    closingAwayOdds: o.closingAwayOdds,
    timestamp: o.timestamp ?? spec.kickoff,
    provider: o.provider ?? 'book-a',
  }));

  const hasResult = spec.withResult ?? status === 'finished';
  return {
    fixture: {
      id: spec.id,
      competitionId: 'comp:epl',
      seasonId: 'season:epl:2024-2025',
      homeTeamId: spec.home,
      awayTeamId: spec.away,
      kickoff: spec.kickoff,
      status,
    },
    odds,
    result: hasResult
      ? { fixtureId: spec.id, homeGoals: spec.homeGoals ?? 1, awayGoals: spec.awayGoals ?? 0, status: 'finished' }
      : undefined,
  };
}

export function buildDataset(matches: CanonicalMatch[], id = 'dataset:test'): CanonicalDataset {
  const data = { teams: TEAMS, competitions: COMPETITIONS, seasons: SEASONS, matches };
  const hash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  const manifest: DatasetManifest = {
    id,
    version: '1.0.0',
    name: 'Test Dataset',
    hash,
    createdAt: '2025-01-01T00:00:00Z',
    recordCount: matches.length,
    fixtureCount: matches.length,
    competitions: ['comp:epl'],
    seasons: ['season:epl:2024-2025'],
    provenance: 'test',
    schema: 'v1',
  };
  return { manifest, teams: TEAMS, competitions: COMPETITIONS, seasons: SEASONS, matches };
}

/** A clean, valid dataset: 3 finished matches, sorted, UTC kickoffs, priced. */
export function cleanDataset(): CanonicalDataset {
  return buildDataset([
    makeMatch({ id: 'fix:1', home: 'team:epl:alpha', away: 'team:epl:bravo', kickoff: '2024-08-17T12:00:00Z', homeGoals: 2, awayGoals: 1 }),
    makeMatch({ id: 'fix:2', home: 'team:epl:charlie', away: 'team:epl:delta', kickoff: '2024-08-18T12:00:00Z', homeGoals: 0, awayGoals: 0 }),
    makeMatch({ id: 'fix:3', home: 'team:epl:alpha', away: 'team:epl:charlie', kickoff: '2024-08-24T12:00:00Z', homeGoals: 1, awayGoals: 3 }),
  ]);
}
