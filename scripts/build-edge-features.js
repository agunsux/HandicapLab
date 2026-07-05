// scripts/build-edge-features.js
// -------------------------------------------------------------------
// Match Feature Join & Edge Score Engine (Layer 3)
// -------------------------------------------------------------------
// This script joins match_features and team_form_features using chronological,
// leak-proof snapshot logic to compute:
// 1. Team Differential Features (TSI, Form, Momentum)
// 2. Intermediate Model Strength Features (Attack, Defense)
// 3. Expected Goals (xG) Proxy and Poisson Model Probabilities
// 4. Edges for Moneyline (ML), Asian Handicap (AH), and Over/Under (OU)
// -------------------------------------------------------------------

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !supabaseKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Helper to fetch all rows from a table with pagination (PostgREST limit = 1000)
async function fetchAll(table) {
  const batchSize = 1000;
  let from = 0;
  let all = [];
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .order(table === 'match_features' ? 'match_date' : 'as_of_match_date', { ascending: true })
      .range(from, from + batchSize - 1);
    if (error) {
      console.error(`Error fetching ${table}:`, error);
      process.exit(1);
    }
    all = all.concat(data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

// Math helpers
function factorial(n) {
  if (n <= 1) return 1;
  let res = 1;
  for (let i = 2; i <= n; i++) res *= i;
  return res;
}

function poisson(k, lambda) {
  const safeLambda = Math.max(lambda, 0.0001);
  return Math.exp(-safeLambda) * Math.pow(safeLambda, k) / factorial(k);
}

// Fallback features for neutral starting states
const DEFAULT_FEATURES = {
  tsi: 50.0,
  goals_scored_avg: 1.0,
  goals_conceded_avg: 1.0,
  rolling_5_form_points: 1.0,
  win_rate: 0.33,
  momentum_score: 0.0
};

// Chronological snapshot lookup helper (ensures zero data leakage)
function getLatestFeaturesBefore(teamFeaturesArray, matchDate) {
  if (!teamFeaturesArray || teamFeaturesArray.length === 0) return null;
  const targetDate = new Date(matchDate);
  for (let i = teamFeaturesArray.length - 1; i >= 0; i--) {
    const itemDate = new Date(teamFeaturesArray[i].as_of_match_date);
    if (itemDate < targetDate) {
      return teamFeaturesArray[i];
    }
  }
  return null;
}

(async () => {
  console.log('Fetching match_features...');
  const matchFeatures = await fetchAll('match_features');
  console.log(`Fetched ${matchFeatures.length} match features`);

  console.log('Fetching team_form_features...');
  const teamFormFeatures = await fetchAll('team_form_features');
  console.log(`Fetched ${teamFormFeatures.length} team form features`);

  // Group team form features by team | league | season
  const teamFeaturesMap = new Map();
  for (const row of teamFormFeatures) {
    const key = `${row.team_name}|${row.league}|${row.season}`;
    if (!teamFeaturesMap.has(key)) {
      teamFeaturesMap.set(key, []);
    }
    teamFeaturesMap.get(key).push(row);
  }

  // Sort each group chronologically to be absolutely certain
  for (const [key, list] of teamFeaturesMap.entries()) {
    list.sort((a, b) => new Date(a.as_of_match_date) - new Date(b.as_of_match_date));
  }

  const results = [];
  let skipped = 0;

  for (const match of matchFeatures) {
    if (!match.home_implied_prob || !match.away_implied_prob) {
      skipped++;
      continue;
    }

    const homeKey = `${match.home_team}|${match.league}|${match.season}`;
    const awayKey = `${match.away_team}|${match.league}|${match.season}`;

    // Get snapshot before kickoff
    const homeForm = getLatestFeaturesBefore(teamFeaturesMap.get(homeKey), match.match_date) || DEFAULT_FEATURES;
    const awayForm = getLatestFeaturesBefore(teamFeaturesMap.get(awayKey), match.match_date) || DEFAULT_FEATURES;

    // 1. Team Differential Features
    const tsi_diff = homeForm.tsi - awayForm.tsi;
    const form_diff_5 = (homeForm.rolling_5_form_points ?? 1.0) - (awayForm.rolling_5_form_points ?? 1.0);
    const momentum_diff = (homeForm.momentum_score ?? 0.0) - (awayForm.momentum_score ?? 0.0);

    // 2. Intermediate Strength Features
    const home_attack_strength = homeForm.goals_scored_avg * (homeForm.tsi / 50.0);
    const away_defense_weakness = awayForm.goals_conceded_avg * (1.5 - (awayForm.tsi / 100.0));
    const away_attack_strength = awayForm.goals_scored_avg * (awayForm.tsi / 50.0);
    const home_defense_weakness = homeForm.goals_conceded_avg * (1.5 - (homeForm.tsi / 100.0));

    // 3. Expected Goals (xG) Proxy
    const expected_goals_home = (home_attack_strength + away_defense_weakness) / 2;
    const expected_goals_away = (away_attack_strength + home_defense_weakness) / 2;
    const expected_total_goals = expected_goals_home + expected_goals_away;

    // 4. Poisson Outcome Probabilities
    let probHome = 0;
    let probDraw = 0;
    let probAway = 0;
    const maxGoals = 10;

    for (let h = 0; h <= maxGoals; h++) {
      const pH = poisson(h, expected_goals_home);
      for (let a = 0; a <= maxGoals; a++) {
        const pA = poisson(a, expected_goals_away);
        const pScore = pH * pA;
        if (h > a) {
          probHome += pScore;
        } else if (h === a) {
          probDraw += pScore;
        } else {
          probAway += pScore;
        }
      }
    }

    const sumProbs = probHome + probDraw + probAway;
    const model_home_prob = probHome / sumProbs;
    const model_draw_prob = probDraw / sumProbs;
    const model_away_prob = probAway / sumProbs;

    // 5. Edges
    const ml_edge_home = model_home_prob - match.home_implied_prob;
    const ml_edge_away = model_away_prob - match.away_implied_prob;
    const inferred_handicap = - (match.home_implied_prob - match.away_implied_prob) * 1.5;
    const ah_edge_score = (expected_goals_home - expected_goals_away) - inferred_handicap;
    const ou_edge_score = expected_total_goals - 2.5;

    results.push({
      match_id: match.match_id,
      league: match.league,
      season: match.season,
      match_date: match.match_date,
      home_team: match.home_team,
      away_team: match.away_team,
      home_odds: match.home_odds,
      draw_odds: match.draw_odds,
      away_odds: match.away_odds,
      home_implied_prob: match.home_implied_prob,
      draw_implied_prob: match.draw_implied_prob,
      away_implied_prob: match.away_implied_prob,
      home_attack_strength,
      away_defense_weakness,
      away_attack_strength,
      home_defense_weakness,
      model_home_prob,
      model_draw_prob,
      model_away_prob,
      expected_goals_home,
      expected_goals_away,
      expected_total_goals,
      tsi_diff,
      form_diff_5,
      momentum_diff,
      ml_edge_home,
      ml_edge_away,
      ah_edge_score,
      ou_edge_score
    });
  }

  // Insert into match_edge_features (truncate first)
  console.log('Truncating existing match_edge_features...');
  const { error: truncErr } = await supabase.from('match_edge_features').delete().neq('id', -1);
  if (truncErr) {
    console.error('Error truncating match_edge_features:', truncErr);
    process.exit(1);
  }

  const batchSize = 500;
  console.log(`Inserting ${results.length} rows...`);
  for (let i = 0; i < results.length; i += batchSize) {
    const batch = results.slice(i, i + batchSize);
    const { error: insErr } = await supabase.from('match_edge_features').insert(batch);
    if (insErr) {
      console.error('Batch insert error:', insErr);
      process.exit(1);
    }
  }

  // Analytics output
  const totalMatches = results.length;
  const posHomeEdge = results.filter(r => r.ml_edge_home > 0).length;
  const posAwayEdge = results.filter(r => r.ml_edge_away > 0).length;
  const posOuEdge = results.filter(r => r.ou_edge_score > 0).length;

  const top10 = results
    .sort((a, b) => Math.max(Math.abs(b.ml_edge_home), Math.abs(b.ml_edge_away)) - Math.max(Math.abs(a.ml_edge_home), Math.abs(a.ml_edge_away)))
    .slice(0, 10)
    .map(r => ({
      match: `${r.home_team} vs ${r.away_team}`,
      date: r.match_date,
      h_odds: r.home_odds.toFixed(2),
      a_odds: r.away_odds.toFixed(2),
      model_h: (r.model_home_prob * 100).toFixed(1) + '%',
      market_h: (r.home_implied_prob * 100).toFixed(1) + '%',
      edge_h: (r.ml_edge_home * 100).toFixed(1) + '%',
      edge_a: (r.ml_edge_away * 100).toFixed(1) + '%'
    }));

  console.log('\n=== EDGE SCORE ENGINE SUMMARY ===');
  console.log(`Total matches processed: ${totalMatches}`);
  console.log(`Skipped (missing odds): ${skipped}`);
  console.log(`Positive Home ML Edge %: ${((posHomeEdge / totalMatches) * 100).toFixed(1)}%`);
  console.log(`Positive Away ML Edge %: ${((posAwayEdge / totalMatches) * 100).toFixed(1)}%`);
  console.log(`Positive Over 2.5 Edge %: ${((posOuEdge / totalMatches) * 100).toFixed(1)}%`);

  console.log('\nTop 10 Highest Moneyline Edge Matches:');
  console.table(top10);
  console.log('Done.');
})();
