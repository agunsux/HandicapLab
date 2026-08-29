// EPIC 59 — Live Transparent Research Terminal Shadow Pipeline Cron Route
// Location: src/app/api/cron/ah-shadow-pipeline/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { DailyAhShadowPipeline, RESEARCH_HONESTY_BANNER } from '@/lib/pipeline/dailyAhShadowPipeline';
import { AhDataLoader } from '@/lib/research/ah-solo/ahDataLoader';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return handleShadowPipeline(req);
}

export async function POST(req: NextRequest) {
  return handleShadowPipeline(req);
}

async function handleShadowPipeline(req: NextRequest) {
  const startTime = Date.now();

  try {
    // 1. Verify Cron Authorization if configured
    const authHeader = req.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Load historical matches for point-in-time rating calculation
    const { matches } = AhDataLoader.computeDataInventory();

    // 3. Real Live fixture ingestion (APIFOOTBALL_KEY / ODDS_PAPI_KEY)
    const upcomingCandidates = await DailyAhShadowPipeline.fetchLiveUpcomingFixtures();

    // 4. Generate daily predictions for real upcoming fixtures
    const predResult = await DailyAhShadowPipeline.executeDailyPredictions(
      upcomingCandidates,
      matches
    );

    // 5. Fetch real finished fixtures from yesterday and settle
    const finishedCandidates = await DailyAhShadowPipeline.fetchLiveFinishedFixtures();

    const settleResult = await DailyAhShadowPipeline.executeAutomatedSettlement(
      finishedCandidates
    );

    // 6. Generate pipeline execution summary
    const summary = DailyAhShadowPipeline.generatePipelineSummary();

    const totalActions = predResult.generatedRecords.length + settleResult.settledCount;
    const totalFailures = predResult.failures.length + settleResult.failures.length;
    const failureRate = totalActions > 0 ? (totalFailures / (totalActions + totalFailures)) * 100 : 0;

    summary.failuresCount = totalFailures;
    summary.failureRatePct = Number(failureRate.toFixed(1));
    summary.failures = [...predResult.failures, ...settleResult.failures];

    if (failureRate > 10.0) {
      summary.alertTriggered = true;
      console.error('[ShadowPipeline Alert] High failure rate:', failureRate, summary.failures);
    }

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      status: 'SUCCESS',
      mode: 'SHADOW_UNATTENDED',
      monetizationEnabled: false,
      researchHonestyBanner: RESEARCH_HONESTY_BANNER,
      fixturesIngested: upcomingCandidates.length,
      predictionsGenerated: predResult.generatedRecords.length,
      predictionsSettled: settleResult.settledCount,
      summary,
      durationMs,
    });
  } catch (err: any) {
    const message = err.message || String(err);
    console.error('[ShadowPipeline Error]', message);
    return NextResponse.json(
      {
        status: 'ERROR',
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
