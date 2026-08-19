import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { BacktestRepository } from '@/lib/homepage/backtest/repository';

// GET /api/v1/backtest/markets
// Returns market-level performance results from the persisted backtest.
export async function GET(request: NextRequest) {
  try {
    const latest = await BacktestRepository.getLatestRun();

    if (!latest) {
      return ApiHelper.response(true, {
        status: 'READY',
        markets: [],
      });
    }

    return ApiHelper.response(true, {
      status: latest.status,
      datasetVersion: latest.datasetVersion,
      modelVersion: latest.modelVersion,
      markets: latest.markets,
    });
  } catch (error: any) {
    console.error('[Backtest Markets API] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}