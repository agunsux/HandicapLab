import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
  console.log('\n--- 1. MATCHES / FIXTURES ---');
  let hasFixturesTable = false;
  
  // Try fixtures first
  const { data: fixtures, error: fixErr } = await supabase
    .from('fixtures')
    .select('*')
    .order('kickoff_time', { ascending: false })
    .limit(5);
    
  if (fixErr) {
    console.log('No fixtures table, falling back to matches...');
    const { data: matches } = await supabase.from('matches').select('*').order('kickoff', { ascending: false }).limit(5);
    console.log('Latest Matches:');
    matches?.forEach((m: any) => console.log(`[${m.id}] ${m.home_team} vs ${m.away_team} | kickoff: ${m.kickoff} | created: ${m.created_at}`));
    
    const { data: ars } = await supabase.from('matches').select('*').or('home_team.ilike.%Arsenal%,away_team.ilike.%Arsenal%');
    console.log(`\nArsenal/Chelsea in matches? Found: ${ars?.length || 0}`);
    ars?.forEach((f: any) => console.log(`  -> ${f.id} | ${f.home_team} vs ${f.away_team} | kickoff: ${f.kickoff}`));
  } else {
    console.log('Latest Fixtures:');
    fixtures?.forEach((f: any) => console.log(`[${f.id}] ${f.home_team} vs ${f.away_team} | kickoff: ${f.kickoff_time} | created: ${f.created_at} | source: ${f.provider_id || f.source || 'N/A'}`));
    
    const { data: ars } = await supabase.from('fixtures').select('*').or('home_team.ilike.%Arsenal%,away_team.ilike.%Arsenal%');
    console.log(`\nArsenal/Chelsea in fixtures? Found: ${ars?.length || 0}`);
    ars?.forEach((f: any) => console.log(`  -> ${f.id} | ${f.home_team} vs ${f.away_team} | kickoff: ${f.kickoff_time} | provider: ${f.provider_id || f.source || 'N/A'} | created: ${f.created_at}`));
  }

  console.log('\n--- 2. PREDICTIONS ---');
  const { data: preds, error: predErr } = await supabase
    .from('predictions')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (predErr) {
    console.log('Error fetching predictions:', predErr.message);
  } else {
    console.log('Latest Predictions:');
    preds?.forEach((p: any) => console.log(`[${p.id}] match: ${p.match_id || p.fixture_id} | model: ${p.model_version} | ev: ${p.expected_value} | created: ${p.created_at}`));
  }

  console.log('\n--- 3. ODDS SNAPSHOTS ---');
  const { data: odds } = await supabase
    .from('odds_snapshots')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (odds) {
    console.log('Latest Odds:');
    odds.forEach((o: any) => console.log(`[${o.id}] fixture: ${o.fixture_id || o.match_id} | bookmaker: ${o.bookmaker || o.provider} | created: ${o.created_at}`));
  } else {
    console.log('No odds_snapshots table found or empty.');
  }

  console.log('\n--- 4. PIPELINE / AUDIT ---');
  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (logs && logs.length > 0) {
    console.log('Latest Audit Logs:');
    logs.forEach((l: any) => console.log(`[${l.id}] ${l.action || l.event} | created: ${l.created_at}`));
  } else {
    const { data: pipeline } = await supabase.from('pipeline_runs').select('*').order('created_at', { ascending: false }).limit(5);
    if (pipeline && pipeline.length > 0) {
      console.log('Latest Pipeline Runs:');
      pipeline.forEach((p: any) => console.log(`[${p.id}] status: ${p.status} | start: ${p.started_at} | end: ${p.completed_at}`));
    } else {
      console.log('No logs found.');
    }
  }

  console.log('\n--- 5. DAILY PICKS ---');
  const { data: picks } = await supabase
    .from('daily_picks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (picks && picks.length > 0) {
    console.log('Latest Picks:');
    picks.forEach((p: any) => console.log(`[${p.id}] status: ${p.status} | fixture: ${p.fixture_id} | created: ${p.created_at}`));
  } else {
    console.log('No daily_picks found.');
  }
}

runAudit().catch(console.error);
