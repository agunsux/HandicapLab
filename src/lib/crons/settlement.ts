import { supabase } from '../supabase.server';
import { BrierCalculator } from '../settlement/brier-calculator';
import { CLVCalculator } from '../settlement/clv-calculator';
import { ProfitCalculator } from '../settlement/profit-calculator';

export async function runSettlementCron(): Promise<any> {
  // 1. Fetch finished matches from the last 7 days (to catch any late settlements)
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: matches, error: matchesErr } = await supabase
    .from('matches')
    .select('id, status, home_goals, away_goals, kickoff').eq('data_status', 'ACTIVE').in('source_type', ['PROVIDER', 'HISTORICAL', 'MANUAL'])
    .eq('status', 'finished')
    .gt('kickoff', cutoff);

  if (matchesErr || !matches) {
    throw new Error(`Failed to fetch finished matches: ${matchesErr?.message}`);
  }

  let predictionsSettled = 0;
  let tradesSettled = 0;

  for (const match of matches) {
    const homeGoals = match.home_goals ?? 0;
    const awayGoals = match.away_goals ?? 0;

    // Fetch predictions for this match that have not been fully settled yet
    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('*').eq('data_status', 'ACTIVE').in('source_type', ['PROVIDER', 'HISTORICAL', 'MANUAL'])
      .eq('match_id', String(match.id));

    if (predErr || !predictions) {
      console.error(`Error fetching predictions for match ${match.id}:`, predErr);
      continue;
    }

    for (const pred of predictions) {
      // 2. Settlement calculation for predictions
      const needsUpdate = pred.brier_score === null || pred.clv === null;
      if (needsUpdate) {
        // Calculate Brier score
        const brierScore = BrierCalculator.calculate(
          pred.market_type as 'ML' | 'AH' | 'OU',
          pred.prediction,
          homeGoals,
          awayGoals
        );

        // Get closing odds from snapshot or generate realistic fallback
        let closingOddsVal: number | null = null;
        if (pred.entry_odds) {
          // If closing odds snapshot contains the closing price, use it
          if (pred.closing_odds && typeof pred.closing_odds === 'object') {
            const closingSnap = pred.closing_odds as any;
            if (pred.market_type === 'ML') {
              if (pred.selection === 'home') closingOddsVal = closingSnap.homeOdds ?? closingSnap.market?.home;
              if (pred.selection === 'draw') closingOddsVal = closingSnap.drawOdds ?? closingSnap.market?.draw;
              if (pred.selection === 'away') closingOddsVal = closingSnap.awayOdds ?? closingSnap.market?.away;
            } else if (pred.market_type === 'AH') {
              if (pred.selection === 'home') closingOddsVal = closingSnap.homeOdds ?? closingSnap.market?.home;
              if (pred.selection === 'away') closingOddsVal = closingSnap.awayOdds ?? closingSnap.market?.away;
            } else if (pred.market_type === 'OU') {
              if (pred.selection === 'over') closingOddsVal = closingSnap.homeOdds ?? closingSnap.market?.home;
              if (pred.selection === 'under') closingOddsVal = closingSnap.awayOdds ?? closingSnap.market?.away;
            }
          }
          // If no specific value found in closing snapshot, we FAIL CLOSED.
          // Do NOT generate fallback.
        }

        const clv = pred.entry_odds && closingOddsVal
          ? CLVCalculator.calculate(pred.entry_odds, closingOddsVal)
          : null;

        // Note: We leave clv as null if closing odds are missing, marking it essentially incomplete.

        await supabase
          .from('predictions')
          .update({
            brier_score: brierScore,
            clv: clv,
            closing_odds: closingOddsVal ? closingOddsVal : pred.closing_odds
          })
          .eq('id', pred.id);

        predictionsSettled++;
      }
    }

    // 3. Settle paper trades for this match
    const { data: trades, error: tradeErr } = await supabase
      .from('paper_trades')
      .select('*')
      .eq('match_id', String(match.id))
      .eq('status', 'pending');

    if (tradeErr || !trades) {
      console.error(`Error fetching pending paper trades for match ${match.id}:`, tradeErr);
      continue;
    }

    for (const trade of trades) {
      // Find the corresponding prediction
      const relatedPred = predictions.find(p => p.id === trade.prediction_id || (p.market_type === trade.market_type && String(p.match_id) === String(trade.match_id)));
      
      const brierScore = relatedPred
        ? BrierCalculator.calculate(trade.market_type as 'ML' | 'AH' | 'OU', relatedPred.prediction, homeGoals, awayGoals)
        : 0.25;

      let closingOddsVal: number | null = null;
      if (relatedPred && relatedPred.closing_odds) {
        if (typeof relatedPred.closing_odds === 'number') {
          closingOddsVal = relatedPred.closing_odds;
        }
      }
      
      if (closingOddsVal === null) {
        // FAIL CLOSED for paper_trades
        await supabase
          .from('paper_trades')
          .update({
            status: 'incomplete', // INCOMPLETE settlement due to missing odds
            updated_at: new Date().toISOString()
          })
          .eq('id', trade.id);
        
        tradesSettled++;
        continue;
      }
      
      closingOddsVal = Number(closingOddsVal.toFixed(2));

      const profit = ProfitCalculator.calculate(
        trade.selection,
        trade.market_type as 'ML' | 'AH' | 'OU',
        trade.market_subtype || '1X2',
        trade.stake,
        trade.entry_odds,
        homeGoals,
        awayGoals
      );

      const clv = CLVCalculator.calculate(trade.entry_odds, closingOddsVal);

      await supabase
        .from('paper_trades')
        .update({
          status: 'settled',
          profit: profit,
          is_win: profit > 0,
          closing_odds: closingOddsVal,
          clv: clv,
          brier_score: brierScore,
          updated_at: new Date().toISOString()
        })
        .eq('id', trade.id);

      tradesSettled++;
    }

    // 4. Settle daily_picks for this match (EPIC 58)
    let hash = 0;
    const strId = String(match.id);
    for (let j = 0; j < strId.length; j++) {
      hash = ((hash << 5) - hash) + strId.charCodeAt(j);
      hash = hash & hash;
    }
    const fixtureBigInt = Math.abs(hash) + 1000000000;

    const { data: dailyPicks, error: dpErr } = await supabase
      .from('daily_picks')
      .select('*')
      .eq('fixture_id', fixtureBigInt)
      .eq('status', 'PENDING');

    if (dailyPicks && dailyPicks.length > 0) {
      for (const pick of dailyPicks) {
        // Evaluate Win/Loss based on actual scores
        let pickResult: 'WON' | 'LOST' | 'PUSH' = 'LOST';
        const hGoals = homeGoals;
        const aGoals = awayGoals;
        const p = pick.prediction;

        if (pick.market_type === 'MONEYLINE') {
          if (hGoals > aGoals && p === 'home') pickResult = 'WON';
          else if (hGoals === aGoals && p === 'draw') pickResult = 'WON';
          else if (hGoals < aGoals && p === 'away') pickResult = 'WON';
        } else if (pick.market_type === 'ASIAN_HANDICAP') {
          // Assuming we can fetch the line from odds_snapshots
          // Or just skip true resolution if line isn't present in pick. For now, we'll assume a basic win/loss is resolved externally or mark pending
          // Since we don't have the line explicitly in daily_picks, we can fetch it from odds_snapshots
          const { data: snap } = await supabase.from('odds_snapshots').select('ah_home_line').eq('fixture_id', fixtureBigInt).limit(1).maybeSingle();
          if (snap?.ah_home_line !== undefined) {
             const line = snap.ah_home_line;
             const margin = hGoals - aGoals + (p === 'home' ? line : -line);
             if (margin > 0) pickResult = 'WON';
             else if (margin === 0) pickResult = 'PUSH';
          }
        } else if (pick.market_type === 'OVER_UNDER') {
          const { data: snap } = await supabase.from('odds_snapshots').select('ou_line').eq('fixture_id', fixtureBigInt).limit(1).maybeSingle();
          if (snap?.ou_line !== undefined) {
             const line = snap.ou_line;
             if (hGoals + aGoals > line && p === 'over') pickResult = 'WON';
             else if (hGoals + aGoals < line && p === 'under') pickResult = 'WON';
             else if (hGoals + aGoals === line) pickResult = 'PUSH';
          }
        } else if (pick.market_type === 'BTTS') {
          if (hGoals > 0 && aGoals > 0 && p === 'btts_yes') pickResult = 'WON';
          else if ((hGoals === 0 || aGoals === 0) && p === 'btts_no') pickResult = 'WON';
        }

        const profitLoss = pickResult === 'WON' ? (pick.market_odds ? pick.market_odds - 1 : 0.9) : (pickResult === 'PUSH' ? 0 : -1);

        await supabase
          .from('daily_picks')
          .update({
            status: pickResult,
            actual_score: `${hGoals}-${aGoals}`,
            profit_loss: profitLoss,
            settled_at: new Date().toISOString()
          })
          .eq('id', pick.id);

        // Track Record logic is handled by a nightly aggregation cron usually, or we can trigger it here
      }
    }
  }

  return {
    success: true,
    predictionsSettled,
    tradesSettled
  };
}
