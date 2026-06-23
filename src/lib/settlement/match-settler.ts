import { supabase } from '../supabase.server';
import { BrierCalculator } from './brier-calculator';
import { CLVCalculator } from './clv-calculator';
import { ProfitCalculator } from './profit-calculator';
import { EdgeScanner } from '../engines/edge-scanner';
import { MarketOdds } from '../engines/edge-scanner/types';

export interface SettleSummary {
  matchesChecked: number;
  predictionsSettled: number;
  settledPredictionIds: string[];
}

export class MatchSettler {
  /**
   * Helper to retrieve odds for a specific outcome selection from a market odds snapshot.
   */
  private static getSelectionOdds(
    snapshot: any,
    marketType: 'ML' | 'AH' | 'OU',
    outcome: 'home' | 'draw' | 'away' | 'over' | 'under'
  ): number | undefined {
    if (!snapshot || typeof snapshot !== 'object') return undefined;

    if (marketType === 'ML') {
      if (outcome === 'home') return snapshot.homeOdds ?? snapshot.market?.home;
      if (outcome === 'draw') return snapshot.drawOdds ?? snapshot.market?.draw;
      if (outcome === 'away') return snapshot.awayOdds ?? snapshot.market?.away;
    } else if (marketType === 'AH') {
      if (outcome === 'home') return snapshot.homeOdds ?? snapshot.market?.home;
      if (outcome === 'away') return snapshot.awayOdds ?? snapshot.market?.away;
    } else if (marketType === 'OU') {
      if (outcome === 'over') return snapshot.homeOdds ?? snapshot.market?.home; // Over is homeOdds
      if (outcome === 'under') return snapshot.awayOdds ?? snapshot.market?.away; // Under is awayOdds
    }
    return undefined;
  }

  /**
   * Settles matches finished in the last 24 hours.
   * Calculates Brier scores, CLV, and profit/loss, updating both predictions and prediction_results.
   */
  public static async settleRecentMatches(): Promise<SettleSummary> {
    const summary: SettleSummary = {
      matchesChecked: 0,
      predictionsSettled: 0,
      settledPredictionIds: []
    };

    // 1. Fetch finished matches from the last 24 hours
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: matches, error: matchesErr } = await supabase
      .from('matches')
      .select('id, status, home_goals, away_goals, kickoff')
      .eq('status', 'finished')
      .gt('kickoff', cutoff);

    if (matchesErr || !matches) {
      console.error('[MatchSettler] Error fetching finished matches:', matchesErr);
      return summary;
    }

    summary.matchesChecked = matches.length;

