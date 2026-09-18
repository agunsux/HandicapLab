import { NextRequest, NextResponse } from 'next/server';
import { AhHistoryService } from '@/lib/services/ahHistoryService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ league: string }> }
) {
  try {
    const { league } = await params;
    if (!league) {
      return NextResponse.json(
        { success: false, error: 'League parameter is required' },
        { status: 400 }
      );
    }

    const breakdown = AhHistoryService.getLeagueBreakdown(league);

    return NextResponse.json({
      success: true,
      data: breakdown,
      datasetUpdated: AhHistoryService.getDatasetFreshness(),
    });
  } catch (error) {
    console.error('[API /api/ah/history/:league] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error while retrieving league breakdown',
      },
      { status: 500 }
    );
  }
}
