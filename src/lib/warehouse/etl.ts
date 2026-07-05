import { supabase } from '@/lib/supabase.server';
import { DataNormalizer, NormalizedFixture } from './normalizer';

export class WarehouseETL {
  // Provider Priority List (lower index = higher priority)
  private static PROVIDER_PRIORITY = ['api-football', 'football-data', 'footystats'];

  /**
   * Safe upsert for competitions.
   */
  public static async importCompetition(data: { apiId: number; name: string; country: string; type?: string; logoUrl?: string }) {
    const { data: existing } = await supabase
      .from('wh_competitions')
      .select('id')
      .eq('api_id', data.apiId)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const { data: inserted, error } = await supabase
      .from('wh_competitions')
      .insert({
        api_id: data.apiId,
        name: data.name,
        country: data.country,
        type: data.type || 'league',
        logo_url: data.logoUrl
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }

  /**
   * Safe upsert for seasons.
   */
  public static async importSeason(competitionId: string, year: number, startDate?: string, endDate?: string) {
    const { data: existing } = await supabase
      .from('wh_seasons')
      .select('id')
      .eq('competition_id', competitionId)
      .eq('year', year)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const { data: inserted, error } = await supabase
      .from('wh_seasons')
      .insert({
        competition_id: competitionId,
        year,
        start_date: startDate,
        end_date: endDate
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }

  /**
   * Safe upsert for teams.
   */
  public static async importTeam(data: { apiId: number; name: string; country?: string; logoUrl?: string }) {
    const { data: existing } = await supabase
      .from('wh_teams')
      .select('id')
      .eq('api_id', data.apiId)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    const { data: inserted, error } = await supabase
      .from('wh_teams')
      .insert({
        api_id: data.apiId,
        name: data.name,
        country: data.country || 'Unknown',
        logo_url: data.logoUrl
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }

  /**
   * Resumable fetch checkpoint logic.
   */
  public static async getCheckpoint(provider: string, entityType: string): Promise<string | null> {
    const { data, error } = await supabase
      .from('wh_sync_checkpoints')
      .select('last_cursor')
      .eq('provider', provider)
      .eq('entity_type', entityType)
      .maybeSingle();

    if (error) {
      console.error('[ETL Checkpoint] Failed to fetch checkpoint:', error);
      return null;
    }
    return data?.last_cursor || null;
  }

  public static async saveCheckpoint(provider: string, entityType: string, cursor: string, status: 'success' | 'failed' = 'success') {
    const { error } = await supabase
      .from('wh_sync_checkpoints')
      .upsert({
        provider,
        entity_type: entityType,
        last_cursor: cursor,
        status,
        updated_at: new Date().toISOString()
      }, { onConflict: 'provider,entity_type' });

    if (error) {
      console.error('[ETL Checkpoint] Failed to save checkpoint:', error);
    }
  }

  /**
   * Normalized ingest logic with priority resolution.
   */
  public static async loadFixture(fixture: NormalizedFixture, sourceProvider: string) {
    // 1. Resolve foreign keys
    const competitionId = await this.importCompetition({
      apiId: fixture.competitionApiId,
      name: `League ${fixture.competitionApiId}`,
      country: 'Unknown'
    });

    const seasonId = await this.importSeason(competitionId, fixture.seasonYear);

    const homeTeamId = await this.importTeam({
      apiId: fixture.homeTeamApiId,
      name: `Team ${fixture.homeTeamApiId}`
    });

    const awayTeamId = await this.importTeam({
      apiId: fixture.awayTeamApiId,
      name: `Team ${fixture.awayTeamApiId}`
    });

    // Resolve optional venue
    let venueId: string | undefined;
    if (fixture.venueName) {
      const { data: v } = await supabase
        .from('wh_venues')
        .upsert({
          name: fixture.venueName,
          city: fixture.venueCity
        }, { onConflict: 'api_id' })
        .select('id')
        .maybeSingle();
      venueId = v?.id;
    }

    // Resolve optional referee
    let refereeId: string | undefined;
    if (fixture.refereeName) {
      const { data: r } = await supabase
        .from('wh_referees')
        .upsert({
          name: fixture.refereeName
        }, { onConflict: 'api_id' })
        .select('id')
        .maybeSingle();
      refereeId = r?.id;
    }

    // Check if fixture already exists
    const { data: existing } = await supabase
      .from('wh_fixtures')
      .select('id, details_json')
      .eq('api_id', fixture.apiId)
      .maybeSingle();

    if (existing) {
      // Priority check: only overwrite if sourceProvider has higher or equal priority than existing
      const existingProvider = existing.details_json?.provider || 'footystats';
      const existingIdx = this.PROVIDER_PRIORITY.indexOf(existingProvider);
      const newIdx = this.PROVIDER_PRIORITY.indexOf(sourceProvider);

      // Higher priority is lower index. If newIdx is larger (lower priority) than existingIdx, we skip!
      if (existingIdx !== -1 && newIdx !== -1 && newIdx > existingIdx) {
        console.log(`[ETL] Skipping fixture ${fixture.apiId} update: existing provider '${existingProvider}' has higher priority than '${sourceProvider}'`);
        return existing.id;
      }
    }

    // Upsert the fixture
    const payload = {
      api_id: fixture.apiId,
      competition_id: competitionId,
      season_id: seasonId,
      kickoff_time: fixture.kickoffTime,
      status: fixture.status,
      referee_id: refereeId || null,
      venue_id: venueId || null,
      home_team_id: homeTeamId,
      away_team_id: awayTeamId,
      home_goals: fixture.homeGoals !== undefined ? fixture.homeGoals : null,
      away_goals: fixture.awayGoals !== undefined ? fixture.awayGoals : null,
      ht_home_goals: fixture.htHomeGoals !== undefined ? fixture.htHomeGoals : null,
      ht_away_goals: fixture.htAwayGoals !== undefined ? fixture.htAwayGoals : null,
      details_json: {
        ...(fixture.detailsJson || {}),
        provider: sourceProvider
      },
      updated_at: new Date().toISOString()
    };

    const { data: result, error } = await supabase
      .from('wh_fixtures')
      .upsert(payload, { onConflict: 'api_id' })
      .select('id')
      .single();

    if (error) throw error;
    return result.id;
  }

  /**
   * Safe idempotent ingest for odds snapshots.
   */
  public static async loadMarketSnapshot(
    snapshotData: {
      fixture_id: string;
      bookmaker_id: string;
      source_id: string;
      market_id: string;
      selection: string;
      timestamp: string;
      decimal_odds: number;
    }
  ) {
    if (snapshotData.decimal_odds <= 1.0) {
      console.warn(`[ETL] Invalid odds ${snapshotData.decimal_odds} for fixture ${snapshotData.fixture_id}`);
      return null;
    }

    // Upsert snapshot (it creates a new one or ignores if identical exists, usually append-only based on timestamp)
    // To prevent duplicate spam, check if the exact same odds exist for the same timestamp
    const { data: existing } = await supabase
      .from('wh_market_snapshots')
      .select('id')
      .eq('fixture_id', snapshotData.fixture_id)
      .eq('bookmaker_id', snapshotData.bookmaker_id)
      .eq('market_id', snapshotData.market_id)
      .eq('selection', snapshotData.selection)
      .eq('timestamp', snapshotData.timestamp)
      .maybeSingle();

    if (existing) {
      return existing.id;
    }

    // Basic quality flag
    const qualityFlag = snapshotData.decimal_odds > 100.0 ? 'OUTLIER' : 'NORMAL';

    const { data: inserted, error } = await supabase
      .from('wh_market_snapshots')
      .insert({
        ...snapshotData,
        quality_flag: qualityFlag
      })
      .select('id')
      .single();

    if (error) throw error;
    return inserted.id;
  }
}
