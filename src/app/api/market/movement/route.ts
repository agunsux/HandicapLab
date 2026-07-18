// HandicapLab Market Intelligence - Market Movements Log API
// Location: src/app/api/market/movement/route.ts

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { MarketLogRepository } = await import('../../../../lib/data/marketLogRepository.runtime');
    const movements = await MarketLogRepository.getMovements();
    return NextResponse.json({
      count: movements.length,
      movements
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