    for (const match of matches) {
      const homeGoals = match.home_goals ?? 0;
      const awayGoals = match.away_goals ?? 0;
      const totalGoals = homeGoals + awayGoals;
      const goalDiff = homeGoals - awayGoals;

      // 2. Fetch unsettled predictions associated with this match
      const { data: predictions, error: predErr } = await supabase
        .from('predictions')
        .select('id, match_id, market_type, prediction, odds_snapshot, closing_odds, model_version')
        .eq('match_id', String(match.id))
        .is('brier_score', null);

      if (predErr || !predictions) {
        console.error(`[MatchSettler] Error fetching predictions for match ${match.id}:`, predErr);
        continue;
      }

      for (const pred of predictions) {
        // Skip already settled rows in prediction_results to ensure idempotency
        const { data: existingOutcome } = await supabase
          .from('prediction_results')
          .select('id')
          .eq('prediction_id', pred.id)
          .maybeSingle();

        if (existingOutcome) continue;

        // 3. Compute Brier score
        const brierScore = BrierCalculator.calculate(
          pred.market_type as 'ML' | 'AH' | 'OU',
          pred.prediction,
          homeGoals,
          awayGoals
        );

        // 4. Scan for edge picks to find bet selection, CLV, and Profit/Loss
        const oddsSnap = (pred.odds_snapshot as MarketOdds) || {};
        const closeSnap = (pred.closing_odds as MarketOdds) || {};
        
        const picks = EdgeScanner.scan(
          String(match.id),
          pred.market_type as 'ML' | 'AH' | 'OU',
          pred.prediction as any,
          oddsSnap,
          closeSnap
        );

        let clv: number | null = null;
        let profit = 0.0;
        let hit = false;
        let chosenOutcome: 'home' | 'draw' | 'away' | 'over' | 'under' = 'home';
        let chosenLine = '0.0';

        if (picks.length > 0) {
          // Take the highest EV pick as the primary recommendation
          const topPick = picks[0];
          clv = topPick.clv;
          chosenOutcome = topPick.outcome;
          chosenLine = topPick.line;

          // Kelly Criterion recommendation stake size
          const stake = topPick.kellyStake > 0 ? topPick.kellyStake : 0.05; // 5% default if zero
          profit = ProfitCalculator.calculate(
            topPick.outcome,
            pred.market_type as 'ML' | 'AH' | 'OU',
            topPick.line,
            stake,
            topPick.marketOdds,
            homeGoals,
            awayGoals
          );
          hit = profit > 0;
        } else {
          // Default outcome selection with highest model probability if no EV edge exists
          const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};
          if (pred.market_type === 'ML') {
            const pHome = parseFloat(predObj.pHome || predObj.home_prob || '0');
            const pDraw = parseFloat(predObj.pDraw || predObj.draw_prob || '0');
            const pAway = parseFloat(predObj.pAway || predObj.away_prob || '0');
            const maxVal = Math.max(pHome, pDraw, pAway);
            chosenOutcome = maxVal === pHome ? 'home' : maxVal === pAway ? 'away' : 'draw';
            hit = chosenOutcome === (homeGoals > awayGoals ? 'home' : homeGoals === awayGoals ? 'draw' : 'away');
          } else if (pred.market_type === 'AH') {
            const line = oddsSnap.line !== undefined ? oddsSnap.line : 0.0;
            chosenLine = line > 0 ? `+${line.toFixed(1)}` : line.toFixed(1);
            const pAhHome = parseFloat(predObj.pAhHome?.[chosenLine] || predObj.ah_prob || '0.5');
            chosenOutcome = pAhHome >= 0.5 ? 'home' : 'away';
            const net = goalDiff + line;
            hit = (chosenOutcome === 'home' && net > 0) || (chosenOutcome === 'away' && net < 0);
          } else if (pred.market_type === 'OU') {
            const line = oddsSnap.line !== undefined ? oddsSnap.line : 2.5;
            chosenLine = line.toFixed(1);
            const pOver = parseFloat(predObj.pOver?.[chosenLine] || predObj.over_prob || '0.5');
            chosenOutcome = pOver >= 0.5 ? 'over' : 'under';
            hit = (chosenOutcome === 'over' && totalGoals > line) || (chosenOutcome === 'under' && totalGoals < line);
          }
          profit = hit ? 0.90 : -1.0; // flat 1 unit bet fallback
        }

        // 5. Update prediction row with computed metrics
        await supabase
          .from('predictions')
          .update({
            brier_score: brierScore,
            clv: clv
          })
          .eq('id', pred.id);

        // 6. Insert compatible outcomes to prediction_results
        await supabase
          .from('prediction_results')
          .insert({
            prediction_id: pred.id,
            match_id: match.id,
            actual_home_score: homeGoals,
            actual_away_score: awayGoals,
            predicted_outcome: pred.market_type === 'ML' ? chosenOutcome : (homeGoals >= awayGoals ? 'home' : 'away'),
            actual_outcome: homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw',
            hit_1x2: pred.market_type === 'ML' ? hit : false,
            predicted_ah: pred.market_type === 'AH' ? chosenOutcome : 'home',
            actual_ah: goalDiff > 0 ? 'home' : 'away',
            hit_ah: pred.market_type === 'AH' ? hit : false,
            predicted_ou: pred.market_type === 'OU' ? chosenOutcome : 'over',
            actual_ou: totalGoals > 2.5 ? 'over' : 'under',
            hit_ou: pred.market_type === 'OU' ? hit : false,
            profit_1x2: pred.market_type === 'ML' ? profit : 0,
            profit_ah: pred.market_type === 'AH' ? profit : 0,
            profit_ou: pred.market_type === 'OU' ? profit : 0
          });

        summary.predictionsSettled++;
        summary.settledPredictionIds.push(pred.id);
      }
    }

    return summary;
  }
}
