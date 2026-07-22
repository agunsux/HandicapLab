import { NextRequest, NextResponse } from 'next/server';
import { PortfolioRiskEngine } from '../../../../lib/quant-market/portfolio-risk-engine';

export async function GET(req: NextRequest) {
  try {
    const mockBets = [
      { fixtureId: 'f-1', league: 'Premier League', market: 'asian_handicap', modelProb: 0.58, bookmakerOdds: 2.05, ev: 0.189, fullKellyStakePct: 0.18 },
      { fixtureId: 'f-2', league: 'La Liga', market: 'moneyline', modelProb: 0.53, bookmakerOdds: 2.15, ev: 0.139, fullKellyStakePct: 0.12 },
      { fixtureId: 'f-3', league: 'Bundesliga', market: 'over_under', modelProb: 0.59, bookmakerOdds: 1.95, ev: 0.150, fullKellyStakePct: 0.15 },
    ];

    const report = PortfolioRiskEngine.optimizePortfolio(mockBets, 1000, 0.05);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
