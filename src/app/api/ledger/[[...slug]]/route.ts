// ============================================================================
// HIGH-CONFIDENCE PREDICTION LEDGER API ROUTE
// ============================================================================
// Location: src/app/api/ledger/[[...slug]]/route.ts
//
// Exposes the immutable virtual bet ledger for HandicapLab -> SALMO.DEV.
// Supports:
// - /api/ledger
// - /api/ledger/high-confidence
//
// Supports filtering by:
// - date (YYYY-MM-DD)
// - market (AH, OU, BTTS)
// - league (competition name)
// - status (RECORDED, LOCKED, AWAITING_RESULT, SETTLED, REJECTED, DATA_ERROR)
// - minConfidence / confidenceBand (LOW, MEDIUM, HIGH, ELITE)
// - limit & offset for pagination
// ============================================================================

import { NextRequest, NextResponse } from 'next/server';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { CONFIDENCE_BANDS, HIGH_CONFIDENCE_THRESHOLD } from '@/lib/ledger/constants';
import { LedgerState } from '@/lib/ledger/types';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const date = searchParams.get('date') || undefined;
    const market = searchParams.get('market')?.toUpperCase() || undefined;
    const league = searchParams.get('league') || undefined;
    const status = (searchParams.get('status')?.toUpperCase() as LedgerState) || undefined;
    const confidenceBand = searchParams.get('confidenceBand')?.toUpperCase();
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10), 0);

    let minConfidence: number | undefined = undefined;
    let maxConfidence: number | undefined = undefined;

    if (confidenceBand) {
      const band = CONFIDENCE_BANDS.find(
        (b) => b.id.toLowerCase() === confidenceBand.toLowerCase()
      );
      if (band) {
        minConfidence = band.min;
        maxConfidence = band.max;
      }
    } else if (searchParams.get('minConfidence')) {
      minConfidence = parseFloat(searchParams.get('minConfidence')!);
    }

    let entries = HighConfidenceLedgerService.getLedgerEntries({
      date,
      market,
      league,
      status,
      minConfidence,
    });

    if (maxConfidence !== undefined) {
      entries = entries.filter((e) => e.confidenceScore <= maxConfidence!);
    }

    // Sort newest kickoff first
    entries.sort((a, b) => new Date(b.kickoffUtc).getTime() - new Date(a.kickoffUtc).getTime());

    const totalCount = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);

    // Attach settlement details if available
    const settlements = DurableLedgerStore.loadSettlements();
    const enrichedEntries = paginatedEntries.map((e) => {
      const settlement = settlements[e.ledgerId] || null;
      return {
        ...e,
        settlement,
      };
    });

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      threshold: HIGH_CONFIDENCE_THRESHOLD,
      totalCount,
      limit,
      offset,
      entries: enrichedEntries,
    });
  } catch (error: any) {
    console.error('[API /api/ledger] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch ledger entries',
      },
      { status: 500 }
    );
  }
}
