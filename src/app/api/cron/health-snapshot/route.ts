import { NextResponse } from 'next/server';
import { ModelHealthMonitor } from '@/lib/monitoring/ModelHealthMonitor';
import { RealtimeMetrics } from '@/lib/monitoring/RealtimeMetrics';

/**
 * Cron Route: Hourly Health Snapshot
 * Schedule: 0 * * * * (every hour)
 *
 * Reads current metrics state, runs the full ModelHealthMonitor pipeline,
 * writes an immutable snapshot, and resets real-time accumulators.
 *
 * Secured via CRON_SECRET header.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const realtime = RealtimeMetrics.snapshot();

    // Build a minimal HealthSnapshot from realtime data.
    // Full metric aggregation (Brier, ECE, win rate) comes from AccuracyCalculator
    // which is called by ModelHealthMonitor in production. Here we pass a stub
    // that is enriched by the orchestrator.
    const snapshot = {
      timestamp: new Date(),
      modelVersion: process.env.MODEL_VERSION ?? 'prematch-v1',
      brierScore: 0.25,           // Placeholder — replaced by AccuracyCalculator in prod
      ece: 0,
      winRate: 0,
      avgClv: null,
      decisionAccuracy: 0,
      missedOpportunityRate: 0,
      correctSkipRate: 0,
      avgConfidence: realtime.avgConfidence,
      dataQualityScore: 1.0,
      decisionGatePassRate: realtime.decisionGatePassRate,
      skipRate: realtime.skipRate,
      healthScore: 0,
      healthStatus: 'INSUFFICIENT_DATA' as const,
    };

    const report = await ModelHealthMonitor.run(
      snapshot,
      realtime.avgLatencyMs,
      1.0
    );

    // Reset realtime accumulators after snapshot is written
    RealtimeMetrics.reset();

    return NextResponse.json({
      status: report.status,
      healthScore: report.healthScore.score,
      snapshot: report.snapshot.timestamp,
      drifted: report.drift.overallSeverity,
      recommendationsCount: report.recommendations.length,
    });
  } catch (err: any) {
    console.error('[health-snapshot cron] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
