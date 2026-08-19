import { NextRequest } from 'next/server';
import { ApiHelper } from '@/lib/utils/apiHelper';
import { HomepageService } from '@/lib/homepage/service';
import { BacktestRepository } from '@/lib/homepage/backtest/repository';

// Admin diagnostics endpoint — internal observability. Protected by CRON_SECRET.
export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return ApiHelper.response(false, null, 'Unauthorized', 401);
    }

    const [diag, status] = await Promise.all([
      HomepageService.getDiagnostics(),
      BacktestRepository.getStatus(),
    ]);

    return ApiHelper.response(true, {
      ...diag,
      backtestStatus: status,
    });
  } catch (error: any) {
    console.error('[Homepage Intelligence Diagnostics] Error:', error);
    return ApiHelper.response(false, null, error?.message || 'Unknown error', 500);
  }
}