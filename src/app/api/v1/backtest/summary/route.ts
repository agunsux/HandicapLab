import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { BacktestRepository } from '@/lib/homepage/backtest/repository';

// GET /api/v1/backtest/summary
// Returns the latest persisted backtest summary metrics from the database.
export async function GET(request: NextRequest) {
  try {
    const latest = await BacktestRepository.getLatestRun();

    if (!latest) {
      return ApiHelper.response(true, {
        status: 'READY',
        datasetVersion: 'europe-dataset-v1',
        summary: {
          matches: null,
          bets: null,
          winRate: null,
          roi: null,
          clv: null,
          brierScore: null,
          logLoss: null,
        },
        markets: [],
      });
    }

    return ApiHelper.response(true, {
      status: latest.status,
      datasetVersion: latest.datasetVersion,
      modelVersion: latest.modelVersion,
      backtestVersion: latest.backtestVersion,
      windowStart: latest.windowStart,
      windowEnd: latest.windowEnd,
      methodology: latest.methodology,
      summary: {
        matches: latest.matchesTested,
        bets: latest.totalBets,
        winRate: latest.winRate,
        roi: latest.roiPct,
        clv: latest.avgClvPct,
        brierScore: latest.brierScore,
        logLoss: latest.logLoss,
        maxDrawdown: latest.maxDrawdown,
        avgEv: latest.avgEvPct,
        profitUnits: latest.profitUnits,
        stakeUnits: latest.stakeUnits,
        ci95Low: latest.ci95Low,
        ci95High: latest.ci95High,
      },
      markets: latest.markets,
    });
  } catch (error: any) {
    console.error('[Backtest Summary API] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}