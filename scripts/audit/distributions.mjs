// PHASE 5-9 — distribution/aggregation audit computed locally from full column pulls.
import 'dotenv/config';
import { rawGet } from './db.mjs';

async function pull(table, select, opts = {}) {
  const out = [];
  let offset = 0;
  const LIMIT = 1000;
  for (;;) {
    const r = await rawGet(`/${table}`, { select, limit: String(LIMIT), offset: String(offset), ...opts }, '');
    if (r.error) return { error: r.error, body: r.body };
    out.push(...(r.data ?? []));
    if (r.count !== null && out.length >= r.count) break;
    if (r.data && r.data.length < LIMIT) break;
    offset += LIMIT;
  }
  return { rows: out };
}

function distinctCount(arr) { return new Set(arr).size; }
function counts(arr) {
  const m = {};
  arr.forEach((v) => { const k = v === null || v === undefined ? '(null)' : String(v); m[k] = (m[k] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// --- matches ---
{
  const { rows } = await pull('matches', 'id,league,status,home_goals,away_goals,kickoff,var_era');
  const finished = rows.filter((r) => r.home_goals !== null && r.away_goals !== null);
  console.log('MATCHES total:', rows.length, '| with goals:', finished.length, '| status dist:', JSON.stringify(counts(rows.map((r) => r.status))));
  console.log('MATCHES league dist:', JSON.stringify(counts(rows.map((r) => r.league)).slice(0, 20)));
  console.log('MATCHES var_era true:', rows.filter((r) => r.var_era === true).length);
}

// --- predictions: uniqueness of probability/odds ---
{
  const { rows } = await pull('predictions', 'id,match_id,market_type,model_probability,model_version,feature_version,prediction_timestamp,generated_at,odds_snapshot,expected_value');
  console.log('\nPREDICTIONS total:', rows.length);
  console.log('PREDICTIONS market dist:', JSON.stringify(counts(rows.map((r) => r.market_type))));
  const probVals = rows.map((r) => r.model_probability);
  const evVals = rows.map((r) => r.expected_value).filter((v) => v !== null && v !== undefined);
  const oddsJson = rows.map((r) => JSON.stringify(r.odds_snapshot));
  console.log('PREDICTIONS distinct model_probability:', distinctCount(probVals), 'of', probVals.length, '| distinct odds_snapshot json:', distinctCount(oddsJson));
  console.log('PREDICTIONS top probabilities:', JSON.stringify(counts(probVals).slice(0, 10)));
  console.log('PREDICTIONS EV min/max:', Math.min(...evVals), '/', Math.max(...evVals), '| EV>0.2 count:', evVals.filter((v) => v > 0.2).length);
  const late = rows.filter((r) => r.prediction_timestamp && r.generated_at && new Date(r.generated_at) > new Date(r.prediction_timestamp));
  console.log('PREDICTIONS generated AFTER kickoff (leakage risk):', late.length);
  console.log('PREDICTIONS model_version dist:', JSON.stringify(counts(rows.map((r) => r.model_version))));
  console.log('PREDICTIONS feature_version dist:', JSON.stringify(counts(rows.map((r) => r.feature_version))));
}

// --- odds_snapshots ---
{
  const { rows } = await pull('odds_snapshots', 'id,bookmaker,market,home_odds,draw_odds,away_odds,line,captured_at');
  console.log('\nODDS_SNAPSHOTS total:', rows.length);
  console.log('ODDS bookmaker dist:', JSON.stringify(counts(rows.map((r) => r.bookmaker))));
  console.log('ODDS market dist:', JSON.stringify(counts(rows.map((r) => r.market))));
  console.log('ODDS distinct (home,draw,away) tuples:', distinctCount(rows.map((r) => `${r.home_odds}|${r.draw_odds}|${r.away_odds}`)));
  console.log('ODDS top tuples:', JSON.stringify(counts(rows.map((r) => `${r.home_odds}|${r.draw_odds}|${r.away_odds}`)).slice(0, 8)));
}

// --- prediction_ledger ---
{
  const { rows } = await pull('prediction_ledger', 'id,market,decision,decision_reason,result_status,verified');
  console.log('\nLEDGER total:', rows.length);
  console.log('LEDGER decision dist:', JSON.stringify(counts(rows.map((r) => r.decision))));
  console.log('LEDGER reason dist:', JSON.stringify(counts(rows.map((r) => r.decision_reason))));
  console.log('LEDGER result_status dist:', JSON.stringify(counts(rows.map((r) => r.result_status))));
}

// --- daily_picks ---
{
  const { rows } = await pull('daily_picks', 'id,market_type,verdict,status,source,edge_pct,market_odds,fair_odds,model_probability');
  console.log('\nDAILY_PICKS total:', rows.length);
  console.log('PICKS market dist:', JSON.stringify(counts(rows.map((r) => r.market_type))));
  console.log('PICKS verdict dist:', JSON.stringify(counts(rows.map((r) => r.verdict))));
  console.log('PICKS status dist:', JSON.stringify(counts(rows.map((r) => r.status))));
  console.log('PICKS source dist:', JSON.stringify(counts(rows.map((r) => r.source))));
  const edges = rows.map((r) => r.edge_pct).filter((v) => v !== null && v !== undefined && v !== 0);
  console.log('PICKS nonzero edges:', edges.length, 'min:', Math.min(...edges), 'max:', Math.max(...edges));
}

// --- provider_logs ---
{
  const { rows } = await pull('provider_logs', 'id,provider,endpoint,status_code,level,created_at');
  console.log('\nPROVIDER_LOGS total:', rows.length);
  console.log('LOGS provider dist:', JSON.stringify(counts(rows.map((r) => r.provider))));
  console.log('LOGS endpoint dist:', JSON.stringify(counts(rows.map((r) => r.endpoint))));
  console.log('LOGS status dist:', JSON.stringify(counts(rows.map((r) => r.status_code))));
  const perProvider = {};
  rows.forEach((r) => { perProvider[r.provider] = perProvider[r.provider] || { n: 0, ok: 0, err: 0 }; perProvider[r.provider].n++; (r.status_code >= 200 && r.status_code < 300) ? perProvider[r.provider].ok++ : perProvider[r.provider].err++; });
  console.log('LOGS per-provider:', JSON.stringify(perProvider));
}

// --- raw_matches ---
{
  const { rows } = await pull('raw_matches', 'id,league_code,season,result,home_odds,source_file');
  console.log('\nRAW_MATCHES total:', rows.length);
  console.log('RAW leagues:', JSON.stringify(counts(rows.map((r) => r.league_code))));
  console.log('RAW seasons:', JSON.stringify(counts(rows.map((r) => r.season))));
  console.log('RAW with odds:', rows.filter((r) => r.home_odds !== null).length, '| with result:', rows.filter((r) => r.result).length);
  console.log('RAW source files:', JSON.stringify(counts(rows.map((r) => r.source_file))));
}
