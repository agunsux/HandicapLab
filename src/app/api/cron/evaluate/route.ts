import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
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

export async function GET(request: Request) {
  // Cron Security
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Fetch matches that are "scheduled" or "live" but might be finished now
    // Since we don't have a perfect status sync, let's fetch matches whose match_date is in the past
    // and don't have outcomes yet.
    
    // Actually, let's just find predictions that don't have outcomes.
    // In Supabase, we can do a left join or NOT IN. For MVP, we can fetch outcomes and filter, 
    // or better: fetch predictions, then check if outcome exists.
    
    const { data: pendingPredictions, error: predErr } = await supabase
      .from('predictions')
      .select(`
        id,
        match_id,
        ah_home_prob,
        ah_away_prob,
        ou_over_prob,
        ou_under_prob,
        ml_home_prob,
        ml_draw_prob,
        ml_away_prob,
        btts_yes_prob,
        btts_no_prob,
        matches!inner(footystats_id, match_date, status),
        market_snapshots!inner(asian_handicap_line, over_under_line)
      `)
      .lt('matches.match_date', new Date().toISOString());

    if (predErr || !pendingPredictions) {
      console.error('Error fetching pending predictions', predErr);
      return NextResponse.json({ error: 'Failed to fetch predictions' }, { status: 500 });
    }

    let evaluatedCount = 0;

    for (const pred of pendingPredictions) {
      // Check if outcome already exists
      const { data: existingOutcome } = await supabase
        .from('outcomes')
        .select('id')
        .eq('prediction_id', pred.id)
        .single();
        
      if (existingOutcome) continue; // Already settled

      const matchId = pred.match_id;
      // Note: pred.matches is an array or object depending on relation, Supabase returns array for some joins if not explicitly singular.
      // Assuming singular because of !inner and 1:1 conceptual
      const matchData = Array.isArray(pred.matches) ? pred.matches[0] : pred.matches;
      const marketData = Array.isArray(pred.market_snapshots) ? pred.market_snapshots[0] : pred.market_snapshots;

      if (!matchData?.footystats_id || !marketData) continue;

      const result = await fetchMatchResult(matchData.footystats_id);
      
      const homeGoals = result.home_goals;
      const awayGoals = result.away_goals;
      const totalGoals = homeGoals + awayGoals;
      const goalDiff = homeGoals - awayGoals;

      // Evaluate ML
      let result_ml = 'loss';
      const picked_ml = Math.max(pred.ml_home_prob, pred.ml_draw_prob, pred.ml_away_prob);
      if (picked_ml === pred.ml_home_prob && homeGoals > awayGoals) result_ml = 'win';
      else if (picked_ml === pred.ml_draw_prob && homeGoals === awayGoals) result_ml = 'win';
      else if (picked_ml === pred.ml_away_prob && awayGoals > homeGoals) result_ml = 'win';

      // Evaluate BTTS
      let result_btts = 'loss';
      const picked_btts = pred.btts_yes_prob > pred.btts_no_prob ? 'yes' : 'no';
      const actual_btts = (homeGoals > 0 && awayGoals > 0) ? 'yes' : 'no';
      if (picked_btts === actual_btts) result_btts = 'win';

      // Evaluate O/U
      let result_ou = 'loss';
      const ouLine = marketData.over_under_line;
      const picked_ou = pred.ou_over_prob > pred.ou_under_prob ? 'over' : 'under';
      if (totalGoals === ouLine) result_ou = 'push';
      else if (picked_ou === 'over' && totalGoals > ouLine) result_ou = 'win';
      else if (picked_ou === 'under' && totalGoals < ouLine) result_ou = 'win';

      // Evaluate AH (Simplified Asian Handicap Logic)
      let result_ah = 'loss';
      const ahLine = marketData.asian_handicap_line; // from home perspective
      const picked_ah = pred.ah_home_prob > pred.ah_away_prob ? 'home' : 'away';
      const handicapResult = goalDiff + (picked_ah === 'home' ? ahLine : -ahLine);
      if (handicapResult === 0) result_ah = 'push';
      else if (handicapResult > 0) result_ah = 'win';

      // Mock ROI (simple +10% for win, -100% for loss, 0 for push)
      // Real ROI requires exact odds played.
      let roi = 0;
      const wins = [result_ml, result_btts, result_ou, result_ah].filter(r => r === 'win').length;
      const losses = [result_ml, result_btts, result_ou, result_ah].filter(r => r === 'loss').length;
      roi = (wins * 0.9) - (losses * 1.0); // Assuming average odds 1.90

      // Save Outcome
      await supabase.from('outcomes').insert({
        prediction_id: pred.id,
        match_id: matchId,
        result_ah,
        result_ou,
        result_ml,
        result_btts,
        roi
      });

      // Update match status
      await supabase.from('matches').update({ status: 'finished' }).eq('id', matchId);

      evaluatedCount++;
    }

    return NextResponse.json({ success: true, evaluated: evaluatedCount });
  } catch (error) {
    console.error('Cron Evaluate Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
