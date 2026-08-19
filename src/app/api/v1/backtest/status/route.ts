import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { BacktestRepository } from '@/lib/homepage/backtest/repository';

// GET /api/v1/backtest/status
// Returns the real persisted backtest status. Never fabricated.
export async function GET(request: NextRequest) {
  try {
    const status = await BacktestRepository.getStatus();
    return ApiHelper.response(true, status);
  } catch (error: any) {
    console.error('[Backtest Status API] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}

// POST /api/v1/backtest/status — trigger a (re)run. Offline/background computation.
// Protected by CRON_SECRET to prevent abuse.
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return ApiHelper.response(false, null, 'Unauthorized', 401);
    }

    const result = await BacktestRepository.computeAndPersist();
    return ApiHelper.response(true, {
      status: result.status,
      datasetVersion: result.datasetVersion,
      modelVersion: result.modelVersion,
      totalBets: result.totalBets,
      roiPct: result.roiPct,
      winRate: result.winRate,
      done: result.status === 'COMPLETE',
    });
  } catch (error: any) {
    console.error('[Backtest Run API] Error:', error);
    return ApiHelper.response(
      false,
      null,
      error?.message || 'Unknown error',
      500
    );
  }
}