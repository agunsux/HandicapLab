import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../../live-validation/store';
import { RollingMetricsEngine } from '../../../../../live-validation/metrics/rolling-metrics';
import { CalibrationMonitor } from '../../../../../live-validation/monitoring/calibration-monitor';
import { DriftDetector } from '../../../../../live-validation/monitoring/drift-detector';
import { AlertEngine } from '../../../../../live-validation/alerts/alert-engine';
import { WeeklyReportGenerator } from '../../../../../live-validation/reports/weekly-report';
import { DEFAULT_LIVE_VALIDATION_CONFIG } from '../../../../../live-validation/config';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  try {
    const store = getLiveValidationStore();
    const correlationId = `cron-metrics-${Date.now()}`;

    // 1. Recompute Rolling Metrics
    const metricsEngine = new RollingMetricsEngine({ store, schemaVersion: '1.0' });
    const metricsRecords = await metricsEngine.run(correlationId);

    // 2. Calibration Monitoring
    const calMonitor = new CalibrationMonitor(store, {
      schemaVersion: '1.0',
      bucketCount: DEFAULT_LIVE_VALIDATION_CONFIG.calibration.bucketCount,
    });
    const calRecord = await calMonitor.evaluateAndPersist(correlationId);

    // 3. Drift Detection
    const driftDetector = new DriftDetector(store, {
      schemaVersion: '1.0',
      warningThreshold: DEFAULT_LIVE_VALIDATION_CONFIG.drift.psiWarningThreshold,
      criticalThreshold: DEFAULT_LIVE_VALIDATION_CONFIG.drift.psiCriticalThreshold,
    });
    const driftEvents = await driftDetector.evaluateAndPersistAll(correlationId);

    // 4. Alert Engine
    const alertEngine = new AlertEngine(store, {
      config: DEFAULT_LIVE_VALIDATION_CONFIG.alerting,
      schemaVersion: '1.0',
    });
    const alerts = await alertEngine.evaluateAndPersist(correlationId);

    // 5. Weekly Scientific Report
    const reportGen = new WeeklyReportGenerator(store, { schemaVersion: '1.0' });
    const weeklyReport = await reportGen.generateAndPersist(correlationId);

    return NextResponse.json({
      success: true,
      summary: {
        rollingMetricsCount: metricsRecords.length,
        calibrationRecordId: calRecord?.id || null,
        driftEventsCount: driftEvents.length,
        alertsFired: alerts.length,
        weeklyReportId: weeklyReport?.id || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
