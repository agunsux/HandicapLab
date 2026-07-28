// EPIC 53 Stage D — Historical Data Ingestor
// Per-league, resumable, runs only on surplus quota.
// Tracks progress so it never restarts from zero.

import { supabase } from '@/lib/supabase.server';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { LEAGUE_PRIORITIES } from '@/lib/config/leaguePriorities';
import { canProceed, logProviderCall } from '@/lib/providers/quotaManager';

export interface HistoricalProgress {
  id: string;
  leagueId: number;
  leagueName: string;
  season: number;
  totalFixtures: number;
  importedFixtures: number;
  status: 'pending' | 'in_progress' | 'completed' | 'paused';
  lastImportedPage: number;
  errorMessage: string | null;
}

// Get or create progress tracker for a league+season
async function getOrCreateProgress(
  leagueId: number,
  leagueName: string,
  season: number
): Promise<HistoricalProgress> {
  const { data: existing } = await supabase
    .from('historical_imports')
    .select('*')
    .eq('league_id', leagueId)
    .eq('season', season)
    .single();

  if (existing) return existing as HistoricalProgress;

  const { data: created } = await supabase
    .from('historical_imports')
    .insert({
      league_id: leagueId,
      league_name: leagueName,
      season,
      status: 'pending',
      total_fixtures: 0,
      imported_fixtures: 0,
      last_imported_page: 0,
    })
    .select()
    .single();

  return (created ?? {
    id: '',
    leagueId,
    leagueName,
    season,
    status: 'pending',
    totalFixtures: 0,
    importedFixtures: 0,
    lastImportedPage: 0,
    errorMessage: null,
  }) as unknown as HistoricalProgress;
}

// Import one page of historical fixtures for a league.
// Returns null if paused (quota running low).
export async function importHistoricalBatch(
  leagueId: number,
  progress: HistoricalProgress
): Promise<{ imported: number; completed: boolean } | null> {
  const check = await canProceed('apifootball', 'background');
  if (!check.allowed) return null;

  try {
    const nextPage = progress.lastImportedPage + 1;
    const startTime = Date.now();

    // API-Football fixtures endpoint with pagination
    const response = await apiFootballClient.getFixtures(leagueId, progress.season);
    await logProviderCall('apifootball', 'fixtures/historical', Date.now() - startTime, 200, {
      leagueId,
      page: nextPage,
    });

    const fixtures = response.response ?? [];
    const total = response.paging?.total ?? 0;

    if (fixtures.length === 0) {
      // No more fixtures — mark complete
      await supabase
        .from('historical_imports')
        .update({ status: 'completed', imported_fixtures: progress.importedFixtures })
        .eq('id', progress.id);
      return { imported: 0, completed: true };
    }

    // Store fixtures incrementally (upsert into matches table)
    let upserted = 0;
    for (const f of fixtures) {
      const { data: existing } = await supabase
        .from('matches')
        .select('id')
        .eq('fixture_id', String(f.fixture.id))
        .maybeSingle();

      if (existing) continue;

      await supabase.from('matches').insert({
        fixture_id: String(f.fixture.id),
        league: progress.leagueName,
        league_id: leagueId,
        season: progress.season,
        home_team: f.teams.home.name,
        away_team: f.teams.away.name,
        kickoff: new Date(f.fixture.date).toISOString(),
        status: f.fixture.status.short,
        home_score: f.goals.home,
        away_score: f.goals.away,
        var_era: f.fixture.date >= `${progress.season - 1}-08-01`,
      });
      upserted += 1;
    }

    const newImported = progress.importedFixtures + upserted;
    const completed = total > 0 && newImported >= total;

    await supabase
      .from('historical_imports')
      .update({
        status: completed ? 'completed' : 'in_progress',
        imported_fixtures: newImported,
        total_fixtures: Math.max(progress.totalFixtures, total),
        last_imported_page: nextPage,
      })
      .eq('id', progress.id);

    return { imported: upserted, completed };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error';
    console.error(`[HistoricalIngestor] Failed for league ${leagueId}:`, errorMessage);

    await supabase
      .from('historical_imports')
      .update({ status: 'paused', error_message: errorMessage })
      .eq('id', progress.id);

    return null;
  }
}

// Main entry: process all leagues in priority order until quota runs low
export async function runHistoricalIngestor(): Promise<{
  leaguesProcessed: number;
  fixturesImported: number;
  completed: number;
}> {
  let leaguesProcessed = 0;
  let fixturesImported = 0;
  let completed = 0;

  for (const league of LEAGUE_PRIORITIES) {
    const check = await canProceed('apifootball', 'background');
    if (!check.allowed) break;

    const progress = await getOrCreateProgress(league.apiFootballId, league.name, league.season);
    if (progress.status === 'completed') continue;

    const result = await importHistoricalBatch(league.apiFootballId, progress);
    if (result === null) break; // quota exhausted

    leaguesProcessed += 1;
    fixturesImported += result.imported;
    if (result.completed) completed += 1;
  }

  return { leaguesProcessed, fixturesImported, completed };
}
