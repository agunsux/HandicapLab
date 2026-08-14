import { NextRequest, NextResponse } from 'next/server';
import { CalibrationLaboratoryEngine } from '../../../../lib/scientific-validation/calibration-laboratory';
import fs from 'fs';
import path from 'path';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const league = searchParams.get('league') || 'ALL';

    const predictions: Array<{ predictedProb: number; actualOutcome: 1 | 0 }> = [];
    const filePath = path.join(process.cwd(), 'data', 'historical', 'out_of_sample_predictions.jsonl');

    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          const p = typeof parsed.cal_probability === 'number' ? parsed.cal_probability : parsed.model_probability;
          const actual = parsed.outcome === 'WIN' ? 1 : 0;
          if (typeof p === 'number' && !isNaN(p)) {
            predictions.push({ predictedProb: p, actualOutcome: actual });
          }
        } catch {
          // ignore malformed line
        }
      }
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
