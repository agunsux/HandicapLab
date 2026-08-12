import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

async function checkSupabase() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    if (!supabaseUrl || !supabaseKey) throw new Error('Missing Supabase credentials');

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('matches').select('id').limit(1);
    
    if (error) throw error;
    console.log('✅ Supabase Connection: SUCCESS');
  } catch (e: any) {
    console.log('❌ Supabase Connection: FAILED', e.message);
  }
}

async function checkApiFootball() {
  try {
    const key = process.env.API_FOOTBALL_KEY || process.env.FOOTYSTATS_KEY;
    if (!key) throw new Error('Missing API-Football/FootyStats key');

    const res = await fetch('https://v3.football.api-sports.io/status', {
      headers: {
        'x-apisports-key': key
      }
    });
    const json = await res.json();
    if (json.errors && Object.keys(json.errors).length > 0) {
      throw new Error(JSON.stringify(json.errors));
    }
    console.log('✅ API-Football / FootyStats Connection: SUCCESS');
  } catch (e: any) {
    console.log('❌ API-Football / FootyStats Connection: FAILED', e.message);
  }
}

async function checkOddsApi() {
  try {
    const key = process.env.ODDS_API_KEY || process.env.ODDSPAPI_KEY;
    if (!key) throw new Error('Missing Odds API key');

    const baseUrl = process.env.ODDSPAPI_URL || 'https://api.oddspapi.com/v1';
    const res = await fetch(`${baseUrl}/status`, {
      headers: { 'x-api-key': key }
    });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    console.log('✅ The Odds API Connection: SUCCESS');
  } catch (e: any) {
    console.log('❌ The Odds API Connection: FAILED', e.message);
  }
}

async function runHealthCheck() {
  console.log('--- STARTING API HEALTH CHECK ---');
  await checkSupabase();
  await checkApiFootball();
  await checkOddsApi();
  console.log('--- HEALTH CHECK COMPLETE ---');
}

runHealthCheck();
