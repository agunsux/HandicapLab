import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const API_URL = 'https://handicap-lab.vercel.app';
const CRON_SECRET = process.env.CRON_SECRET || 'wIxmvaQ4G1AgUFSlrLyVNbZtpBTk25sH';

async function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function triggerIngest() {
  console.log('Triggering Ingestion...');
  try {
    const res = await fetch(`${API_URL}/api/cron/ingest`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    console.log('Ingest Response Status:', res.status);
    const text = await res.text();
    console.log('Ingest Response:', text);
  } catch (err) {
    console.error('Ingest failed:', err);
  }
}

async function triggerPredict() {
  console.log('Triggering Predictions...');
  try {
    const res = await fetch(`${API_URL}/api/cron/predict`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CRON_SECRET}`
      }
    });
    console.log('Predict Response Status:', res.status);
    const text = await res.text();
    console.log('Predict Response:', text);
  } catch (err) {
    console.error('Predict failed:', err);
  }
}

async function verify() {
  console.log('=== VERIFICATION ===');
  
  // Step 3 Verify Ingestion
  const { count: matchesCount } = await supabase.from('matches').select('*', { count: 'exact', head: true });
  console.log(`Total Matches: ${matchesCount}`);
  
  const { data: competitionsData } = await supabase.from('matches').select('league').not('league', 'is', null);
  const comps = new Set((competitionsData || []).map(m => m.league));
  console.log('Competitions:', Array.from(comps).join(', '));
  
  const { data: latestMatch } = await supabase.from('matches').select('created_at').order('created_at', { ascending: false }).limit(1);
  console.log('Latest Timestamp in matches:', latestMatch?.[0]?.created_at);

  // Step 4 World Cup Check
  const { data: wcMatches, error: wcError } = await supabase
    .from('matches')
    .select('id, league')
    .ilike('league', '%World Cup%')
    .gte('kickoff', '2026-06-27T00:00:00Z');
  
  const wcComps = new Set((wcMatches || []).map(m => m.league));
  console.log('World Cup Competitions Found:', Array.from(wcComps).join(', '));
  console.log('Future World Cup Fixtures Count:', wcMatches?.length || 0);
  if (wcError) console.error('WC Error:', wcError);

  // Step 5 Predict Check
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
  const { data: newPredictions, error: predError } = await supabase
    .from('predictions')
    .select('id, market_type, confidence, created_at')
    .gt('created_at', oneHourAgo);
  
  console.log(`New Predictions Count: ${newPredictions?.length || 0}`);
  
  if (newPredictions && newPredictions.length > 0) {
    const markets = new Set(newPredictions.map(p => p.market_type));
    console.log('Market Types:', Array.from(markets).join(', '));
    
    const confidences = newPredictions.map(p => p.confidence).filter(c => c !== null && c !== undefined);
    if (confidences.length > 0) {
      console.log(`Confidence Distribution: Min ${Math.min(...confidences)}, Max ${Math.max(...confidences)}`);
    } else {
      console.log('Confidence Distribution: All NULL');
    }
  }

  // Step 6 Paper Trading Check
  const { data: paperTrades } = await supabase
    .from('paper_trades')
    .select('id, market_type, confidence, status, created_at')
    .eq('status', 'pending');
    
  console.log(`Pending Paper Trades: ${paperTrades?.length || 0}`);
  
  if (paperTrades && paperTrades.length > 0) {
    const tradeMarkets = new Set(paperTrades.map(p => p.market_type));
    console.log('Paper Trade Markets:', Array.from(tradeMarkets).join(', '));
    const tradeConfs = paperTrades.map((p: any) => p.confidence).filter(c => c !== null && c !== undefined);
    if (tradeConfs.length > 0) {
      const sum = tradeConfs.reduce((a,b)=>a+b,0);
      console.log(`Average Trade Confidence: ${sum / tradeConfs.length}`);
    }
  }
}

async function runAll() {
  await triggerIngest();
  console.log('Waiting 10 seconds for DB state to flush...');
  await delay(10000);
  
  await triggerPredict();
  console.log('Waiting 10 seconds for predict and trading to flush...');
  await delay(10000);
  
  await verify();
}

runAll();
