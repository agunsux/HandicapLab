// src/scripts/verify-world-cup-data.ts
import 'dotenv/config';
import { supabase } from '@/lib/supabase.server';

async function main() {
  // 1. Get World Cup matches (based on league name contains 'World Cup')
  const { data: matches, error: matchErr } = await supabase
    .from('matches')
    .select('id, home_team, away_team, league')
    .ilike('league', '%World Cup%');

  if (matchErr) {
    console.error('Error fetching matches:', matchErr);
    process.exit(1);
  }

  const matchIds = matches?.map(m => m.id) ?? [];
  console.log(`Found ${matchIds.length} World Cup match(es).`);

  if (matchIds.length === 0) {
    console.error('No World Cup matches found.');
    process.exit(1);
  }

  // 2. Get predictions for those matches
  const { data: preds, error: predErr } = await supabase
    .from('predictions')
    .select('id, match_id, market_type, model_probability, edge_pct')
    .in('match_id', matchIds);

  if (predErr) {
    console.error('Error fetching predictions:', predErr);
    process.exit(1);
  }

  const count = preds?.length ?? 0;
  console.log(`Found ${count} prediction(s) for World Cup matches.`);

  if (count === 0) {
    console.error('No predictions found for World Cup matches.');
    process.exit(1);
  }

  // Create a map for quick match lookup
  const matchMap = new Map(matches?.map(m => [m.id, m]));

  // 3. Show up to 5 sample predictions
  const sample = preds!.slice(0, 5);
  console.log('Sample predictions:');
  for (const p of sample) {
    const m = matchMap.get(p.match_id);
    console.log({
      home_team: m?.home_team,
      away_team: m?.away_team,
      league: m?.league,
      market_type: p.market_type,
      model_prob: p.model_probability,
      edge_pct: p.edge_pct,
    });
  }
  process.exit(0);
}

main();
