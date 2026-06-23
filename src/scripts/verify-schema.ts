import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase URL or Service Key is missing in environment.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyTablesAndRpc(): Promise<boolean> {
  console.log('🔍 Checking existence of tables and RPC...');
  let ok = true;

  // 1. Check matches table
  const { error: matchesErr } = await supabase.from('matches').select('id').limit(1);
  if (matchesErr && (matchesErr.code === '42P01' || matchesErr.code === 'PGRST205' || matchesErr.message?.includes('does not exist'))) {
    console.log('❌ Table \'matches\': MISSING');
    ok = false;
  } else if (matchesErr) {
    console.log(`⚠️ Table 'matches': Database error (${matchesErr.code}) - ${matchesErr.message}`);
    ok = false;
  } else {
    console.log('✅ Table \'matches\': PRESENT');
  }

  // 2. Check predictions table
  const { error: predictionsErr } = await supabase.from('predictions').select('id').limit(1);
  if (predictionsErr && (predictionsErr.code === '42P01' || predictionsErr.code === 'PGRST205' || predictionsErr.message?.includes('does not exist'))) {
    console.log('❌ Table \'predictions\': MISSING');
    ok = false;
  } else if (predictionsErr) {
    console.log(`⚠️ Table 'predictions': Database error (${predictionsErr.code}) - ${predictionsErr.message}`);
    ok = false;
  } else {
    console.log('✅ Table \'predictions\': PRESENT');
  }

  // 3. Check prediction_results table
  const { error: resultsErr } = await supabase.from('prediction_results').select('id').limit(1);
  if (resultsErr && (resultsErr.code === '42P01' || resultsErr.code === 'PGRST205' || resultsErr.message?.includes('does not exist'))) {
    console.log('❌ Table \'prediction_results\': MISSING');
    ok = false;
  } else if (resultsErr) {
    console.log(`⚠️ Table 'prediction_results': Database error (${resultsErr.code}) - ${resultsErr.message}`);
    ok = false;
  } else {
    console.log('✅ Table \'prediction_results\': PRESENT');
  }

  // 4. Check get_prediction_accuracy function
  const { error: rpcErr } = await supabase.rpc('get_prediction_accuracy');
  if (rpcErr) {
    console.log(`ℹ️ RPC get_prediction_accuracy check detail: Code ${rpcErr.code}, Message: ${rpcErr.message}`);
  }
  if (rpcErr && (rpcErr.code === '3F000' || rpcErr.code === '42883' || rpcErr.message?.includes('does not exist') || rpcErr.message?.includes('Could not find the function'))) {
    console.log('❌ Function \'get_prediction_accuracy\': MISSING');
    ok = false;
  } else if (rpcErr && rpcErr.code === 'PGRST202') {
    console.log('❌ Function \'get_prediction_accuracy\': MISSING');
    ok = false;
  } else {
    console.log('✅ Function \'get_prediction_accuracy\': PRESENT');
  }

  return ok;
}

async function verifyColumnExistence(): Promise<boolean> {
  console.log('🔍 Checking columns in predictions table...');
  const testColumns = [
    'match_id',
    'market_type',
    'prediction',
    'odds_snapshot',
    'closing_odds',
    'brier_score',
    'clv',
    'prediction_timestamp'
  ];

  let allExist = true;
  for (const col of testColumns) {
    const { error } = await supabase
      .from('predictions')
      .select(col)
      .limit(1);

    if (error) {
      if (error.code === '42703' || error.message?.includes('does not exist')) {
        console.log(`❌ Column '${col}': MISSING`);
        allExist = false;
      } else {
        console.log(`⚠️ Column '${col}': Database error (${error.code}) - ${error.message}`);
        allExist = false;
      }
    } else {
      console.log(`✅ Column '${col}': PRESENT`);
    }
  }
  return allExist;
}

