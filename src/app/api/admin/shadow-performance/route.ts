import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export async function GET(request: Request) {
  try {
    // 1. Fetch pending shadow predictions
    const { data: pending, error: pendingErr } = await supabase
      .from('shadow_predictions')
      .select('*')
      .eq('result_status', 'pending');

    if (pendingErr) {
      return NextResponse.json({ success: false, error: pendingErr.message }, { status: 500 });
    }

    // 2. Perform shadow settlement
    const updates: any[] = [];
    for (const pred of (pending || [])) {
      const { data: match } = await supabase
        .from('matches')
        .select('*')
        .eq('id', pred.fixture_id)
        .maybeSingle();

      if (match && match.status === 'finished') {
        const homeGoals = Number(match.home_score !== undefined ? match.home_score : match.goals_home);
        const awayGoals = Number(match.away_score !== undefined ? match.away_score : match.goals_away);

        let outcome: 'won' | 'lost' | 'void' = 'lost';

        if (pred.market_type === 'ML') {
          if (pred.predicted_pick === 'home' && homeGoals > awayGoals) {
            outcome = 'won';
          } else if (homeGoals === awayGoals) {
            outcome = 'void';
          }
        } else if (pred.market_type === 'AH') {
          // Parse handicap line e.g. "home_-0.25"
          const parts = pred.predicted_pick.split('_');
          const line = parts[1] ? Number(parts[1]) : 0;
          const diff = homeGoals + line - awayGoals;
          if (diff > 0) {
            outcome = 'won';
          } else if (diff === 0) {
            outcome = 'void';
          }
        } else if (pred.market_type === 'OU') {
          const totalGoals = homeGoals + awayGoals;
          const line = 2.5; // default fallback
          if (pred.predicted_pick === 'over' && totalGoals > line) {
            outcome = 'won';
          } else if (totalGoals === line) {
            outcome = 'void';
          }
        }

        // Fetch closing odds for CLV comparison
        const { data: closingOdds } = await supabase
          .from('odds_snapshots')
          .select('odds_home')
          .eq('match_id', match.id)
          .maybeSingle();

        const closingPrice = closingOdds ? Number(closingOdds.odds_home) : pred.odds_at_prediction;
        const clv = ((pred.odds_at_prediction - closingPrice) / closingPrice) * 100;

        updates.push({
          id: pred.id,
          result_status: outcome,
          settled_at: new Date().toISOString(),
          clv: Number(clv.toFixed(2))
        });
      }
    }

    // Apply updates
    for (const item of updates) {
      await supabase
        .from('shadow_predictions')
        .update({
          result_status: item.result_status,
          settled_at: item.settled_at,
          clv: item.clv
        })
        .eq('id', item.id);
    }

    // 3. Query all settled shadow predictions
    const { data: settled, error: settledErr } = await supabase
      .from('shadow_predictions')
      .select('*')
      .not('result_status', 'eq', 'pending');

    if (settledErr) {
      return NextResponse.json({ success: false, error: settledErr.message }, { status: 500 });
    }

    const total = settled ? settled.length : 0;
    let won = 0;
    let lost = 0;
    let voided = 0;
    let totalClv = 0;
    let totalStakes = 0;
    let totalPayout = 0;

    const marketBreakdowns: Record<string, { total: number; won: number; clv: number }> = {
      AH: { total: 0, won: 0, clv: 0 },
      OU: { total: 0, won: 0, clv: 0 },
      ML: { total: 0, won: 0, clv: 0 }
    };

    for (const s of (settled || [])) {
      totalClv += Number(s.clv || 0);

      const m = s.market_type;
      if (marketBreakdowns[m]) {
        marketBreakdowns[m].total++;
        marketBreakdowns[m].clv += Number(s.clv || 0);
      }

      if (s.result_status === 'won') {
        won++;
        if (marketBreakdowns[m]) marketBreakdowns[m].won++;
        totalStakes += 1.0;
        totalPayout += Number(s.odds_at_prediction);
      } else if (s.result_status === 'lost') {
        lost++;
        totalStakes += 1.0;
      } else {
        voided++;
        totalStakes += 1.0;
        totalPayout += 1.0; // Stake returned
      }
    }

    const settledCount = won + lost + voided;
    const winRate = settledCount > 0 ? (won / settledCount) * 100 : 0;
    const roi = totalStakes > 0 ? ((totalPayout - totalStakes) / totalStakes) * 100 : 0;
    const avgClv = total > 0 ? totalClv / total : 0;

    const breakdownPayload = Object.keys(marketBreakdowns).map(key => {
      const b = marketBreakdowns[key];
      return {
        market: key,
        total: b.total,
        win_rate: b.total > 0 ? Number(((b.won / b.total) * 100).toFixed(2)) : 0,
        average_clv: b.total > 0 ? Number((b.clv / b.total).toFixed(2)) : 0
      };
    });

    return NextResponse.json({
      success: true,
      total_predictions: total + (pending ? pending.length : 0),
      settled_count: settledCount,
      win_rate: Number(winRate.toFixed(2)),
      roi: Number(roi.toFixed(2)),
      clv: Number(avgClv.toFixed(2)),
      breakdowns: breakdownPayload
    });

  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
