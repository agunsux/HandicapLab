import { NextResponse } from 'next/server';
import { HistoricalDataService } from '@/lib/services/historicalDataService';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const summary = HistoricalDataService.getHistoricalSummary();
    return NextResponse.json(summary, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('[API /public/historical/summary] Error:', error);
    return NextResponse.json(
      { error: 'Historical summary temporarily unavailable.' },
      { status: 500 }
    );
  }
}
