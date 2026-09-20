// ============================================================================
// AUTOMATIC RECONCILIATION & PUBLISHING CRON ROUTE
// ============================================================================
// Location: src/app/api/cron/publishing-reconcile/route.ts
//
// Triggered automatically by scheduler / cron / webhook worker.
// Executes the complete reconciliation and publication loop:
//   Discovers upcoming fixtures
//   Reconciles live Pinnacle odds
//   Evaluates Dixon-Coles model & ValueEngine confidence
//   Applies Production Validity Gate (separate from confidence)
//   Publishes valid signals, updates changed signals, retires expired signals
//   Records immutable transition audit trail
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return handleReconcile(request);
}

export async function POST(request: NextRequest) {
  return handleReconcile(request);
}

async function handleReconcile(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Verify authorization if CRON_SECRET is configured
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    const searchParams = request.nextUrl.searchParams;
    const token = searchParams.get('token');
    if (token !== cronSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const searchParams = request.nextUrl.searchParams;
  const forceRefresh = searchParams.get('force') === 'true' || searchParams.get('refresh') === 'true';

  try {
    const report = await ProductionPublishingEngine.reconcileAndPublish({
      triggeredBy: 'SCHEDULER_CRON',
      forceRefresh,
    });

    return NextResponse.json({
      success: true,
      message: 'Automatic production publishing reconciliation complete.',
      report,
    });
  } catch (error: any) {
    console.error('[API /api/cron/publishing-reconcile] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Reconciliation failed',
      },
      { status: 500 }
    );
  }
}
