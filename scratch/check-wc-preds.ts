import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

async function main() {
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, league')
    .ilike('league', '%World Cup%');

  if (matchErr) {
    console.error('Error fetching matches:', matchErr);
    return;
  }

  const matchIds = matches.map(m => m.id);

  const { data: preds, error: predErr } = await supabase
    .from('predictions')
    .select('*')
    .in('match_id', matchIds);

  if (predErr) {
    console.error('Error fetching predictions:', predErr);
    return;
  }

  console.log(`Fetched ${preds.length} predictions for World Cup matches.`);
  
  preds.forEach((p, i) => {
    console.log(`\n[Prediction #${i + 1}] Match: ${p.home_team} vs ${p.away_team} | Market: ${p.market_type}`);
    console.log(`  Model Version: ${p.model_version} | Cohort Tag: ${p.cohort_tag}`);
    console.log(`  Selection: ${p.selection} | Edge %: ${p.edge_pct} | Entry Odds: ${p.entry_odds}`);
    console.log(`  Prediction JSON:`, JSON.stringify(p.prediction));
    console.log(`  Odds Snapshot JSON:`, JSON.stringify(p.odds_snapshot));
  });
}

main();
