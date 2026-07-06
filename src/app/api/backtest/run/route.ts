// Run Walk-Forward Backtest API Route
// Location: src/app/api/backtest/run/route.ts

import { NextRequest } from 'next/server';
import { BacktestService } from '@/services/backtestService';
import { ApiHelper } from '@/lib/utils/apiHelper';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json();
    const { startDate, endDate, initialBankroll = 10000, minEV = 0.02 } = payload;

    if (!startDate || !endDate) {
      return ApiHelper.response(false, null, 'Parameters startDate and endDate are required', 400);
    }

    const report = await BacktestService.runWalkForwardBacktest({
      startDate,
      endDate,
      initialBankroll,
      minEV
    });

    if (!report) {
      return ApiHelper.response(false, null, 'Backtest simulation failed to yield results', 500);
    }

    return ApiHelper.response(true, report);
  } catch (error: any) {
    console.error('[Run Backtest API] Error:', error);
    return ApiHelper.response(false, null, error.message, 500);
  }
}
