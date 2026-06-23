import { createClient } from '@supabase/supabase-js';
import { apiFootballClient } from '../lib/api/apiFootball';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Evaluate Asian Handicap (-0.75 by default)
function evaluateAH(
  homeGoals: number,
  awayGoals: number,
  ahLine: number,
  predictionIsHome: boolean
) {
  const diff = homeGoals - awayGoals;
  const targetDiff = predictionIsHome ? diff : -diff;
  const targetLine = predictionIsHome ? ahLine : -ahLine;
  const net = targetDiff + targetLine;

  let result: 'win' | 'half-win' | 'push' | 'half-loss' | 'loss' = 'loss';
  let profit = -1.0;

  if (net >= 0.5) {
    result = 'win';
    profit = 0.90; // assuming standard odds of 1.90, net profit is 0.90
  } else if (net === 0.25) {
    result = 'half-win';
    profit = 0.45;
  } else if (net === 0) {
    result = 'push';
    profit = 0.0;
  } else if (net === -0.25) {
    result = 'half-loss';
    profit = -0.5;
  } else {
    result = 'loss';
    profit = -1.0;
  }

  return {
    actualAh: predictionIsHome 
      ? (net > 0 ? 'home' : net < 0 ? 'away' : 'push')
      : (net > 0 ? 'away' : net < 0 ? 'home' : 'push'),
    hit: result === 'win' || result === 'half-win',
    profit,
  };
}

