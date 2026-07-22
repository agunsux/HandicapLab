import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      success: true,
      data: {
        totalPredictions: 4820,
        settledPredictions: 4510,
        pendingPredictions: 310,
        hitRatePct: 58.4,
        roiPct: 8.4,
        yieldPct: 8.4,
        avgEvPct: 6.2,
        avgClvPct: 4.1,
        positiveClvPct: 78.5,
        brierScore: 0.181,
        ecePct: 1.6,
        maxDrawdownUnits: -8.2,
        longestWinningStreak: 9,
        longestLosingStreak: 5,
        currentModelVersion: 'v1.40.0',
        lastAuditAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
