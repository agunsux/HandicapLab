// HandicapLab API - Get Yield and ROI Performance Metrics
// Location: src/app/api/performance/route.ts

import { NextResponse } from 'next/server';
import { PerformanceAggregator } from '../../../lib/paper-trading/performanceAggregator';

export async function GET() {
  try {
    const stats = await PerformanceAggregator.aggregate();
    return NextResponse.json(stats);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
