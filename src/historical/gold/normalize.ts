import type { NormalizedMatch, RawMatchRow, SeasonKey } from '../types';

export function slugifyTeam(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export function normalizeSeason(season: string): SeasonKey | null {
  const m = season.trim().match(/^(\d{4})[-/](\d{4})$/);
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

export function deriveResult(homeGoals: number, awayGoals: number): 'H' | 'D' | 'A' {
  if (homeGoals > awayGoals) return 'H';
  if (homeGoals < awayGoals) return 'A';
  return 'D';
}

export interface NormalizeOutput {
  matches: NormalizedMatch[];
  excluded: { reason: string; count: number }[];
  duplicatesFound: number;
  resultMismatches: number;
}

export function normalizeMatches(rows: RawMatchRow[]): NormalizeOutput {
  const excluded: Record<string, number> = {};
  const seen = new Map<string, number>();
  let duplicatesFound = 0;
  let resultMismatches = 0;
  const matches: NormalizedMatch[] = [];

  const exclude = (reason: string) => {
    excluded[reason] = (excluded[reason] || 0) + 1;
  };

  for (const row of rows) {
    const season = normalizeSeason(row.season ?? '');
    const hasGoals = row.full_time_home_goals !== null && row.full_time_away_goals !== null;
    const hasOdds = row.home_odds !== null && row.away_odds !== null;

    if (!season) { exclude('invalid_season'); continue; }
    if (!hasGoals) { exclude('missing_goals'); continue; }
    if (!hasOdds) { exclude('missing_1x2_odds'); continue; }
    if (!row.home_team || !row.away_team || !row.match_date) { exclude('missing_identity'); continue; }

    const homeGoals = row.full_time_home_goals as number;
    const awayGoals = row.full_time_away_goals as number;
    const derived = deriveResult(homeGoals, awayGoals);
    const storedResult = (row.result || '').toUpperCase();
    if (storedResult && storedResult !== derived) resultMismatches += 1;

    const canonicalId = `EPL-${season}-${row.match_date}-${slugifyTeam(row.home_team)}-${slugifyTeam(row.away_team)}`;
    if (seen.has(canonicalId)) {
      duplicatesFound += 1;
      exclude('duplicate');
      continue;
    }
    seen.set(canonicalId, row.id);

    matches.push({
      canonical_id: canonicalId,
      provider: 'football-data.co.uk',
      provider_record_id: row.id,
      league: 'EPL',
      season,
      match_date: row.match_date,
      home_team: row.home_team.trim(),
      away_team: row.away_team.trim(),
      home_goals: homeGoals,
      away_goals: awayGoals,
      result: derived,
      result_verified: storedResult === derived,
      source_file: row.source_file,
      source_type: 'HISTORICAL',
    });
  }

  matches.sort((a, b) => (a.match_date === b.match_date ? a.canonical_id.localeCompare(b.canonical_id) : a.match_date.localeCompare(b.match_date)));

  return {
    matches,
    excluded: Object.entries(excluded).map(([reason, count]) => ({ reason, count })),
    duplicatesFound,
    resultMismatches,
  };
}
