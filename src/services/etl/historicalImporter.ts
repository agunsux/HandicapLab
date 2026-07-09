import { apiFootballClient } from '@/lib/apis/apifootball';
import { supabase } from '@/lib/supabase.server';

export interface IngestionReport {
  league: string;
  season: number;
  fixturesImported: number;
  duplicatesSkipped: number;
  status: 'COMPLETED' | 'FAILED';
}

export class HistoricalImporter {
  /**
   * Imports fixtures and team stats from API-Football and writes them idempotently.
   */
  public async importSeason(league: string, season: number, leagueId: number): Promise<IngestionReport> {
    try {
      // Query raw data from API provider
      const response = await apiFootballClient.getFixtures(leagueId, season);

      let fixturesImported = 0;
      let duplicatesSkipped = 0;

      for (const item of response.response || []) {
        const fixtureApiId = Number(item.fixture.id);

        // Idempotency check: see if we already have this fixture in database
        const { data: existing } = await supabase
          .from('wh_fixtures')
          .select('id')
          .eq('id', fixtureApiId)
          .maybeSingle();

        if (existing) {
          duplicatesSkipped++;
          continue;
        }

        // Insert new fixture record idempotently
        const dbPayload = {
          id: fixtureApiId,
          league_id: leagueId,
          season: season,
          kickoff_time: item.fixture.date,
          home_team_id: Number(item.teams.home.id),
          away_team_id: Number(item.teams.away.id),
          home_goals: item.goals.home ?? null,
          away_goals: item.goals.away ?? null,
          status: item.fixture.status.short,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('wh_fixtures').insert(dbPayload);
        if (error) {
          throw new Error(`[HistoricalImporter] Insert failed for fixture ${fixtureApiId}: ${error.message}`);
        }

        fixturesImported++;
      }

      return {
        league,
        season,
        fixturesImported,
        duplicatesSkipped,
        status: 'COMPLETED'
      };
    } catch (err: any) {
      console.error(`[HistoricalImporter] Season import failed: ${err.message}`);
      return {
        league,
        season,
        fixturesImported: 0,
        duplicatesSkipped: 0,
        status: 'FAILED'
      };
    }
  }
}
