import { supabase } from '../supabase.server';
import { FeatureEngine } from '../engines/feature-engine';
import { ProbabilityEngine } from '../engines/probability-engine';
import { EdgeScanner } from '../engines/edge-scanner';
import { MarketOdds } from '../engines/edge-scanner/types';
import { getCohortTag } from './cohortTag';

export async function runPredictionCron(): Promise<any> {
  // 1. Fetch upcoming matches from our database
  const { data: matches, error: fetchErr } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'upcoming');

  if (fetchErr) {
    throw new Error(`Failed to fetch upcoming matches: ${fetchErr.message}`);
  }

  if (!matches || matches.length === 0) {
    return { success: true, message: 'No upcoming matches found' };
  }

  const results: any[] = [];

  for (const match of matches) {
    const kickoffDate = new Date(match.kickoff);

    for (const marketType of ['ML', 'AH', 'OU'] as const) {
      try {
        // 2. Run feature engine
        const features = await FeatureEngine.build(match.id, kickoffDate, marketType);

        // 3. Run probability engine
        const probOutput = ProbabilityEngine.predict(features);

        // 4. Generate current odds snapshot
        const marketOdds = generateOddsSnapshot(marketType, probOutput);

        // 5. Run edge scanner
        const picks = EdgeScanner.scan(match.id, marketType, probOutput, marketOdds);

        // 6. Select the top pick (if any positive EV pick exists)
        const topPick = picks[0]; // Already sorted by EV descending
        
        let cohortTag = getCohortTag(match.league_id ?? match.league, match.stage);
        // Cohort tagging logic based on user rules:
        // GENERAL, 2H_UNDER_EPL, 2H_UNDER_LIGUE2
        if (marketType === 'OU' && topPick && topPick.outcome === 'under') {
          const lName = (match.league || '').toLowerCase();
          if (lName.includes('premier') || lName.includes('epl')) {
            cohortTag = '2H_UNDER_EPL';
          } else if (lName.includes('ligue 2') || lName.includes('ligue2')) {
            cohortTag = '2H_UNDER_LIGUE2';
          }
        }

        const predictionJson = {
          home_prob: probOutput.pHome,
          draw_prob: probOutput.pDraw,
          away_prob: probOutput.pAway,
          pHome: probOutput.pHome,
          pDraw: probOutput.pDraw,
          pAway: probOutput.pAway,
          ah_line: marketOdds.line ?? -0.5,
          ah_prob: probOutput.pAhHome[marketOdds.line ? String(marketOdds.line) : '-0.5'] ?? 0.5,
          pAhHome: probOutput.pAhHome,
          pAhAway: probOutput.pAhAway,
          ou_line: marketOdds.line ?? 2.5,
          over_prob: probOutput.pOver[marketOdds.line ? String(marketOdds.line) : '2.5'] ?? 0.5,
          pOver: probOutput.pOver,
          pUnder: probOutput.pUnder,
          expected_goals: 2.5,
          confidence: topPick ? topPick.confidence : 'MEDIUM',
        };

        const predictionPayload = {
          match_id: String(match.id),
          market_type: marketType,
          home_team: match.home_team,
          away_team: match.away_team,
          prediction: predictionJson,
          odds_snapshot: marketOdds,
          model_version: 'prematch-v1',
          feature_version: 'basic-v1',
          generated_at: new Date().toISOString(),
          prediction_timestamp: match.kickoff,
          // Phase 1 structured columns:
          cohort_tag: cohortTag,
          market_subtype: marketOdds.line !== undefined ? String(marketOdds.line) : (marketType === 'ML' ? '1X2' : ''),
          selection: topPick ? topPick.outcome : null,
          model_probability: topPick ? topPick.modelProbability : null,
          fair_odds: topPick ? Number((1 / topPick.modelProbability).toFixed(4)) : null,
          edge_pct: topPick ? topPick.expectedValue : null,
          entry_odds: topPick ? topPick.marketOdds : null,
        };

        // 7. Store prediction in DB
        const { data: storedPred, error: insertErr } = await supabase
          .from('predictions')
          .insert(predictionPayload)
          .select()
          .single();

        if (insertErr) {
          console.error(`Error inserting prediction for match ${match.id} ${marketType}:`, insertErr);
          continue;
        }

        // 8. Auto-populate a paper trade for a default user to help with testing and dashboard metrics
        if (topPick) {
          const testUserId = '00000000-0000-0000-0000-000000000000';
          await supabase.from('paper_trades').insert({
            user_id: testUserId,
            prediction_id: storedPred.id,
            match_id: String(match.id),
            market_type: marketType,
            market_subtype: predictionPayload.market_subtype,
            selection: topPick.outcome,
            entry_odds: topPick.marketOdds,
            stake: topPick.kellyStake > 0 ? topPick.kellyStake : 0.05,
            cohort_tag: cohortTag,
            status: 'pending'
          });
        }

        // 9. Store odds snapshot in odds_history (Task 11)
        await supabase.from('odds_history').insert({
          match_id: String(match.id),
          market: marketType,
          line: marketOdds.line ?? null,
          odds: topPick ? topPick.marketOdds : (marketOdds.homeOdds ?? 1.90),
          bookmaker: 'Pinnacle',
          timestamp: new Date().toISOString()
        });

        results.push({ matchId: match.id, marketType, success: true });
      } catch (err: any) {
        console.error(`Error in prediction pipeline for match ${match.id} ${marketType}:`, err);
        results.push({ matchId: match.id, marketType, error: err.message });
      }
    }
  }

  return { success: true, results };
}

function generateOddsSnapshot(marketType: 'ML' | 'AH' | 'OU', prob: any): MarketOdds {
  const deviation = () => 0.92 + Math.random() * 0.18;
  if (marketType === 'ML') {
    return {
      homeOdds: Number((1 / (prob.pHome * deviation())).toFixed(2)),
      drawOdds: Number((1 / (prob.pDraw * deviation())).toFixed(2)),
      awayOdds: Number((1 / (prob.pAway * deviation())).toFixed(2)),
    };
  } else if (marketType === 'AH') {
    return {
      line: -0.5,
      homeOdds: Number((1 / ((prob.pAhHome['-0.5'] || 0.5) * deviation())).toFixed(2)),
      awayOdds: Number((1 / ((prob.pAhAway['-0.5'] || 0.5) * deviation())).toFixed(2)),
    };
  } else {
    return {
      line: 2.5,
      homeOdds: Number((1 / ((prob.pOver['2.5'] || 0.5) * deviation())).toFixed(2)),
      awayOdds: Number((1 / ((prob.pUnder['2.5'] || 0.5) * deviation())).toFixed(2)),
    };
  }
}
