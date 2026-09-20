// HandicapLab / SALMO.DEV - Live Production Providers & Quota Status API
// Location: src/app/api/providers/route.ts
// Invariant: Zero mock data, returns live provider availability and capabilities.
// Absorbs:
//   - GET /api/providers (default): provider availability & registry
//   - GET /api/providers?view=quota (absorbed from /api/quota): runtime quota telemetry

import { NextRequest, NextResponse } from 'next/server';
import { ProviderRegistry } from '@/lib/data-platform/providerRegistry';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';
import { supabase } from '@/lib/supabase.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const view = searchParams.get('view');

  // Quota Status view (absorbed from /api/quota)
  if (view === 'quota') {
    try {
      // 1. Live API-Football quota check
      const apifootballLive = await DailyPicksEngine.getApiFootballQuotaStatus();
      const apifootballDbSnapshot = await getQuotaSnapshot('apifootball').catch(() => null);

      // 2. Live OddsPapi quota check
      const oddspapiLive = await DailyPicksEngine.getOddsPapiQuotaStatus();
      const oddspapiDbSnapshot = await getQuotaSnapshot('oddspapi').catch(() => null);

      // 3. FootyStats connection check
      let footyStatsConnected = false;
      try {
        const footyData = await DailyPicksEngine.fetchFootyStatsEnrichment();
        footyStatsConnected = Boolean(footyData && (footyData.data || footyData.status));
      } catch {
        footyStatsConnected = false;
      }

      // 4. Supabase DB Check
      let supabaseStatus = 'CONNECTED';
      try {
        const { error } = await supabase.from('daily_picks').select('id').limit(1);
        if (error) supabaseStatus = 'DEGRADED';
      } catch {
        supabaseStatus = 'ERROR';
      }

      const nowUtc = new Date().toISOString();

      return NextResponse.json({
        success: true,
        timestamp: nowUtc,
        canonicalDomain: 'salmo.dev',
        providers: {
          apiFootball: {
            name: 'API-Football PRO',
            tier: 'PRO (7,500 req/day)',
            period: 'daily',
            limit: apifootballLive.limit || 7500,
            remaining: apifootballLive.remaining,
            consumed: (apifootballLive.limit || 7500) - apifootballLive.remaining,
            status: apifootballLive.status,
            dbSnapshot: apifootballDbSnapshot ? {
              consumed: apifootballDbSnapshot.consumed,
              reserved: apifootballDbSnapshot.reserved,
              hardRemaining: apifootballDbSnapshot.hardRemaining,
              mode: apifootballDbSnapshot.mode,
            } : null,
          },
          oddsPapi: {
            name: 'OddsPapi v4',
            tier: 'Developer (250 req/month)',
            period: 'monthly',
            hardLimit: 250,
            softCeiling: 200, // 80% safety margin per EPIC 57
            used: oddspapiLive.used,
            remaining: oddspapiLive.remaining,
            allowed: oddspapiLive.allowed,
            status: oddspapiLive.status,
            dbSnapshot: oddspapiDbSnapshot ? {
              consumed: oddspapiDbSnapshot.consumed,
              reserved: oddspapiDbSnapshot.reserved,
              hardRemaining: oddspapiDbSnapshot.hardRemaining,
              mode: oddspapiDbSnapshot.mode,
            } : null,
          },
          footyStats: {
            name: 'FootyStats API',
            tier: 'Standard / EPL Enrichment',
            status: footyStatsConnected ? 'CONNECTED' : 'UNAVAILABLE',
            notes: 'Enrichment for EPL xG/form statistics where available; pipeline fails closed if required data missing',
          },
          supabase: {
            name: 'Supabase PostgreSQL',
            status: supabaseStatus,
            tables: ['matches', 'daily_picks', 'prediction_ledger_v3', 'predictions'],
          },
        },
      }, {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Data-Source': 'live-production',
          'X-Canonical-Domain': 'salmo.dev',
        },
      });
    } catch (err: any) {
      console.error('[API /providers?view=quota] Error:', err);
      return NextResponse.json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to inspect provider quotas',
      }, { status: 500 });
    }
  }

  // Default Providers registry view
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

    return NextResponse.json(
      {
        success: true,
        canonicalDomain: 'salmo.dev',
        totalProviders: providers.length,
        providers,
        asOfUtc: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'X-Data-Source': 'live-production',
          'X-Canonical-Domain': 'salmo.dev',
        },
      }
    );
  } catch (err: any) {
    console.error('[API /providers] Error:', err);
    return NextResponse.json(
      {
        success: false,
        error: 'INTERNAL_ERROR',
        message: err.message || 'Failed to inspect provider health',
      },
      { status: 500 }
    );
  }
}
