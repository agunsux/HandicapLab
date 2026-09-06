// EPIC-69 Phase 0: Forensic Read-Only Architecture Audit
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const BASE = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '') + '/rest/v1';
const KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '').replace(/['`"]/g, '').trim();

if (!KEY || KEY.length < 20) {
  console.error('MISSING_SERVICE_KEY in .env.local / .env');
  process.exit(1);
}

async function get(pathStr, params = {}, prefer = 'count=exact') {
  const qs = new URLSearchParams(params);
  const url = `${BASE}${pathStr}${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(url, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      Prefer: prefer,
    },
  });
  if (!res.ok) {
    return { error: res.status, body: (await res.text()).slice(0, 300) };
  }
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\*\/(\d+)/) || cr.match(/\d+-\d+\/(\d+)/);
  const count = m ? Number(m[1]) : null;
  const body = await res.json();
  return { data: body, count };
}

async function runAudit() {
  console.log('=== EPIC-69 PHASE 0: FORENSIC ARCHITECTURE AUDIT ===');
  
  // 1. Fetch OpenAPI Spec
  const specRes = await fetch(`${BASE}/`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` }
  });
  const spec = await specRes.json();
  const allTables = Object.keys(spec.definitions || {});
  console.log(`Total tables defined in OpenAPI: ${allTables.length}`);

  // 2. Target Tables to Inspect
  const candidateTables = [
    'matches',
    'historical_matches',
    'historical_odds',
    'raw_matches',
    'raw_odds',
    'daily_picks',
    'active_daily_picks',
    'archived_daily_picks',
    'predictions',
    'prediction_snapshots',
    'prediction_results',
    'prediction_settlements_v3',
    'prediction_ledger',
    'prediction_ledger_v3',
    'public_prediction_ledger',
    'wh_predictions',
    'odds_snapshots',
    'live_odds_snapshots',
    'market_closing_lines',
    'market_odds',
    'model_registry',
    'model_versions',
    'experiments',
    'experiment_registry',
    'team_form_features',
    'match_features',
    'wh_market_features',
    'wh_team_elo_history',
    'coaches',
    'competitions',
    'league_intelligence',
    'league_calibrations',
    'export_requests',
    'signal_classification_config'
  ];

  const auditReport = {
    timestamp: new Date().toISOString(),
    liveTables: {},
    tableCounts: {},
    sampleRecords: {},
  };

  for (const tbl of candidateTables) {
    const exists = allTables.includes(tbl);
    if (!exists) {
      auditReport.liveTables[tbl] = { exists: false };
      auditReport.tableCounts[tbl] = 'NOT_FOUND';
      continue;
    }

    const def = spec.definitions[tbl];
    const cols = Object.keys(def.properties || {});
    auditReport.liveTables[tbl] = {
      exists: true,
      columnsCount: cols.length,
      columns: cols,
    };

    // Query count and sample
    const countRes = await get(`/${tbl}`, { limit: '2' }, 'count=exact');
    if (countRes.error) {
      auditReport.tableCounts[tbl] = `ERROR_${countRes.error}`;
      auditReport.sampleRecords[tbl] = null;
    } else {
      auditReport.tableCounts[tbl] = countRes.count !== null ? countRes.count : (countRes.data?.length || 0);
      auditReport.sampleRecords[tbl] = (countRes.data || []).slice(0, 1);
    }
  }

  // Write detailed report to reports/EPIC69_PHASE0_LIVE_AUDIT.json
  const outPath = path.resolve(process.cwd(), 'reports', 'EPIC69_PHASE0_LIVE_AUDIT.json');
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, JSON.stringify(auditReport, null, 2), 'utf-8');
  console.log(`Report written to ${outPath}`);

  // Print summary table to console
  console.log('\n--- LIVE TABLE COUNTS & STATUS ---');
  for (const [tbl, count] of Object.entries(auditReport.tableCounts)) {
    const exists = auditReport.liveTables[tbl]?.exists;
    console.log(`${tbl.padEnd(30)}: ${exists ? 'EXISTS' : 'ABSENT'} | count: ${count}`);
  }
}

runAudit().catch(console.error);
