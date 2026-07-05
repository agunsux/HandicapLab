import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { footyStatsApi, FootyStatsMatch } from '@/services/footystats.api';

// Utility to mock or fetch real result
async function fetchMatchResult(footystats_id: number): Promise<{ home_goals: number, away_goals: number }> {
  // In a real scenario, call FootyStats API for specific match result
  // If we are using mock, return random result
  if (!process.env.FOOTYSTATS_API_KEY || process.env.FOOTYSTATS_API_KEY === 'mock') {
    return {
      home_goals: Math.floor(Math.random() * 4),
      away_goals: Math.floor(Math.random() * 4)
    };
  }
  // TODO: implement actual FootyStats endpoint for single match result
  return { home_goals: 0, away_goals: 0 };
}

// TODO: Sprint 6 Refactor - Settle cron evaluate route should be consolidated with Sprint 5 closed-loop settlement engine and edge stats tracking

let cachedIsNewSchema: boolean | null = null;

async function checkIsNewSchema(): Promise<boolean> {
  if (cachedIsNewSchema !== null) return cachedIsNewSchema;
  try {
    const { error } = await supabase.from('predictions').select('prediction').limit(1);
    cachedIsNewSchema = !error || error.code !== '42703';
  } catch {
    cachedIsNewSchema = false;
  }
  return cachedIsNewSchema;
}

