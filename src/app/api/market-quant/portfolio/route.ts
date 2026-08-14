import { NextRequest, NextResponse } from 'next/server';
import { PortfolioRiskEngine } from '../../../../lib/quant-market/portfolio-risk-engine';
import { supabase } from '../../../../lib/supabase.server';

export async function GET(req: NextRequest) {
  try {
    const { data: rows, error } = await supabase
      .from('predictions')
      .select(`
        id,
        match_id,
        market_type,
        fair_odds,
        entry_odds,
        edge_pct,
        prediction,
        matches (
          league,
          home_team,
          away_team
        )
      `)
      .gt('edge_pct', 0.02)
      .limit(20);

    const candidateBets = (rows || []).map((r: any) => {
      const match = Array.isArray(r.matches) ? r.matches[0] : r.matches;
      const modelProb = r.fair_odds > 0 ? 1 / r.fair_odds : (r.prediction?.home_prob || 0.5);
      const bOdds = r.entry_odds || 2.0;
      const ev = (modelProb * bOdds) - 1;
      const b = bOdds - 1;
      const kelly = b > 0 ? Math.max(0, (b * modelProb - (1 - modelProb)) / b) : 0;

      return {
        fixtureId: r.match_id || r.id,
        league: match?.league || 'Whitelisted League',
        market: r.market_type || 'asian_handicap',
        modelProb: Number(modelProb.toFixed(4)),
        bookmakerOdds: Number(bOdds.toFixed(2)),
        ev: Number(ev.toFixed(4)),
        fullKellyStakePct: Number(kelly.toFixed(4)),
      };
    });

    const report = PortfolioRiskEngine.optimizePortfolio(candidateBets, 1000, 0.05);

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