async function runAudit(): Promise<boolean> {
  let pass = true;

  try {
    // Fetch predictions and matches
    const { data: predictions, error: predErr } = await supabase
      .from('predictions')
      .select('*')
      .limit(500);

    if (predErr) {
      console.error('❌ Failed to fetch predictions for audit:', predErr.message);
      return false;
    }

    const { data: matches, error: matchErr } = await supabase
      .from('matches')
      .select('id, status, kickoff');

    if (matchErr) {
      console.error('❌ Failed to fetch matches for audit:', matchErr.message);
      return false;
    }

    const matchesMap = new Map(matches?.map(m => [String(m.id), m]));

    if (!predictions || predictions.length === 0) {
      console.log('📭 No predictions found in database. Skipping data-level audits.');
      return true;
    }

    console.log(`\n📊 Running audits on ${predictions.length} predictions...`);

    // 1. Null rates for closing_odds on settled matches
    const finishedMatches = new Set(
      matches?.filter(m => m.status === 'finished').map(m => String(m.id)) || []
    );
    const settledPredictions = predictions.filter(p => finishedMatches.has(String(p.match_id)));
    
    if (settledPredictions.length > 0) {
      const nullClosingOdds = settledPredictions.filter(p => !p.closing_odds).length;
      const nullRate = nullClosingOdds / settledPredictions.length;
      console.log(`- Settled predictions count: ${settledPredictions.length}`);
      console.log(`- Null closing_odds count: ${nullClosingOdds} (${(nullRate * 100).toFixed(2)}%)`);
      if (nullRate >= 0.10) {
        console.log(`❌ Null rate of closing_odds on settled matches is too high (>= 10%)`);
        pass = false;
      } else {
        console.log(`✅ Null rate of closing_odds on settled matches is within acceptable bounds (< 10%)`);
      }
    } else {
      console.log('- No settled predictions available to check closing_odds null rate.');
    }

    // 2. Probabilities sum ≈ 1.0 for ML markets
    const mlPredictions = predictions.filter(p => p.market_type === 'ML');
    if (mlPredictions.length > 0) {
      let mlSumPass = true;
      for (const p of mlPredictions) {
        const predObj = typeof p.prediction === 'object' && p.prediction ? p.prediction : {};
        const h = parseFloat(predObj.home_prob || predObj.homeWinProb || '0');
        const d = parseFloat(predObj.draw_prob || predObj.drawProb || '0');
        const a = parseFloat(predObj.away_prob || predObj.awayWinProb || '0');
        const sum = h + d + a;
        if (Math.abs(sum - 1.0) > 0.001) {
          console.log(`❌ Prediction ID ${p.id} ML probabilities sum is ${sum} (expected 1.0)`);
          mlSumPass = false;
        }
      }
      if (mlSumPass) {
        console.log(`✅ All ${mlPredictions.length} Moneyline predictions sum ≈ 1.0`);
      } else {
        pass = false;
      }
    } else {
      console.log('- No Moneyline (ML) predictions available to verify probability sums.');
    }

    // 3. Odds not zero/null
    let oddsSanityPass = true;
    for (const p of predictions) {
      const snapshot = p.odds_snapshot;
      if (snapshot && typeof snapshot === 'object') {
        const market = (snapshot as any).market || {};
        const home = market.home !== undefined ? market.home : (snapshot as any).homeOdds;
        const away = market.away !== undefined ? market.away : (snapshot as any).awayOdds;
        if (home === 0 || home === null || away === 0 || away === null) {
          console.log(`❌ Prediction ID ${p.id} contains zero or null odds in snapshot.`);
          oddsSanityPass = false;
        }
      }
    }
    if (oddsSanityPass) {
      console.log('✅ All odds snapshots have non-zero/non-null odds.');
    } else {
      pass = false;
    }

    // 4. Version distribution report
    console.log('\n📈 Model Version Distribution Report:');
    const versionCounts: Record<string, number> = {};
    for (const p of predictions) {
      let verName = 'unknown';
      if (p.model_version) {
        if (typeof p.model_version === 'object') {
          verName = (p.model_version as any).name || (p.model_version as any).version || JSON.stringify(p.model_version);
        } else {
          verName = String(p.model_version);
        }
      }
      versionCounts[verName] = (versionCounts[verName] || 0) + 1;
    }
    console.log(String('Model Version').padEnd(30) + ' | Count');
    console.log('-'.repeat(30) + ' + ' + '-'.repeat(10));
    for (const [ver, count] of Object.entries(versionCounts)) {
      console.log(ver.padEnd(30) + ' | ' + count);
    }

    // 5. Sample leakage check (100 rows)
    console.log('\n🛡️ Running data leakage check on 100 predictions...');
    const samples = predictions.slice(0, 100);
    let leakageCount = 0;

    for (const p of samples) {
      const kickoffStr = p.prediction_timestamp || matchesMap.get(String(p.match_id))?.kickoff;
      if (!kickoffStr) continue;

      const kickoffTime = new Date(kickoffStr).getTime();
      const generatedTime = p.generated_at ? new Date(p.generated_at).getTime() : null;

      if (generatedTime && generatedTime > kickoffTime) {
        console.log(`❌ Leakage: Prediction ID ${p.id} generated after kickoff (generated: ${p.generated_at}, kickoff: ${kickoffStr})`);
        leakageCount++;
      }

      const snapshot = p.odds_snapshot;
      if (snapshot && typeof snapshot === 'object') {
        const ts = (snapshot as any).timestamp;
        if (ts && ts > kickoffTime) {
          console.log(`❌ Leakage: Prediction ID ${p.id} odds snapshot timestamp is after kickoff (odds timestamp: ${new Date(ts).toISOString()}, kickoff: ${kickoffStr})`);
          leakageCount++;
        }
      }
    }

    if (leakageCount === 0) {
      console.log('✅ Leakage check: 0 violations found in sample.');
    } else {
      console.log(`❌ Leakage check: ${leakageCount} violations found in sample.`);
      pass = false;
    }

  } catch (err: any) {
    console.error('❌ Audit encountered exception:', err.message);
    pass = false;
  }

  return pass;
}

async function verify() {
  console.log('🏁 Starting FootyEdge Schema & Integrity Verification...\n');
  
  const tablesAndRpcOk = await verifyTablesAndRpc();
  console.log('');

  const columnsOk = await verifyColumnExistence();
  console.log('');

  const auditOk = await runAudit();
  console.log('\n====================================');
  
  const pass = tablesAndRpcOk && columnsOk && auditOk;
  if (pass) {
    console.log('🎉 VERIFICATION RESULT: PASS');
    process.exit(0);
  } else {
    console.log('❌ VERIFICATION RESULT: FAIL');
    process.exit(1);
  }
}

verify();
