import { NextRequest, NextResponse } from 'next/server';
import { MarketIntelligenceService } from '@/lib/services/marketIntelligenceService';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const market = (searchParams.get('market') as any) || 'all';
    const tier = (searchParams.get('tier') as any) || 'all';
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const format = searchParams.get('format') || 'list';

    if (format === 'summary') {
      const summary = MarketIntelligenceService.getIntelligenceSummary();
      return NextResponse.json(summary, {
        status: 200,
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
        },
      });
    }

    const items = MarketIntelligenceService.getMarketDiscovery({
      market,
      tier,
      limit,
    });

    return NextResponse.json({
      count: items.length,
      rankings: items,
      generatedAt: new Date().toISOString(),
    }, {
      status: 200,
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200',
      },
    });
  } catch (error: any) {
    console.error('[API /public/research/market-discovery] Error:', error);
    return NextResponse.json(
      { error: 'Market discovery data temporarily unavailable.' },
      { status: 500 }
    );
  }
}
