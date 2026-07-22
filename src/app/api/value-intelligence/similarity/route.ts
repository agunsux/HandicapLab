import { NextRequest, NextResponse } from 'next/server';
import { HistoricalSimilarityEngine } from '../../../../lib/value-intelligence/similarity-engine';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const league = searchParams.get('league') || 'Premier League';
    const market = (searchParams.get('market') as any) || 'moneyline';
    const minOdds = Number(searchParams.get('minOdds') || '2.00');
    const maxOdds = Number(searchParams.get('maxOdds') || '2.00');
    const minEv = Number(searchParams.get('minEv') || '0.05');

    const evidence = HistoricalSimilarityEngine.queryHistoricalEvidence({
      league,
      market,
      minOdds,
      maxOdds,
      minEv,
    });

    return NextResponse.json({ success: true, data: evidence });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
