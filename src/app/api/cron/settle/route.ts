import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { settleAsianHandicap } from '@/lib/engine/settlement';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';

export async function GET(request: Request) {
  return handleSettle(request);
}

export async function POST(request: Request) {
  return handleSettle(request);
}

async function handleSettle(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('settle');

  try {
    const result = await runSignalsSettlement();
    await CronLogger.end(logId, result.signalsSettled, null);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Settle Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Signals settlement cron error:', error);
    await CronLogger.end(logId, 0, error);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[Settle Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runSignalsSettlement() {
  console.log('[Settlement Cron] Starting signals settlement process...');

  // 1. Fetch pending signals
  const { data: pendingSignals, error: fetchErr } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'pending');

  if (fetchErr) {
    throw new Error(`Failed to fetch pending signals: ${fetchErr.message}`);
  }

  if (pendingSignals && pendingSignals.length > 0) {
    console.log(`[Settlement Cron] Found ${pendingSignals.length} pending signals to process.`);

    // Extract unique match IDs
    const matchIds = Array.from(new Set(pendingSignals.map((s: any) => s.match_id)));

    // Fetch matches (both finished and potential void states like cancelled/postponed)
    const { data: matches, error: matchesErr } = await supabase
      .from('matches')
      .select('id, home_goals, away_goals, status')
      .in('id', matchIds);

    if (matchesErr) {
      throw new Error(`Failed to fetch matches: ${matchesErr.message}`);
    }

    const matchMap = new Map(matches?.map(m => [String(m.id), m]) || []);

    // Process each signal
    for (const signal of pendingSignals) {
      const match = matchMap.get(String(signal.match_id));
      if (!match) continue;

      const isFinished = match.status === 'finished';
      const isVoid = ['cancelled', 'postponed', 'abandoned', 'suspended', 'interrupted', 'void'].includes(match.status);

      if (!isFinished && !isVoid) {
        continue; // Still active
      }

      // A. Transition signal to 'settling'
      await supabase
        .from('signals')
        .update({ status: 'settling', updated_at: new Date().toISOString() })
        .eq('id', signal.id);

      let status = 'lost';
      let profit_loss = -1.0;

      if (isVoid) {
        status = 'void';
        profit_loss = 0.0;
      } else {
        const homeGoals = match.home_goals ?? 0;
        const awayGoals = match.away_goals ?? 0;
        const odds = Number(signal.odds || 1.0);
        const selection = (signal.selection || 'home').toLowerCase() as 'home' | 'away' | 'over' | 'under';
        const market = (signal.market || '').toLowerCase();
        const line = Number(signal.handicap_line || 0.0);

        if (market === 'asian_handicap') {
          const settlement = settleAsianHandicap(homeGoals, awayGoals, line, selection as 'home' | 'away', odds);
          status = settlement.status.toLowerCase();
          profit_loss = settlement.profit_units;
        } else if (market === 'over_under') {
          const totalGoals = homeGoals + awayGoals;
          if (totalGoals === line) {
            status = 'push';
            profit_loss = 0.0;
          } else {
            const isOver = totalGoals > line;
            const won = (selection === 'over' && isOver) || (selection === 'under' && !isOver);
            status = won ? 'won' : 'lost';
            profit_loss = won ? (odds - 1.0) : -1.0;
          }
        } else {
          // Moneyline
          const actualML = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
          const won = selection === actualML;
          status = won ? 'won' : 'lost';
          profit_loss = won ? (odds - 1.0) : -1.0;
        }
      }

      // Compute CLV Percentage
      const openingOdds = Number(signal.opening_odds || signal.odds);
      const closingOdds = Number(signal.closing_odds);
      let clvPercentage = 0.0;
      if (closingOdds && closingOdds > 0 && openingOdds && openingOdds > 0) {
        clvPercentage = Number((((1.0 / closingOdds) - (1.0 / openingOdds)) * 100).toFixed(4));
      }

      // B. Finalize signal update
      await supabase
        .from('signals')
        .update({
          status,
          profit_loss,
          clv_percentage: clvPercentage,
          settled_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', signal.id);

      // C. Settle the corresponding paper trade
      const { data: trade } = await supabase
        .from('paper_trades')
        .select('*')
        .eq('signal_id', signal.id)
        .maybeSingle();

      if (trade) {
        const stakeVal = Number(trade.stake || 10.0);
        const oddsVal = Number(signal.odds || 1.0);
        let tradeProfit = -stakeVal;

        if (status === 'won') {
          tradeProfit = stakeVal * (oddsVal - 1.0);
        } else if (status === 'half_win') {
          tradeProfit = 0.5 * stakeVal * (oddsVal - 1.0);
        } else if (status === 'push' || status === 'void') {
          tradeProfit = 0.0;
        } else if (status === 'half_loss') {
          tradeProfit = -0.5 * stakeVal;
        }

        await supabase
          .from('paper_trades')
          .update({
            result: status,
            profit: Number(tradeProfit.toFixed(2)),
            status: 'settled',
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);
      }
    }
  }

  // 4. Recalculate running bankroll and drawdowns chronologically for all settled paper trades
  const { data: settledTrades, error: tradesErr } = await supabase
    .from('paper_trades')
    .select('id, profit, created_at')
    .eq('status', 'settled')
    .order('created_at', { ascending: true });

  if (tradesErr) {
    throw new Error(`Failed to fetch settled trades for bankroll calculation: ${tradesErr.message}`);
  }

  if (settledTrades && settledTrades.length > 0) {
    let runningBankroll = 1000.0; // Starting Bankroll
    let peakBankroll = 1000.0;

    for (const trade of settledTrades) {
      const profit = Number(trade.profit || 0.0);
      runningBankroll += profit;
      
      if (runningBankroll > peakBankroll) {
        peakBankroll = runningBankroll;
      }

      const drawdown = peakBankroll > 0 ? ((peakBankroll - runningBankroll) / peakBankroll) * 100 : 0.0;

      await supabase
        .from('paper_trades')
        .update({
          bankroll_after: Number(runningBankroll.toFixed(2)),
          drawdown: Number(drawdown.toFixed(2)),
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);
    }
  }

  return {
    signalsSettled: pendingSignals?.length || 0,
    tradesCalculated: settledTrades?.length || 0,
    message: 'Settlement pipeline and paper trading bankroll progression completed.'
  };
}
