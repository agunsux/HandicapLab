import { NextRequest, NextResponse } from 'next/server';
import { CalibrationLaboratoryEngine } from '../../../../lib/scientific-validation/calibration-laboratory';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const league = searchParams.get('league') || 'ALL';

    // Mock dataset for calibration lab
    const predictions: Array<{ predictedProb: number; actualOutcome: 1 | 0 }> = [];
    for (let i = 0; i < 500; i++) {
      const p = Math.random();
      const actual = Math.random() < p ? 1 : 0;
      predictions.push({ predictedProb: p, actualOutcome: actual });
    }

    const report = CalibrationLaboratoryEngine.computeCalibrationReport(predictions, 'v1.37.0', league);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
