// HandicapLab Market Intelligence - Market Movements Log API
// Location: src/app/api/market/movement/route.ts

import { NextResponse } from 'next/server';
import { MarketLogRepository } from '../../../../lib/data/marketLogRepository';

export async function GET() {
  try {
    const movements = MarketLogRepository.getMovements();
    return NextResponse.json({
      count: movements.length,
      movements
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
// 
