// ============================================================================
// CANONICAL SETTLEMENTS API ROUTE
// ============================================================================
// Location: src/app/api/settlements/route.ts
//
// Serves settled predictions from the canonical bet ledger.
// Query params:
//   - market: 'AH' | 'OU' | 'BTTS'
//   - league: filter by competition/league
//   - outcome: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS' | 'VOID'
//   - limit: number of results (default 100)
//   - page: page number (default 1)
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const market = searchParams.get('market')?.toUpperCase();
    const league = searchParams.get('league')?.toLowerCase();
    const outcome = searchParams.get('outcome')?.toUpperCase();
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const page = parseInt(searchParams.get('page') || '1', 10);

    const all = CanonicalBetLedgerService.getSettledPredictions();

    let filtered = all;
    if (market) {
      filtered = filtered.filter((p) => p.market === market);
    }
    if (league) {
      filtered = filtered.filter(
        (p) =>
          p.league.toLowerCase().includes(league) ||
          p.competition.toLowerCase().includes(league)
      );
    }
    if (outcome) {
      filtered = filtered.filter((p) => p.settlement?.outcome === outcome);
    }

    const total = filtered.length;
    const offset = (page - 1) * limit;
    const paginated = filtered.slice(offset, offset + limit);

    return NextResponse.json({
      success: true,
      total,
      page,
      limit,
      settlements: paginated.map((p) => ({
        predictionId: p.predictionId,
        canonicalFixtureId: p.canonicalFixtureId,
        fixture: p.fixture,
        league: p.league,
        kickoffTimestamp: p.kickoffTimestamp,
        market: p.market,
        selection: p.selection,
        line: p.line,
        lineType: p.lineType,
        marketOdds: p.marketOdds,
        modelProbability: p.modelProbability,
        fairOdds: p.fairOdds,
        expectedValue: p.expectedValue,
        confidence: p.confidence,
        settlement: p.settlement,
        clvRecord: p.clvRecord,
      })),
    });
  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || 'Failed to fetch settlements' },
      { status: 500 }
    );
  }
}
