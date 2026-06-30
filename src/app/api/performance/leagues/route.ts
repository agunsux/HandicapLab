import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase.server';
import { LEAGUE_REGISTRY } from '../../../../lib/crons/leagueRegistry';

export async function GET(request: Request) {
  try {
    const { data: signals, error } = await supabase
      .from('signals')
      .select('*')
      .not('settled_at', 'is', null);

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }

    const priorityALeagues = new Set(
      LEAGUE_REGISTRY.filter(l => l.validation_priority === 'A').map(l => l.name)
    );
    const filteredSignals = (signals || []).filter(sig => sig.league && priorityALeagues.has(sig.league));

    const leagueStats: Record<string, {
      league: string;
      bets: number;
      wins: number;
      profitUnits: number;
      clvSum: number;
      clvCount: number;
    }> = {};

    filteredSignals.forEach(sig => {
      const lg = sig.league || 'Other';
      if (!leagueStats[lg]) {
        leagueStats[lg] = {
          league: lg,
          bets: 0,
          wins: 0,
          profitUnits: 0,
          clvSum: 0,
          clvCount: 0
        };
      }

      const stats = leagueStats[lg];
      stats.bets++;

      const odds = Number(sig.odds || 1.0);
      const status = (sig.status || 'pending').toLowerCase();
      let profit = 0;

      if (status === 'won' || status === 'win') {
        profit = odds - 1.0;
        stats.wins++;
      } else if (status === 'half_win') {
        profit = 0.5 * (odds - 1.0);
        stats.wins++;
      } else if (status === 'push' || status === 'void') {
        profit = 0.0;
      } else if (status === 'half_loss') {
        profit = -0.5;
      } else {
        profit = -1.0;
      }

      stats.profitUnits += profit;

      const clvPct = sig.clv_percentage !== null && sig.clv_percentage !== undefined
        ? Number(sig.clv_percentage)
        : null;
      if (clvPct !== null) {
        stats.clvSum += clvPct;
        stats.clvCount++;
      }
    });

    const breakdown = Object.values(leagueStats).map(s => {
      const roi = s.bets > 0 ? (s.profitUnits / s.bets) * 100 : 0.0;
      const clv = s.clvCount > 0 ? s.clvSum / s.clvCount : 0.0;
      const accuracy = s.bets > 0 ? (s.wins / s.bets) * 100 : 0.0;

      return {
        league: s.league,
        bets: s.bets,
        roi: Number(roi.toFixed(2)),
        clv: Number(clv.toFixed(2)),
        accuracy: Number(accuracy.toFixed(2))
      };
    }).sort((a, b) => b.bets - a.bets);

    return NextResponse.json({
      success: true,
      breakdown
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
