import { NextRequest, NextResponse } from 'next/server';
import { AhUpcomingService } from '@/lib/services/ahUpcomingService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysAheadParam = searchParams.get('daysAhead');
    const daysAhead = daysAheadParam ? parseInt(daysAheadParam, 10) : 7;
    const leagueCode = searchParams.get('league') || undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const result = await AhUpcomingService.getUpcomingAhFixtures({
      daysAhead,
      leagueCode,
      limit,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('[API /api/ah/upcoming] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error while retrieving upcoming AH fixtures',
      },
      { status: 500 }
    );
  }
}