export async function GET(request: Request) {
  // Cron Security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
 
  try {
    const isNew = await checkIsNewSchema();
    let evaluatedCount = 0;

    if (isNew) {
      // 1. Fetch pending predictions under the new schema (where brier_score is null)
      const { data: pendingPredictions, error: predErr } = await supabase
        .from('predictions')
        .select('id, match_id, market_type, prediction, model_version')
        .is('brier_score', null);

      if (predErr || !pendingPredictions) {
        console.error('Error fetching pending predictions', predErr);
        return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
      }

      // Fetch matches corresponding to those predictions
      const matchIds = [...new Set(pendingPredictions.map(p => p.match_id))];
      if (matchIds.length === 0) {
        return NextResponse.json({ success: true, evaluated: 0 });
      }

      const { data: matches, error: matchesErr } = await supabase
        .from('matches')
        .select('id, home_team, away_team, status, home_goals, away_goals, ht_home_goals, ht_away_goals, kickoff')
        .in('id', matchIds);

      if (matchesErr || !matches) {
        console.error('Error fetching matches for evaluation', matchesErr);
        return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
      }

      const matchesMap = new Map(matches.map(m => [String(m.id), m]));
      const predictionsToUpsert: any[] = [];
      const predictionResultsToInsert: any[] = [];

      for (const pred of pendingPredictions) {
        const match = matchesMap.get(String(pred.match_id));
        // Only evaluate if match is finished or has scores
        if (!match || match.status !== 'finished') continue;

        const homeGoals = match.home_goals ?? 0;
        const awayGoals = match.away_goals ?? 0;
        const totalGoals = homeGoals + awayGoals;
        const goalDiff = homeGoals - awayGoals;

        let brierScore = 0;
        let isWin = false;
        let profit = 0;

        const predObj = typeof pred.prediction === 'object' && pred.prediction ? (pred.prediction as any) : {};
        const pHome = parseFloat(predObj.home_prob || predObj.homeWinProb || '0');
        const pDraw = parseFloat(predObj.draw_prob || predObj.drawProb || '0');
        const pAway = parseFloat(predObj.away_prob || predObj.awayWinProb || '0');
        const ahProb = parseFloat(predObj.ah_prob || '0');
        const ahLine = parseFloat(predObj.ah_line || '0');
        const overProb = parseFloat(predObj.over_prob || '0');
        const ouLine = parseFloat(predObj.ou_line || '2.5');
        const predictedAh = ahProb > 0.5 ? 'home' : 'away';
        const predictedOu = overProb > 0.5 ? 'over' : 'under';

        if (pred.market_type === 'ML') {
          const actualOutcome = homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw';
          const maxProb = Math.max(pHome, pDraw, pAway);
          const predictedOutcome = maxProb === pHome ? 'home' : maxProb === pAway ? 'away' : 'draw';
          isWin = predictedOutcome === actualOutcome;
          profit = isWin ? 0.90 : -1.0;

          const yHome = actualOutcome === 'home' ? 1 : 0;
          const yDraw = actualOutcome === 'draw' ? 1 : 0;
          const yAway = actualOutcome === 'away' ? 1 : 0;
          brierScore = Math.pow(pHome - yHome, 2) + Math.pow(pDraw - yDraw, 2) + Math.pow(pAway - yAway, 2);
        } else if (pred.market_type === 'AH') {
          const net = goalDiff + (predictedAh === 'home' ? ahLine : -ahLine);
          
          if (net > 0) {
            isWin = true;
            profit = 0.90;
          } else if (net === 0) {
            isWin = false;
            profit = 0.0;
          } else {
            isWin = false;
            profit = -1.0;
          }

          const actualAh = net > 0 ? predictedAh : predictedAh === 'home' ? 'away' : 'home';
          const yAh = (predictedAh === actualAh && net > 0) ? 1 : 0;
          brierScore = Math.pow(ahProb - yAh, 2);
        } else if (pred.market_type === 'OU') {
          const actualOu = totalGoals > ouLine ? 'over' : totalGoals < ouLine ? 'under' : 'push';
          
          if (actualOu === 'push') {
            isWin = false;
            profit = 0.0;
          } else {
            isWin = predictedOu === actualOu;
            profit = isWin ? 0.90 : -1.0;
          }

          const yOu = (predictedOu === actualOu) ? 1 : 0;
          brierScore = Math.pow(overProb - yOu, 2);
        }

        predictionsToUpsert.push({
          id: pred.id,
          brier_score: Number(brierScore.toFixed(4))
        });

        predictionResultsToInsert.push({
          prediction_id: pred.id,
          match_id: match.id,
          actual_home_score: homeGoals,
          actual_away_score: awayGoals,
          predicted_outcome: pHome > pAway ? 'home' : 'away',
          actual_outcome: homeGoals > awayGoals ? 'home' : awayGoals > homeGoals ? 'away' : 'draw',
          hit_1x2: pred.market_type === 'ML' ? isWin : false,
          predicted_ah: predictedAh,
          actual_ah: goalDiff > 0 ? 'home' : 'away',
          hit_ah: pred.market_type === 'AH' ? isWin : false,
          predicted_ou: predictedOu,
          actual_ou: totalGoals > 2.5 ? 'over' : 'under',
          hit_ou: pred.market_type === 'OU' ? isWin : false,
          profit_1x2: pred.market_type === 'ML' ? profit : 0,
          profit_ah: pred.market_type === 'AH' ? profit : 0,
          profit_ou: pred.market_type === 'OU' ? profit : 0,
        });

        evaluatedCount++;
      }

      if (predictionsToUpsert.length > 0) {
        const { error: upsertErr } = await supabase
          .from('predictions')
          .upsert(predictionsToUpsert);
        if (upsertErr) {
          console.error('Error batch upserting predictions brier_score:', upsertErr);
        }
      }

      if (predictionResultsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('prediction_results')
          .insert(predictionResultsToInsert);
        if (insertErr) {
          console.error('Error batch inserting prediction_results:', insertErr);
        }
      }

    } else {
      // 2. Fetch pending predictions under the old schema
      const { data: pendingPredictions, error: predErr } = await supabase
        .from('predictions')
        .select(`
          id,
          match_id,
          home_prob,
          draw_prob,
          away_prob,
          ah_line,
          ah_prob,
          ah_confidence,
          ou_line,
          over_prob,
          ou_confidence,
          generated_at
        `);

      if (predErr || !pendingPredictions) {
        console.error('Error fetching pending predictions', predErr);
        return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
      }

      const predIds = pendingPredictions.map(p => p.id);
      if (predIds.length === 0) {
        return NextResponse.json({ success: true, evaluated: 0 });
      }

      // Fetch existing outcomes to filter already settled ones
      const { data: existingOutcomes, error: existingErr } = await supabase
        .from('prediction_results')
        .select('prediction_id')
        .in('prediction_id', predIds);

      if (existingErr) {
        console.error('Error fetching existing outcomes', existingErr);
        return NextResponse.json({ error: 'Failed to fetch existing outcomes' }, { status: 500 });
      }

      const settledPredIds = new Set(existingOutcomes?.map(eo => eo.prediction_id) || []);

      // Fetch corresponding matches
      const matchIds = [...new Set(pendingPredictions.map(p => p.match_id))];
      const { data: matches, error: matchesErr } = await supabase
        .from('matches')
        .select('id, status, home_goals, away_goals')
        .in('id', matchIds);

      if (matchesErr || !matches) {
        console.error('Error fetching matches', matchesErr);
        return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 });
      }

      const matchesMap = new Map(matches.map(m => [String(m.id), m]));
      const predictionResultsToInsert: any[] = [];

      for (const pred of pendingPredictions) {
        if (settledPredIds.has(pred.id)) continue; // Already settled

        // Fetch corresponding match
        const match = matchesMap.get(String(pred.match_id));
        if (!match || match.status !== 'finished') continue;

        const homeGoals = match.home_goals ?? 0;
        const awayGoals = match.away_goals ?? 0;
        const totalGoals = homeGoals + awayGoals;
        const goalDiff = homeGoals - awayGoals;

        // Evaluate ML
        let actualOutcome: 'home' | 'draw' | 'away' = 'draw';
        if (homeGoals > awayGoals) actualOutcome = 'home';
        else if (awayGoals > homeGoals) actualOutcome = 'away';

        const pHome = parseFloat(pred.home_prob || '0');
        const pDraw = parseFloat(pred.draw_prob || '0');
        const pAway = parseFloat(pred.away_prob || '0');
        const maxProb = Math.max(pHome, pDraw, pAway);
        const predictedOutcome = maxProb === pHome ? 'home' : maxProb === pAway ? 'away' : 'draw';
        const hit1x2 = predictedOutcome === actualOutcome;
        const profit1x2 = hit1x2 ? 0.90 : -1.0;

        // Evaluate AH
        const predictedAh = parseFloat(pred.ah_prob || '0') > 0.5 ? 'home' : 'away';
        const ahLine = parseFloat(pred.ah_line || '0');
        const net = goalDiff + (predictedAh === 'home' ? ahLine : -ahLine);
        const hitAh = net > 0;
        const profitAh = net > 0 ? 0.90 : net === 0 ? 0.0 : -1.0;
        const actualAh = net > 0 ? predictedAh : predictedAh === 'home' ? 'away' : 'home';

        // Evaluate O/U
        const predictedOu = parseFloat(pred.over_prob || '0') > 0.5 ? 'over' : 'under';
        const ouLine = parseFloat(pred.ou_line || '2.5');
        const actualOu = totalGoals > ouLine ? 'over' : totalGoals < ouLine ? 'under' : 'push';
        const hitOu = predictedOu === actualOu;
        const profitOu = actualOu === 'push' ? 0.0 : hitOu ? 0.90 : -1.0;

        predictionResultsToInsert.push({
          prediction_id: pred.id,
          match_id: match.id,
          actual_home_score: homeGoals,
          actual_away_score: awayGoals,
          predicted_outcome: predictedOutcome,
          actual_outcome: actualOutcome,
          hit_1x2: hit1x2,
          predicted_ah: predictedAh,
          actual_ah: actualAh,
          hit_ah: hitAh,
          predicted_ou: predictedOu,
          actual_ou: actualOu,
          hit_ou: hitOu,
          profit_1x2: profit1x2,
          profit_ah: profitAh,
          profit_ou: profitOu,
        });

        evaluatedCount++;
      }

      if (predictionResultsToInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from('prediction_results')
          .insert(predictionResultsToInsert);
        if (insertErr) {
          console.error('Error batch inserting prediction_results:', insertErr);
        }
      }
    }

    return NextResponse.json({ success: true, evaluated: evaluatedCount });
  } catch (error) {
    console.error('Cron Evaluate Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
