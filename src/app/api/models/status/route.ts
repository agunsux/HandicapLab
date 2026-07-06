// HandicapLab API - Get Sub-model Performance Comparison
// Location: src/app/api/models/status/route.ts

import { NextResponse } from 'next/server';
import { PerformanceAggregator } from '../../../../lib/paper-trading/performanceAggregator';

export async function GET() {
  try {
    const comparison = await PerformanceAggregator.compareModels();
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      models: comparison
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
