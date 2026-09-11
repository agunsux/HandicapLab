import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * DEPRECATED (2026-09-11) — FAIL CLOSED.
 *
 * This route previously returned fabricated metrics: synthetic bookmaker odds
 * derived arithmetically (pinnacleOdds = odds * 0.96), invented xG/CLV driver
 * tags, and hardcoded backtest/ROI/Brier fallbacks. Under the no-fabrication
 * policy it no longer serves data.
 *
 * Real-data alternatives:
 *   - /api/v1/homepage            (combined real homepage payload)
 *   - /api/public/predictions     (active daily picks)
 *   - /api/performance/summary    (real settled performance)
 */
export async function GET() {
  return NextResponse.json(
    {
      error: 'ENDPOINT_DEPRECATED',
      message:
        'This endpoint was removed because it served fabricated metrics. Use /api/v1/homepage, /api/public/predictions or /api/performance/summary.',
    },
    { status: 410 }
  );
}
