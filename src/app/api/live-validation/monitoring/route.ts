import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../live-validation/store';

export async function GET(req: NextRequest) {
  try {
    const store = getLiveValidationStore();
    const [calibrationHistory, driftEvents] = await Promise.all([
      store.listCalibrationHistory(),
      store.listDriftEvents(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        calibrationHistory,
        driftEvents,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
