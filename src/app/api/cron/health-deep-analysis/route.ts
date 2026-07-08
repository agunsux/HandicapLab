import { NextResponse } from 'next/server';
import { DailyDeepAnalysis } from '@/lib/monitoring/HealthSnapshotWriter';
import { HealthSnapshotWriter } from '@/lib/monitoring/HealthSnapshotWriter';
import { HealthEventLog } from '@/lib/monitoring/HealthEvent';
import { GoldenBaselineRegistry } from '@/lib/monitoring/GoldenBaselineRegistry';

/**
 * Cron Route: Daily Deep Analysis
 * Schedule: 0 3 * * * (every day at 03:00 UTC — after most European fixtures resolve)
 *
 * Runs expensive analysis: PSI, KL Divergence, feature drift, FP/FN trends.
 * Results are stored in the HealthEvent log and returned in the full health report.
 *
 * Secured via CRON_SECRET header.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const modelVersion = process.env.MODEL_VERSION ?? 'prematch-v1';

    // Get recent snapshots for distribution analysis
    const recentSnapshots = HealthSnapshotWriter.getRecent(modelVersion, 24);
    const goldenBaseline = GoldenBaselineRegistry.getActive();

    // Build probability distributions from confidence scores as proxy
    // (in production, use actual predicted probabilities from the predictions table)
    const currentDist = recentSnapshots.map((s) => s.avgConfidence);
    const baselineDist = goldenBaseline
      ? Array(24).fill(goldenBaseline.snapshot.avgConfidence)
      : currentDist;

    const deepAnalysis = DailyDeepAnalysis.run(currentDist, baselineDist);

    // Emit deep analysis complete event
    HealthEventLog.emit(
      'DEEP_ANALYSIS_COMPLETE',
      deepAnalysis.psiScore > 0.2 ? 'critical' : deepAnalysis.psiScore > 0.1 ? 'warning' : 'info',
      modelVersion,
      `Daily deep analysis complete. PSI: ${deepAnalysis.psiScore.toFixed(3)}, KL: ${deepAnalysis.klDivergence.toFixed(3)}.`,
      { deepAnalysis }
    );

    return NextResponse.json({
      psiScore: deepAnalysis.psiScore,
      klDivergence: deepAnalysis.klDivergence,
      falsePositiveTrend: deepAnalysis.falsePositiveTrend,
      falseNegativeTrend: deepAnalysis.falseNegativeTrend,
      rootCauseHints: deepAnalysis.rootCauseHints,
      analysisDate: deepAnalysis.analysisDate,
    });
  } catch (err: any) {
    console.error('[health-deep-analysis cron] Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
