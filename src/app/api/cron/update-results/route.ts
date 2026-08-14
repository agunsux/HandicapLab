import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('🚀 Starting Paper Trades Settlement...');

    // Fetch PENDING paper_trades
    const { data: pendingTrades, error: tradesErr } = await supabase
      .from('paper_trades')
      .select(`
        id, match_id, market_type, selection, stake, odds, entry_odds, status,
        matches (
          home_goals, away_goals, status, kickoff
        )
      `)
      .ilike('status', 'pending');

    if (tradesErr) throw new Error(tradesErr.message);
    if (!pendingTrades || pendingTrades.length === 0) {
      return NextResponse.json({ success: true, message: 'No pending paper trades.' });
    }

    let won = 0;
    let lost = 0;
    let stillPending = 0;
    let voided = 0;

    for (const trade of pendingTrades) {
      const match = Array.isArray(trade.matches) ? trade.matches[0] : trade.matches;
      if (!match) {
        stillPending++;
        continue;
      }

      // Check if match is finished and date is past
      if (match.status !== 'finished' || new Date(match.kickoff).getTime() > Date.now()) {
        stillPending++;
        continue;
      }

      const homeGoals = Number(match.home_goals || 0);
      const awayGoals = Number(match.away_goals || 0);
      const entryOdds = Number(trade.entry_odds || trade.odds || 1.95);
      const stake = Number(trade.stake || 100);

      let tradeStatus: 'WON' | 'LOST' | 'VOID' | 'PENDING' = 'PENDING';
      let profitLoss = 0;

      const market = String(trade.market_type).toUpperCase();
      const selection = String(trade.selection).toLowerCase();

      if (market === 'ML') {
        const actualWinner = homeGoals > awayGoals ? 'home' : (homeGoals === awayGoals ? 'draw' : 'away');
        if (selection === actualWinner) {
          tradeStatus = 'WON';
          profitLoss = (entryOdds - 1) * stake;
        } else {
          tradeStatus = 'LOST';
          profitLoss = -stake;
        }
      } else if (market === 'AH') {
        // Simple AH logic: assuming basic line based on selection
        // Since we don't have handicap line in paper_trades easily accessible here without prediction,
        // We'll fetch the line from predictions if needed, or assume -0.5 for home win logic.
        // Wait, we need the prediction to get the ah_line!
        // But the prompt says: AH: (home_goals - away_goals + handicap) > 0 -> WON (home).
        // Let's fetch the prediction linked to this trade.
        const { data: predData } = await supabase
          .from('predictions')
          .select('prediction')
          .eq('match_id', trade.match_id)
          .limit(1)
          .single();
        
        let handicap = 0;
        if (predData && predData.prediction) {
          handicap = Number((predData.prediction as any).ah_line || 0);
        }

        const diff = homeGoals - awayGoals;
        const targetDiff = selection === 'home' ? diff : -diff;
        const targetLine = selection === 'home' ? handicap : -handicap;
        const net = targetDiff + targetLine;

        if (net > 0) {
          tradeStatus = 'WON';
          profitLoss = (entryOdds - 1) * stake;
        } else if (net === 0) {
          tradeStatus = 'VOID'; // Push
          profitLoss = 0;
        } else {
          tradeStatus = 'LOST';
          profitLoss = -stake;
        }
      } else if (market === 'OU') {
        const { data: predData } = await supabase
          .from('predictions')
          .select('prediction')
          .eq('match_id', trade.match_id)
          .limit(1)
          .single();
        
        let ouLine = 2.5;
        if (predData && predData.prediction) {
          ouLine = Number((predData.prediction as any).ou_line || 2.5);
        }

        const totalGoals = homeGoals + awayGoals;
        if (totalGoals === ouLine) {
          tradeStatus = 'VOID';
          profitLoss = 0;
        } else if (
          (selection === 'over' && totalGoals > ouLine) ||
          (selection === 'under' && totalGoals < ouLine)
        ) {
          tradeStatus = 'WON';
          profitLoss = (entryOdds - 1) * stake;
        } else {
          tradeStatus = 'LOST';
          profitLoss = -stake;
        }
      }

      if (tradeStatus !== 'PENDING') {
        await supabase
          .from('paper_trades')
          .update({
            status: tradeStatus,
            profit_loss: profitLoss, // if column exists, else we use profit
            profit: profitLoss,      // update both to be safe
            settled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);
        
        if (tradeStatus === 'WON') won++;
        if (tradeStatus === 'LOST') lost++;
        if (tradeStatus === 'VOID') voided++;
      } else {
        stillPending++;
      }
    }

    const result = { won, lost, voided, stillPending };
    console.log('✅ Settlement complete:', result);

    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error('❌ Settlement Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
