import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { WarehouseETL } from '@/lib/warehouse/etl';
import { FeatureStore } from '@/lib/warehouse/featureStore';
import { DatasetManager } from '@/lib/warehouse/datasetManager';

export async function GET(request: Request) {
  try {
    // 1. Ingest upcoming matches from the active teams/matches cache tables
    const { data: matchesCache, error: cacheError } = await supabase
      .from('matches_cache')
      .select('*')
      .order('kickoff', { ascending: true })
      .limit(5);

    if (cacheError) throw cacheError;

    let processedCount = 0;

    // Register default version tag
    const versionTag = 'v1.0.0';
    await DatasetManager.registerFeatureVersion(versionTag, 'Default prematch features');

    for (const rawMatch of matchesCache || []) {
      // Map existing cache match to wh_fixture normalization model
      const mockNormalized = {
        apiId: rawMatch.api_id,
        competitionApiId: rawMatch.league_id,
        seasonYear: new Date(rawMatch.kickoff).getFullYear(),
        kickoffTime: rawMatch.kickoff,
        status: rawMatch.settled_at ? 'finished' : 'scheduled',
        homeTeamApiId: rawMatch.home_team_id,
        awayTeamApiId: rawMatch.away_team_id,
        homeGoals: rawMatch.settled_at ? 2 : undefined,
        awayGoals: rawMatch.settled_at ? 1 : undefined,
        detailsJson: {
          provider: 'api-football',
          clv: rawMatch.clv,
          edge_pct: rawMatch.edge_pct
        }
      };

      const fixtureId = await WarehouseETL.loadFixture(mockNormalized, 'api-football');

      // 2. ELO Calculation on completion
      if (mockNormalized.status === 'finished') {
        const { data: whFixture } = await supabase
          .from('wh_fixtures')
          .select('home_team_id, away_team_id')
          .eq('id', fixtureId)
          .single();

        if (whFixture) {
          await FeatureStore.processEloUpdate(
            fixtureId,
            whFixture.home_team_id,
            whFixture.away_team_id,
            2,
            1,
            mockNormalized.kickoffTime
          );
        }
      }

      // 3. Materialize features in feature store
      await DatasetManager.materializeFixtureFeatures(fixtureId, versionTag);
      processedCount++;
    }

    return NextResponse.json({
      success: true,
      processed: processedCount,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('[Sync Warehouse Cron] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
