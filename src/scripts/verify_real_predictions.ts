import { supabase } from '../lib/supabase.server';
async function test() {
  const { data: preds } = await supabase.from('prediction_ledger_v3').select('*, matches(home_team, away_team)').order('prediction_timestamp', { ascending: false }).limit(2);
  console.log('--- DATABASE PERSISTED PREDICTIONS ---');
  preds?.forEach(p => {
    console.log(`Match: ${p.matches?.home_team || p.home_team} vs ${p.matches?.away_team || p.away_team} | Selection: ${p.selection} | Prob: ${p.calibrated_probability} | EV: ${p.expected_value} | Hash: ${p.prediction_hash}`);
  });
}
test();
