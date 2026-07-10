/**
 * Historical Import Pipeline — Parsers & Normalizer
 * ==================================================
 * Pure parsing + normalization helpers for the import pipeline.
 *
 * Supports CSV text and JSON objects. Produces NormalizedBundle records
 * (canonical ids) plus derived canonical teams/competitions/seasons so the
 * DatasetBuilder can construct a valid CanonicalDataset.
 */

import type {
  CanonicalCompetition,
  CanonicalSeason,
  CanonicalTeam,
} from '../dataset/types';
import type {
  CsvColumnMap,
  NormalizedBundle,
  NormalizedFixture,
  NormalizedOdds,
  NormalizedResult,
} from './types';

export interface NormalizeOutput {
  readonly bundle: NormalizedBundle;
  readonly teams: readonly CanonicalTeam[];
  readonly competitions: readonly CanonicalCompetition[];
  readonly seasons: readonly CanonicalSeason[];
}

export interface CsvTable {
  readonly headers: readonly string[];
  readonly rows: readonly Record<string, string>[];
}

/** Slugify a name into a stable, url-safe identifier segment. */
export function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Minimal, dependency-free CSV parser. Handles quoted fields, escaped quotes
 * ("") and commas within quotes. Assumes the first non-empty line is a header.
 */
export function parseCsv(text: string): CsvTable {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current);
        current = '';
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  };

  const headers = parseLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] ?? '';
    });
    rows.push(row);
  }
  return { headers, rows };
}

function buildTeam(leagueSlug: string, name: string): CanonicalTeam {
  return {
    id: `team:${leagueSlug}:${slugify(name)}`,
    name,
    shortName: name.slice(0, 3).toUpperCase(),
    country: 'unknown',
    aliases: [],
  };
}

function buildCompetition(leagueId: string): CanonicalCompetition {
  return {
    id: leagueId,
    name: leagueId.replace('comp:', ''),
    shortName: leagueId.replace('comp:', '').toUpperCase(),
    country: 'unknown',
    tier: 1,
    timezone: 'UTC',
    sport: 'football',
  };
}

function buildSeason(leagueId: string, seasonId: string): CanonicalSeason {
  const name = seasonId.split(':').pop() ?? seasonId;
  const startYear = parseInt(name.slice(0, 4), 10);
  const year = Number.isNaN(startYear) ? new Date().getFullYear() : startYear;
  return {
    id: seasonId,
    competitionId: leagueId,
    name,
    startDate: `${year}-08-01T00:00:00Z`,
    endDate: `${year + 1}-05-31T23:59:59Z`,
  };
}

/** Normalize a CSV table into a canonical bundle + derived reference data. */
export function normalizeCsv(
  table: CsvTable,
  map: CsvColumnMap,
  leagueId: string,
  seasonId: string,
  provider: string
): NormalizeOutput {
  const leagueSlug = leagueId.replace('comp:', '');
  const teamMap = new Map<string, CanonicalTeam>();
  const fixtures: NormalizedFixture[] = [];
  const odds: NormalizedOdds[] = [];
  const results: NormalizedResult[] = [];

  let counter = 0;
  for (const row of table.rows) {
    const homeName = row[map.homeTeam];
    const awayName = row[map.awayTeam];
    const kickoff = row[map.kickoff];
    if (!homeName || !awayName || !kickoff) continue;

    const homeTeam = buildTeam(leagueSlug, homeName);
    const awayTeam = buildTeam(leagueSlug, awayName);
    teamMap.set(homeTeam.id, homeTeam);
    teamMap.set(awayTeam.id, awayTeam);

    counter++;
    const fixtureId = map.fixtureId && row[map.fixtureId]
      ? row[map.fixtureId]
      : `fix:${leagueSlug}:${slugify(kickoff)}:${slugify(homeName)}-${slugify(awayName)}:${counter}`;

    const homeGoalsRaw = map.homeGoals ? row[map.homeGoals] : '';
    const awayGoalsRaw = map.awayGoals ? row[map.awayGoals] : '';
    const hasResult = homeGoalsRaw !== '' && awayGoalsRaw !== '';

    fixtures.push({
      id: fixtureId,
      competitionId: leagueId,
      seasonId,
      homeTeamId: homeTeam.id,
      awayTeamId: awayTeam.id,
      kickoff,
      status: hasResult ? 'finished' : 'scheduled',
    });

    if (hasResult) {
      results.push({
        fixtureId,
        homeGoals: parseInt(homeGoalsRaw, 10),
        awayGoals: parseInt(awayGoalsRaw, 10),
        status: 'finished',
      });
    }

    if (map.homeOdds && map.awayOdds) {
      const h = parseFloat(row[map.homeOdds]);
      const a = parseFloat(row[map.awayOdds]);
      const d = map.drawOdds ? parseFloat(row[map.drawOdds]) : NaN;
      if (!Number.isNaN(h) && !Number.isNaN(a)) {
        odds.push({
          fixtureId,
          market: 'ML',
          homeOdds: h,
          drawOdds: Number.isNaN(d) ? null : d,
          awayOdds: a,
          timestamp: kickoff,
          provider,
        });
      }
    }
  }

  return {
    bundle: { fixtures, odds, results },
    teams: Array.from(teamMap.values()),
    competitions: [buildCompetition(leagueId)],
    seasons: [buildSeason(leagueId, seasonId)],
  };
}

/**
 * Normalize a JSON/API payload. Accepts either a full bundle
 * ({ fixtures, odds, results, teams?, competitions?, seasons? }).
 * Missing reference data is derived from the fixtures.
 */
export function normalizeJson(
  payload: unknown,
  leagueId: string,
  seasonId: string
): NormalizeOutput {
  if (payload === null || typeof payload !== 'object') {
    throw new Error('JSON import payload must be an object with fixtures/odds/results');
  }
  const obj = payload as {
    fixtures?: NormalizedFixture[];
    odds?: NormalizedOdds[];
    results?: NormalizedResult[];
    teams?: CanonicalTeam[];
    competitions?: CanonicalCompetition[];
    seasons?: CanonicalSeason[];
  };

  const fixtures = obj.fixtures ?? [];
  const odds = obj.odds ?? [];
  const results = obj.results ?? [];

  const teamMap = new Map<string, CanonicalTeam>();
  for (const t of obj.teams ?? []) teamMap.set(t.id, t);
  // Derive any teams referenced but not supplied.
  for (const f of fixtures) {
    for (const teamId of [f.homeTeamId, f.awayTeamId]) {
      if (!teamMap.has(teamId)) {
        const name = teamId.split(':').pop() ?? teamId;
        teamMap.set(teamId, { id: teamId, name, shortName: name.slice(0, 3).toUpperCase(), country: 'unknown', aliases: [] });
      }
    }
  }

  const competitions = obj.competitions && obj.competitions.length > 0 ? obj.competitions : [buildCompetition(leagueId)];
  const seasons = obj.seasons && obj.seasons.length > 0 ? obj.seasons : [buildSeason(leagueId, seasonId)];

  return {
    bundle: { fixtures, odds, results },
    teams: Array.from(teamMap.values()),
    competitions,
    seasons,
  };
}
