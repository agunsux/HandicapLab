import { NextRequest, NextResponse } from 'next/server';
import { AhHistoryService } from '@/lib/services/ahHistoryService';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Match ID or observation ID is required' },
        { status: 400 }
      );
    }

    const trace = AhHistoryService.getMatchCalculationTrace(id);
    if (!trace) {
      return NextResponse.json(
        { success: false, error: `Match observation ${id} not found` },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trace,
    });
  } catch (error) {
    console.error('[API /api/ah/matches/:id] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error while retrieving match calculation trace',
      },
      { status: 500 }
    );
  }
}
