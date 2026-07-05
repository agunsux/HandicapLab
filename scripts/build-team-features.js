// scripts/build-team-features.js
// -------------------------------------------------------------------
// Team Strength & Rolling Form Engine (MVP Layer 2)
// -------------------------------------------------------------------
// This script computes rolling form features, Team Strength Index (TSI),
// momentum, and opponent‑adjusted strength for each team (home/away) based
// on historical matches stored in `raw_matches` and inserts the results
// into `team_form_features`.
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
    const { data, error, count } = await supabase
      .from(table)
      .select('*', { count: 'exact' })
      .order('match_date', { ascending: true })
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

// Main execution
(async () => {
  console.log('Fetching raw_matches...');
  const rawMatches = await fetchAll('raw_matches');
  console.log(`Fetched ${rawMatches.length} raw matches`);

  // Build per‑team match history (separate home/away)
  const teamHist = new Map(); // key: `${team}|${league}|${season}|${isHome}`

  // Helper to push a record
  function pushRecord(matchId, team, league, season, date, isHome, goalsFor, goalsAgainst) {
    const key = `${team}|${league}|${season}|${isHome}`;
    if (!teamHist.has(key)) teamHist.set(key, []);
    teamHist.get(key).push({
      match_id: matchId,
      match_date: date,
      goals_for: goalsFor,
      goals_against: goalsAgainst,
    });
  }

  // First pass: populate histories and keep a map of match_id -> match row for opponent lookup later
  const matchIdMap = new Map(); // match_id -> raw row
  for (const m of rawMatches) {
    const matchId = m.id;
    const league = m.league;
    const season = m.season;
    const date = m.match_date;
    // Home side
    pushRecord(matchId, m.home_team, league, season, date, true, m.full_time_home_goals, m.full_time_away_goals);
    // Away side
    pushRecord(matchId, m.away_team, league, season, date, false, m.full_time_away_goals, m.full_time_home_goals);
    matchIdMap.set(matchId, { ...m });
  }

  // Compute rolling stats per team
  const rollingResults = [];
  const leagueSeasonTsiMap = new Map(); // key: `${league}|${season}` => array of tsi values for scaling

  const pointsFromResult = (goalsFor, goalsAgainst) => {
    if (goalsFor > goalsAgainst) return 3;
    if (goalsFor === goalsAgainst) return 1;
    return 0;
  };

  for (const [key, matches] of teamHist.entries()) {
    // Ensure chronological order (should already be, but sort to be safe)
    matches.sort((a, b) => new Date(a.match_date) - new Date(b.match_date));
    const [team, league, season, isHomeStr] = key.split('|');
    const isHome = isHomeStr === 'true';
    const windowSizes = [5, 10, 15];
    const rolling = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const entry = {
        team_name: team,
        league,
        season,
        match_date: cur.match_date,
        as_of_match_date: cur.match_date,
        is_home: isHome,
        match_id: cur.match_id, // Linked correctly now
      };

      // Compute rolling windows
      for (const w of windowSizes) {
        if (i + 1 >= w) {
          const slice = matches.slice(i + 1 - w, i + 1);
          const points = slice.reduce((sum, rec) => sum + pointsFromResult(rec.goals_for, rec.goals_against), 0);
          const formAvg = points / w; // average points per match
          entry[`rolling_${w}_form_points`] = formAvg;
        } else {
          entry[`rolling_${w}_form_points`] = null;
        }
      }

      // Goals stats over last 5 matches (as baseline for averages)
      const recent = i + 1 >= 5 ? matches.slice(i + 1 - 5, i + 1) : matches.slice(0, i + 1);
      const goalsScoredSum = recent.reduce((s, r) => s + r.goals_for, 0);
      const goalsConcededSum = recent.reduce((s, r) => s + r.goals_against, 0);
      const goalDiffSum = recent.reduce((s, r) => s + (r.goals_for - r.goals_against), 0);
      const wins = recent.filter(r => r.goals_for > r.goals_against).length;
      const cleanSheets = recent.filter(r => r.goals_against === 0).length;
      const failToScore = recent.filter(r => r.goals_for === 0).length;
      const cnt = recent.length;
      entry.goals_scored_avg = goalsScoredSum / cnt;
      entry.goals_conceded_avg = goalsConcededSum / cnt;
      entry.goal_diff_avg = goalDiffSum / cnt;
      entry.win_rate = wins / cnt;
      entry.clean_sheet_rate = cleanSheets / cnt;
      entry.fail_to_score_rate = failToScore / cnt;

      // TSI (pre‑normalisation)
      const tsiRaw =
        entry.win_rate * 0.35 +
        entry.goal_diff_avg * 0.25 +
        entry.goals_scored_avg * 0.2 -
        entry.goals_conceded_avg * 0.2;
      entry.tsi_raw = tsiRaw;

      // Momentum – form trend (last5 vs previous5)
      if (i + 1 >= 10) {
        const last5 = matches.slice(i + 1 - 5, i + 1);
        const prev5 = matches.slice(i + 1 - 10, i + 1 - 5);
        const last5Points = last5.reduce((s, r) => s + pointsFromResult(r.goals_for, r.goals_against), 0) / 5;
        const prev5Points = prev5.reduce((s, r) => s + pointsFromResult(r.goals_for, r.goals_against), 0) / 5;
        entry.form_trend = last5Points - prev5Points;
      } else {
        entry.form_trend = null;
      }
      // Goal trend – slope over last 10 matches (simple diff of avg first5 vs last5)
      if (i + 1 >= 10) {
        const first5 = matches.slice(i + 1 - 10, i + 1 - 5);
        const last5 = matches.slice(i + 1 - 5, i + 1);
        const avgFirst5 = first5.reduce((s, r) => s + r.goals_for, 0) / 5;
        const avgLast5 = last5.reduce((s, r) => s + r.goals_for, 0) / 5;
        entry.goal_trend = avgLast5 - avgFirst5;
      } else {
        entry.goal_trend = null;
      }

      // Composite momentum score (simple average of the two trends)
      if (entry.form_trend !== null && entry.goal_trend !== null) {
        entry.momentum_score = (entry.form_trend + entry.goal_trend) / 2;
      } else {
        entry.momentum_score = null;
      }

      rolling.push(entry);
    }
    // Store raw tsi values for normalisation later
    const leagueSeasonKey = `${league}|${season}`;
    if (!leagueSeasonTsiMap.has(leagueSeasonKey)) leagueSeasonTsiMap.set(leagueSeasonKey, []);
    for (const e of rolling) {
      if (e.tsi_raw !== null) leagueSeasonTsiMap.get(leagueSeasonKey).push(e.tsi_raw);
    }
    rollingResults.push(...rolling);
  }

  // Normalise TSI per league‑season to 0‑100 scale
  const tsiScaleMap = new Map(); // leagueSeasonKey => {min,max}
  for (const [lsKey, values] of leagueSeasonTsiMap.entries()) {
    const min = Math.min(...values);
    const max = Math.max(...values);
    tsiScaleMap.set(lsKey, { min, max });
  }

  // Compute league average TSI for opponent adjustment
  const leagueAvgTsiMap = new Map(); // leagueSeasonKey => avg tsi (after normalisation)
  // First pass to assign normalised tsi
  for (const row of rollingResults) {
    const lsKey = `${row.league}|${row.season}`;
    const { min, max } = tsiScaleMap.get(lsKey);
    if (max - min === 0) {
      row.tsi = 50; // fallback when all equal
    } else {
      row.tsi = ((row.tsi_raw - min) / (max - min)) * 100;
    }
  }
  // Compute league average
  const leagueSumCount = {};
  for (const r of rollingResults) {
    const lsKey = `${r.league}|${r.season}`;
    if (!leagueSumCount[lsKey]) leagueSumCount[lsKey] = { sum: 0, cnt: 0 };
    leagueSumCount[lsKey].sum += r.tsi;
    leagueSumCount[lsKey].cnt += 1;
  }
  for (const [lsKey, obj] of Object.entries(leagueSumCount)) {
    leagueAvgTsiMap.set(lsKey, obj.sum / obj.cnt);
  }

  // Attach opponent adjusted TSI
  // Build a lookup: match_id + is_home => tsi
  const matchTeamLookup = new Map(); // `${match_id}|${is_home}` => tsi
  for (const r of rollingResults) {
    const key = `${r.match_id}|${r.is_home}`;
    matchTeamLookup.set(key, r.tsi);
  }
  // Now fill opponent_adjusted_tsi
  for (const r of rollingResults) {
    // Find opponent's TSI for the same match
    const opponentKey = `${r.match_id}|${!r.is_home}`;
    const oppTsi = matchTeamLookup.get(opponentKey);
    const lsKey = `${r.league}|${r.season}`;
    const leagueAvg = leagueAvgTsiMap.get(lsKey) || 50;
    if (oppTsi !== undefined && leagueAvg !== 0) {
      r.opponent_adjusted_tsi = r.tsi * (oppTsi / leagueAvg);
    } else {
      r.opponent_adjusted_tsi = null;
    }
  }

  // Insert into team_form_features (truncate first)
  console.log('Truncating existing team_form_features...');
  const { error: truncErr } = await supabase.from('team_form_features').delete().neq('id', -1);
  if (truncErr) {
    console.error('Error truncating table:', truncErr);
    process.exit(1);
  }

  // Batch insert (500 rows per batch)
  const batchSize = 500;
  console.log(`Inserting ${rollingResults.length} rows...`);
  for (let i = 0; i < rollingResults.length; i += batchSize) {
    const batch = rollingResults.slice(i, i + batchSize).map(r => ({
      match_id: r.match_id,
      team_name: r.team_name,
      league: r.league,
      season: r.season,
      match_date: r.match_date,
      as_of_match_date: r.as_of_match_date,
      is_home: r.is_home,
      rolling_5_form_points: r.rolling_5_form_points,
      rolling_10_form_points: r.rolling_10_form_points,
      rolling_15_form_points: r.rolling_15_form_points,
      goals_scored_avg: r.goals_scored_avg,
      goals_conceded_avg: r.goals_conceded_avg,
      win_rate: r.win_rate,
      tsi: r.tsi,
      momentum_score: r.momentum_score,
      opponent_adjusted_tsi: r.opponent_adjusted_tsi,
    }));
    const { error: insErr } = await supabase.from('team_form_features').insert(batch);
    if (insErr) {
      console.error('Batch insert error:', insErr);
      process.exit(1);
    }
  }

  // Validation & summary output
  const uniqueTeams = new Set(rollingResults.map(r => r.team_name));
  const totalTeams = uniqueTeams.size;

  // Top 5 strongest teams by latest TSI (most recent entry per team)
  const latestPerTeam = {};
  for (const r of rollingResults) {
    const key = r.team_name;
    if (!latestPerTeam[key] || new Date(r.match_date) > new Date(latestPerTeam[key].match_date)) {
      latestPerTeam[key] = r;
    }
  }
  const top5 = Object.values(latestPerTeam)
    .sort((a, b) => b.tsi - a.tsi)
    .slice(0, 5)
    .map(r => ({ team: r.team_name, tsi: r.tsi.toFixed(2), league: r.league, season: r.season }));

  const tsiValues = rollingResults.map(r => r.tsi).filter(v => v !== null);
  const tsiMin = Math.min(...tsiValues).toFixed(2);
  const tsiAvg = (tsiValues.reduce((s, v) => s + v, 0) / tsiValues.length).toFixed(2);
  const tsiMax = Math.max(...tsiValues).toFixed(2);

  console.log('\n=== TEAM FORM FEATURES SUMMARY ===');
  console.log(`Total teams processed: ${totalTeams}`);
  console.log('Top 5 strongest teams (latest TSI):');
  console.table(top5);
  console.log('TSI distribution:');
  console.log(` min: ${tsiMin}, avg: ${tsiAvg}, max: ${tsiMax}`);

  console.log('Done.');
})();
