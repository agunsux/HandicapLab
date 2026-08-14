// HandicapLab Market Intelligence - Market History timeline API
// Location: src/app/api/market/history/[id]/route.ts

import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: matchId } = await params;
    const { MarketLogRepository } = await import('../../../../../lib/data/marketLogRepository.runtime');
    const localMovements = await MarketLogRepository.getMovements(matchId);

    return NextResponse.json({
      matchId,
      providerEvents: localMovements,
      localMovements
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
