import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { oddsApiClient } from '@/lib/apis/oddspapi';

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

    // 4. Live Odds Provider Health
    let oddsProviderStatus: 'LIVE' | 'DEGRADED' | 'INVALID_KEY' | 'NO_DATA' = 'LIVE';
    try {
      const odds = await oddsApiClient.getOdds('soccer_epl', 'uk');
      if (!odds || odds.length === 0) {
        oddsProviderStatus = 'NO_DATA';
      }
    } catch (err: any) {
      if (err.status === 401 || err.message?.includes('API key') || err.details?.error_code === 'INVALID_KEY') {
        oddsProviderStatus = 'INVALID_KEY';
      } else {
        oddsProviderStatus = 'DEGRADED';
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        fixtures_last_ingestion: fixturesLastIngestion,
        predictions_last_run: predictionsLastRun,
        odds_provider: oddsProviderStatus,
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
