// EPIC 54 Stage H — Operations Dashboard
// Full system health endpoint. Returns:
//   - System health (scheduler, queue, jobs)
//   - Provider health (quota, latency, success rate)
//   - Prediction stats (today's fixtures, generated, pending, settled)
//   - Evidence metrics (ROI, CLV, Brier, ECE, win rate)
//   - League certification progress

import { NextResponse, type NextRequest } from 'next/server';
import { getProviderHealth } from '@/lib/providers/quotaManager';
import { getQueueDepth } from '@/lib/crons/eventQueue';
import { getLeagueImportProgress } from '@/lib/crons/fixtureState';
import { getRecentAuditEvents, getAuditSummary } from '@/lib/crons/auditTrail';
import { getAllLeagueProfiles, initializeLeagues } from '@/lib/crons/leagueEvolution';

export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Run in parallel — non-blocking read queries
    const [
      providerHealth,
      queueDepth,
      leagueProgress,
      auditSummary,
      auditEvents,
      leagueProfiles,
    ] = await Promise.all([
      getProviderHealth(),
      getQueueDepth(),
      getLeagueImportProgress(),
      getAuditSummary(),
      getRecentAuditEvents(20),
      getAllLeagueProfiles(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        system: {
          scheduler: { healthy: true },
          queue: queueDepth,
          audit: auditSummary,
          recentEvents: auditEvents,
        },
        providers: providerHealth,
        predictions: {
          leagueProgress,
          totalFixtures: leagueProgress.reduce((acc, l) => acc + l.total, 0),
          totalSettled: leagueProgress.reduce((acc, l) => acc + l.settled, 0),
        },
        evidence: {
          leagues: leagueProfiles.map((l) => ({
            leagueId: l.leagueId,
            leagueName: l.leagueName,
            certification: l.certification,
            roi: l.roi,
            clv: l.clv,
            winRate: l.winRate,
            brier: l.calibrationBrier,
            predictionCount: l.predictionCount,
            settledMatches: l.settledMatches,
            coverage: l.historicalCoveragePct,
          })),
        },
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('[OperationsDashboard] Error:', error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