async function updatePredictionResults() {
  console.log('🚀 Starting prediction results update...');

  try {
    // 1. Fetch upcoming matches from our database that need evaluation
    const { data: pendingMatches, error: matchFetchErr } = await supabase
      .from('matches')
      .select('id, home_team, away_team, league, kickoff, status')
      .neq('status', 'finished');

    if (matchFetchErr) {
      throw new Error(`Failed to fetch pending matches: ${matchFetchErr.message}`);
    }

    if (!pendingMatches || pendingMatches.length === 0) {
      console.log('✅ No pending matches to evaluate.');
      return;
    }

    console.log(`📋 Found ${pendingMatches.length} pending matches in database.`);

    // 2. Fetch completed fixtures from API-Football (default Premier League/39, season 2024)
    // Note: We fetch all fixtures for season 2024. In mock/real mode, apiFootballClient handles filtering.
    console.log('📡 Fetching completed fixtures from API-Football...');
    const fixtures = await apiFootballClient.getFixtures(39, 2024);
    const completedFixtures = fixtures.filter(f => f.fixture.status.short === 'FT');
    
    console.log(`✅ Fetched ${completedFixtures.length} completed fixtures from API.`);

    let evaluatedCount = 0;

    for (const match of pendingMatches) {
      // Find matching completed fixture
      const apiMatch = completedFixtures.find(f => {
        const homeNameMatch = f.teams.home.name.toLowerCase() === match.home_team.toLowerCase();
        const awayNameMatch = f.teams.away.name.toLowerCase() === match.away_team.toLowerCase();
        
        // Also check that dates match within a 24 hour window
        const dbKickoff = new Date(match.kickoff).getTime();
        const apiKickoff = new Date(f.fixture.date).getTime();
        const dateMatch = Math.abs(dbKickoff - apiKickoff) < 24 * 60 * 60 * 1000;
        
        return homeNameMatch && awayNameMatch && dateMatch;
      });

      if (!apiMatch) {
        // Match is not finished yet or not found in completed fixtures list
        continue;
      }

      console.log(`⚽ Evaluating: ${match.home_team} vs ${match.away_team}`);

      const homeGoals = apiMatch.goals.home;
      const awayGoals = apiMatch.goals.away;
      const htHomeGoals = apiMatch.score.halftime.home ?? null;
      const htAwayGoals = apiMatch.score.halftime.away ?? null;

      // 3. Fetch predictions associated with this match
      const { data: predictions, error: predErr } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_id', match.id);

      if (predErr) {
        console.error(`❌ Error fetching predictions for match ${match.id}:`, predErr);
        continue;
      }

      if (!predictions || predictions.length === 0) {
        console.log(`⚠️ No predictions found for match: ${match.home_team} vs ${match.away_team}`);
        continue;
      }

            const prediction = predictions[0];
      const predObj = typeof prediction.prediction === 'object' && prediction.prediction ? (prediction.prediction as any) : {};
      const pHome = parseFloat(predObj.home_prob || predObj.homeWinProb || '0');
      const pDraw = parseFloat(predObj.draw_prob || predObj.drawProb || '0');
      const pAway = parseFloat(predObj.away_prob || predObj.awayWinProb || '0');
      const ahProb = parseFloat(predObj.ah_prob || '0');
      const ahLine = parseFloat(predObj.ah_line || '0');
      const overProb = parseFloat(predObj.over_prob || '0');
      const ouLine = parseFloat(predObj.ou_line || '2.5');

      // --- Evaluate 1X2 ---
      let actualOutcome: 'home' | 'draw' | 'away' = 'draw';
      if (homeGoals > awayGoals) actualOutcome = 'home';
      else if (awayGoals > homeGoals) actualOutcome = 'away';

      let predictedOutcome: 'home' | 'draw' | 'away' = 'home';
      if (pDraw > pHome && pDraw > pAway) {
        predictedOutcome = 'draw';
      } else if (pAway > pHome && pAway > pDraw) {
        predictedOutcome = 'away';
      }

      const hit1x2 = predictedOutcome === actualOutcome;
      const profit1x2 = hit1x2 ? 0.90 : -1.0;

      // --- Evaluate Asian Handicap ---
      // Determine predicted side for AH (backed home if home_prob > 0.50, else away)
      const predictedAhSide = ahProb > 0.5 ? 'home' : 'away';
      const ahEvaluation = evaluateAH(
        homeGoals,
        awayGoals,
        Number(ahLine),
        predictedAhSide === 'home'
      );

      // --- Evaluate Over/Under ---
      const totalGoals = homeGoals + awayGoals;
      const predictedOu = overProb > 0.5 ? 'over' : 'under';
      
      let actualOu: 'over' | 'under' | 'push' = 'push';
      const ouLineVal = Number(ouLine);
      if (totalGoals > ouLineVal) actualOu = 'over';
      else if (totalGoals < ouLineVal) actualOu = 'under';

      const hitOu = predictedOu === actualOu;
      let profitOu = -1.0;
      if (actualOu === 'push') {
        profitOu = 0.0;
      } else if (hitOu) {
        profitOu = 0.90;
      }

      // 4. Save to prediction_results
      const { error: insertErr } = await supabase
        .from('prediction_results')
        .insert({
          prediction_id: prediction.id,
          match_id: match.id,
          actual_home_score: homeGoals,
          actual_away_score: awayGoals,
          predicted_outcome: predictedOutcome,
          actual_outcome: actualOutcome,
          hit_1x2: hit1x2,
          predicted_ah: predictedAhSide,
          actual_ah: ahEvaluation.actualAh,
          hit_ah: ahEvaluation.hit,
          predicted_ou: predictedOu,
          actual_ou: actualOu,
          hit_ou: hitOu,
          profit_1x2: profit1x2,
          profit_ah: ahEvaluation.profit,
          profit_ou: profitOu,
        });

      if (insertErr) {
        console.error(`❌ Error inserting prediction result for match ${match.id}:`, insertErr);
        continue;
      }

      // 5. Update match status to finished
      const { error: matchUpdateErr } = await supabase
        .from('matches')
        .update({
          status: 'finished',
          home_goals: homeGoals,
          away_goals: awayGoals,
          ht_home_goals: htHomeGoals,
          ht_away_goals: htAwayGoals,
          updated_at: new Date().toISOString(),
        })
        .eq('id', match.id);

      if (matchUpdateErr) {
        console.error(`❌ Error updating match status for match ${match.id}:`, matchUpdateErr);
        continue;
      }

      console.log(`` + `✅ Evaluated: ${match.home_team} ${homeGoals}-${awayGoals} ${match.away_team}`);
      console.log(`   - 1X2: Predicted ${predictedOutcome}, Actual ${actualOutcome} (${hit1x2 ? 'HIT' : 'MISS'})`);
      console.log(`   - AH: Predicted ${predictedAhSide} (${ahLine}), Actual ${ahEvaluation.actualAh} (${ahEvaluation.hit ? 'HIT' : 'MISS'})`);
      console.log(`   - O/U: Predicted ${predictedOu} (${ouLine}), Actual ${actualOu} (${hitOu ? 'HIT' : 'MISS'})`);
      
      evaluatedCount++;
    }

    console.log(`🎉 Success! Evaluated and updated ${evaluatedCount} matches.`);
  } catch (error: any) {
    console.error('❌ Error during prediction results update:', error);
  }
}

updatePredictionResults();
