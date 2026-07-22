import { NextRequest, NextResponse } from 'next/server';
import { ReliabilityDashboardEngine } from '../../../../lib/scientific-validation/reliability-dashboard';
import { ConfidenceIntervalEngine } from '../../../../lib/scientific-validation/confidence-interval-engine';

export async function GET(req: NextRequest) {
  try {
    const summary = ReliabilityDashboardEngine.getModelReliabilitySummary();
    const ciSample = ConfidenceIntervalEngine.calculateWilsonInterval(0.64, 150);

    return NextResponse.json({
      success: true,
      data: {
        summary,
        confidenceSample: ciSample,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
