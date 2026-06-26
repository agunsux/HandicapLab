import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { settleAsianHandicap } from '@/lib/engine/settlement';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSignalsSettlement();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Signals settlement cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runSignalsSettlement();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('Signals settlement cron error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function runSignalsSettlement() {
  console.log('[Settlement Cron] Starting signals settlement process...');

  // 1. Fetch pending signals only (Idempotency safeguard: already settled signals are ignored)
  const { data: pendingSignals, error: fetchErr } = await supabase
    .from('signals')
    .select('*')
    .eq('status', 'pending');

  if (fetchErr) {
    throw new Error(`Failed to fetch pending signals: ${fetchErr.message}`);
  }

  if (!pendingSignals || pendingSignals.length === 0) {
    return { signalsSettled: 0, message: 'No pending signals to settle.' };
  }

  console.log(`[Settlement Cron] Found ${pendingSignals.length} pending signals to process.`);

  // Extract unique match IDs
  const matchIds = Array.from(new Set(pendingSignals.map((s: any) => s.match_id)));

  // 2. Fetch corresponding matches from our database that are finished
  const { data: finishedMatches, error: matchesErr } = await supabase
    .from('matches')
    .select('id, home_goals, away_goals, status')
    .in('id', matchIds)
    .eq('status', 'finished');

  if (matchesErr) {
    throw new Error(`Failed to fetch finished matches: ${matchesErr.message}`);
  }

  if (!finishedMatches || finishedMatches.length === 0) {
    return { signalsSettled: 0, message: 'No finished matches found for the pending signals.' };
  }

  const matchMap = new Map(finishedMatches.map(m => [String(m.id), m]));
  let signalsSettledCount = 0;

  // 3. Process each signal
  for (const signal of pendingSignals) {
    const match = matchMap.get(String(signal.match_id));
    if (!match) continue; // Match not finished or not found yet

    const homeGoals = match.home_goals ?? 0;
    const awayGoals = match.away_goals ?? 0;
    const odds = Number(signal.odds || 1.0);
    const selection = (signal.selection || 'home').toLowerCase() as 'home' | 'away';
    const market = (signal.market || '').toLowerCase();
    const line = Number(signal.handicap_line || 0.0);

    let status = 'LOST';
    let profit_loss = -1.0;

    if (market === 'asian_handicap') {
      // Call settleAsianHandicap()
      const settlement = settleAsianHandicap(homeGoals, awayGoals, line, selection, odds);
      status = settlement.status;
      profit_loss = settlement.profit_units;
    } else if (market === 'over_under') {
      // Over/Under settlement
      const totalGoals = homeGoals + awayGoals;
      if (totalGoals === line) {
        status = 'PUSH';
        profit_loss = 0.0;
      } else {
        const isOver = totalGoals > line;
        const won = (signal.selection === 'over' && isOver) || (signal.selection === 'under' && !isOver);
        status = won ? 'WON' : 'LOST';
        profit_loss = won ? (odds - 1.0) : -1.0;
      }
    } else {
      // Moneyline settlement
      const actualML = homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away';
      const won = signal.selection === actualML;
      status = won ? 'WON' : 'LOST';
      profit_loss = won ? (odds - 1.0) : -1.0;
    }

    // Update signal row in DB
    const { error: updateErr } = await supabase
      .from('signals')
      .update({
        status: status.toLowerCase(),
        profit_loss,
        settled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', signal.id);

    if (updateErr) {
      console.error(`[Settlement Cron] Error updating signal ${signal.id}:`, updateErr);
    } else {
      signalsSettledCount++;
    }
  }

  return {
    signalsSettled: signalsSettledCount,
    message: `Settle process completed. Settled ${signalsSettledCount} signals.`
  };
}
