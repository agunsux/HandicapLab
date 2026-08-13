import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { oddsPapiV4Provider } from '@/lib/data/providers/odds/native';

export async function GET() {
  try {
    // 1. Fixtures last ingestion
    const { data: latestMatch } = await supabase
      .from('matches')
      .select('created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const fixturesLastIngestion = latestMatch?.created_at || null;

    // 2. Predictions last run
    const { data: latestPred } = await supabase
      .from('prediction_ledger_v3')
      .select('prediction_timestamp')
      .order('prediction_timestamp', { ascending: false })
      .limit(1)
      .maybeSingle();

    const predictionsLastRun = latestPred?.prediction_timestamp || null;

    // 3. Settled count (strictly ledger rows with actual_outcome IS NOT NULL per Guardrail #1)
    const { count: settledCount } = await supabase
      .from('prediction_ledger_v3')
      .select('*', { count: 'exact', head: true })
      .not('actual_outcome', 'is', null);

    const actualSettledCount = settledCount || 0;

    // 4. Live Odds Provider Health — native OddsPAPI v4 adapter
    const oddsStatus = await oddsPapiV4Provider.getProviderStatus();

    const oddsProviderStatusMap: Record<string, string> = {
      HEALTHY: 'LIVE',
      INVALID_KEY: 'INVALID_KEY',
      RATE_LIMITED: 'RATE_LIMITED',
      NO_ODDS: 'NO_DATA',
      DEGRADED: 'DEGRADED',
      PARSING_ERROR: 'PARSING_ERROR',
      QUOTA: 'DEGRADED',
      UNKNOWN: 'DEGRADED',
    };

    return NextResponse.json({
      success: true,
      data: {
        fixtures_last_ingestion: fixturesLastIngestion,
        predictions_last_run: predictionsLastRun,
        odds_provider: oddsProviderStatusMap[oddsStatus.status] ?? 'DEGRADED',
        odds_provider_detail: {
          status: oddsStatus.status,
          fixture_count: oddsStatus.fixtureCount,
          snapshot_count: oddsStatus.snapshotCount,
          verified_bookmakers: oddsStatus.verifiedBookmakers,
          unavailable_bookmakers: oddsStatus.unavailableBookmakers,
          market_ids: oddsStatus.marketIds,
          http_status: oddsStatus.httpStatus ?? null,
          error_code: oddsStatus.errorCode ?? null,
        },
        settled_count: actualSettledCount,
        leagues_modeled: 5,
      },
    });
  } catch (error: any) {
    console.error('Engine Status API Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Error',
    }, { status: 500 });
  }
}
