// HandicapLab / SALMO.DEV - Live Provider Quota Status API
// Location: src/app/api/quota/route.ts
// Invariant: Exposes real runtime quota state with hard limits, soft ceilings, and zero fake numbers.

import { NextResponse } from 'next/server';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';
import { supabase } from '@/lib/supabase.server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
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
    console.error('[API /quota] Error:', err);
    return NextResponse.json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: err.message || 'Failed to inspect provider quotas',
    }, { status: 500 });
  }
}
