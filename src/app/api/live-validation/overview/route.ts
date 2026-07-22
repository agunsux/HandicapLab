import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../live-validation/store';

export async function GET(req: NextRequest) {
  try {
    const store = getLiveValidationStore();

    const [
      rolling7,
      rolling30,
      rolling90,
      rolling365,
      calibration,
      driftEvents,
      alerts,
      reports,
    ] = await Promise.all([
      store.getLatestRollingMetrics(7),
      store.getLatestRollingMetrics(30),
      store.getLatestRollingMetrics(90),
      store.getLatestRollingMetrics(365),
      store.getLatestCalibration(),
      store.listDriftEvents(),
      store.listAlerts(),
      store.listWeeklyReports(),
    ]);

    const recentDrift = driftEvents.slice(-10).reverse();
    const recentAlerts = alerts.slice(-10).reverse();

    return NextResponse.json({
      success: true,
      data: {
        rolling: {
          w7: rolling7,
          w30: rolling30,
          w90: rolling90,
          w365: rolling365,
        },
        calibration,
        recentDrift,
        recentAlerts,
        latestReport: reports[0] || null,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
