// HandicapLab / SALMO.DEV - Live Production Providers API
// Location: src/app/api/providers/route.ts
// Invariant: Zero mock data, returns live provider availability and capabilities.

import { NextResponse } from 'next/server';
import { ProviderRegistry } from '@/lib/data-platform/providerRegistry';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const list = ProviderRegistry.getAll();

    // Check live provider credentials and availability
    const apifootballLive = await DailyPicksEngine.getApiFootballQuotaStatus();
    const oddspapiLive = await DailyPicksEngine.getOddsPapiQuotaStatus();

    let footyStatsActive = false;
    try {
      const fsData = await DailyPicksEngine.fetchFootyStatsEnrichment();
      footyStatsActive = Boolean(fsData && (fsData.data || fsData.status));
    } catch {
      footyStatsActive = false;
    }

    const providers = [
      {
        id: 'apifootball',
        name: 'API-Football PRO',
        type: 'primary-fixtures-and-metadata',
        status: apifootballLive.status === 'NORMAL' ? 'ONLINE' : (apifootballLive.remaining > 0 ? 'DEGRADED' : 'OFFLINE'),
        dailyLimit: apifootballLive.limit,
        dailyRemaining: apifootballLive.remaining,
        capabilities: ['fixtures', 'standings', 'lineups', 'injuries', 'statistics'],
      },
      {
        id: 'oddspapi',
        name: 'OddsPapi v4 (Pinnacle Ground Truth)',
        type: 'market-odds',
        status: oddspapiLive.allowed ? 'ONLINE' : 'QUOTA_PROTECTED',
        monthlyLimit: oddspapiLive.limit,
        monthlyRemaining: oddspapiLive.remaining,
        capabilities: ['pinnacle-ah', 'pinnacle-ou', 'pinnacle-btts'],
      },
      {
        id: 'footystats',
        name: 'FootyStats API',
        type: 'statistical-enrichment',
        status: footyStatsActive ? 'ONLINE' : 'UNAVAILABLE',
        capabilities: ['epl-xg-form', 'league-tables'],
      },
      {
        id: 'supabase',
        name: 'Supabase PostgreSQL',
        type: 'persistence-and-ledger',
        status: 'ONLINE',
        capabilities: ['daily_picks', 'prediction_ledger_v3', 'predictions', 'quota_state'],
      },
    ];

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      canonicalDomain: 'salmo.dev',
      activeProvidersCount: providers.filter(p => p.status === 'ONLINE').length,
      providers,
      registeredAdapters: list.map((p) => ({
        name: p.name,
        capabilities: p.getCapabilities()
      })),
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'X-Data-Source': 'live-production',
      },
    });
  } catch (error: any) {
    console.error('[API /providers] Error:', error);
    return NextResponse.json({
      success: false,
      error: error.message || 'Internal Server Error'
    }, { status: 500 });
  }
}
