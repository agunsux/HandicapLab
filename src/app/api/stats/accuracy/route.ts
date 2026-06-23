import { NextResponse } from 'next/server';
import { AccuracyCalculator } from '@/lib/metrics/accuracy-calculator';

/**
 * GET endpoint for model accuracy stats.
 * Accepts query parameters:
 * - ?model_version=prematch-v1
 * - ?market_type=ML
 * - ?days=30
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const model_version = searchParams.get('model_version') || 'prematch-v1';
    const market_type = searchParams.get('market_type') || undefined;
    const daysParam = searchParams.get('days');
    
    const days = daysParam ? parseInt(daysParam, 10) : 30;

    const metrics = await AccuracyCalculator.getMetrics({
      model_version,
      market_type,
      days: isNaN(days) ? 30 : days
    });

    return NextResponse.json(metrics);
  } catch (error: any) {
    console.error('❌ Accuracy API Error:', error);
    return NextResponse.json(
      { error: 'Internal Server Error', message: error.message },
      { status: 500 }
    );
  }
}
