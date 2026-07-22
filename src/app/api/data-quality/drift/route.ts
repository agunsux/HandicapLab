import { NextRequest, NextResponse } from 'next/server';
import { FeatureDriftDetectorEngine } from '../../../../lib/data-quality/feature-drift-detector';

export async function GET(req: NextRequest) {
  try {
    const driftReports = [
      FeatureDriftDetectorEngine.detectFeatureDrift('Average xG Generation', 1.42, 1.08, 15.0, 30.0),
      FeatureDriftDetectorEngine.detectFeatureDrift('Average Decimal Odds', 2.01, 2.45, 15.0, 30.0),
      FeatureDriftDetectorEngine.detectFeatureDrift('PPDA Defensive Intensity', 10.5, 10.8, 15.0, 30.0),
    ];

    return NextResponse.json({
      success: true,
      data: driftReports,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
