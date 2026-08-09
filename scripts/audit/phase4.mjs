// PHASE 4 — historical data audit: counts + date ranges for core tables.
import 'dotenv/config';
import { rawGet } from './db.mjs';

const CORE = [
  'matches', 'matches_stage_backup', 'raw_matches', 'settlements', 'settlement_results',
  'prediction_settlements_v3', 'odds', 'odds_snapshots', 'raw_odds', 'live_odds_snapshots',
  'odds_history', 'market_odds', 'predictions', 'prediction_ledger', 'prediction_ledger_v3',
  'public_prediction_ledger', 'prediction_results', 'prediction_snapshots', 'daily_picks',
  'paper_trades', 'provider_logs', 'league_efficiency', 'competitions', 'countries',
  'fixture_states', 'historical_imports', 'pre_match_snapshots', 'market_edges',
  'closing_odds', 'clv_results', 'signals', 'value_recommendations', 'teams',
  'wh_fixtures', 'wh_predictions', 'wh_closing_lines', 'wh_market_snapshots', 'wh_sync_jobs',
  'wh_sync_checkpoints', 'wh_sync_logs', 'performance_ledger', 'track_record', 'calibration_registry',
];

const DATE_COLS = ['kickoff', 'match_date', 'event_date', 'created_at', 'timestamp', 'date', 'occurred_at', 'recorded_at', 'settled_at', 'predicted_at', 'updated_at', 'captured_at', 'last_update', 'window_start', 'executed_at', 'started_at', 'season'];

async function discoverColumns(table) {
  const r = await rawGet(`/${table}`, { select: '*', limit: '1' }, '');
  if (r.error) return null;
  if (!r.data || r.data.length === 0) return { empty: true, cols: [] };
  return { empty: false, cols: Object.keys(r.data[0]) };
}

async function countRows(table) {
  const r = await rawGet(`/${table}`, { select: 'id', limit: '0' });
  return r.count ?? null;
}

async function main() {
  const out = [];
  for (const t of CORE) {
    const info = await discoverColumns(t);
    if (!info) { out.push({ table: t, error: 'NOT_EXPOSED_OR_ERROR' }); continue; }
    const count = await countRows(t);
    let range = { min: null, max: null };
    if (!info.empty) {
      const dateCol = info.cols.find((c) => DATE_COLS.includes(c));
      if (dateCol) {
        const asc = await rawGet(`/${t}`, { select: dateCol, order: `${dateCol}.asc`, limit: '1' }, '');
        const desc = await rawGet(`/${t}`, { select: dateCol, order: `${dateCol}.desc`, limit: '1' }, '');
        range = { col: dateCol, min: asc.data?.[0]?.[dateCol] ?? null, max: desc.data?.[0]?.[dateCol] ?? null };
      } else {
        range = { cols: info.cols.slice(0, 12) };
      }
    }
    out.push({ table: t, rows: count, empty: info.empty, ...range });
  }
  console.log(JSON.stringify(out, null, 1));
}

main();
