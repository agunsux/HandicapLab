import { NextRequest, NextResponse } from 'next/server';
import { AhHistoryService, type AhHistoryFilters } from '@/lib/services/ahHistoryService';
import type { AhSide, AhFavoriteStatus, AhProvenance } from '@/lib/research/ah-yield/ahTypes';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const league = searchParams.get('league') || undefined;
    const season = searchParams.get('season') || undefined;
    const lineParam = searchParams.get('line');
    const line = lineParam !== null && lineParam !== '' ? Number(lineParam) : undefined;
    const side = (searchParams.get('side') as AhSide) || undefined;
    const favoriteStatus = (searchParams.get('favoriteStatus') as AhFavoriteStatus) || undefined;
    const provenance = (searchParams.get('provenance') as AhProvenance) || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;

    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(Math.max(1, parseInt(limitParam, 10)), 200) : 50;

    const offsetParam = searchParams.get('offset');
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0;

    const filters: AhHistoryFilters = {
      league,
      season,
      line,
      side,
      favoriteStatus,
      provenance,
      startDate,
      endDate,
      limit,
      offset,
    };

    const result = AhHistoryService.queryObservations(filters);
    const availableFilters = AhHistoryService.getAvailableFilters();

    return NextResponse.json({
      success: true,
      data: result,
      availableFilters,
    });
  } catch (error) {
    console.error('[API /api/ah/history] Query error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Internal server error while querying AH history',
      },
      { status: 500 }
    );
  }
}
