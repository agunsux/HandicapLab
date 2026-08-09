// Schema + sample rows for key tables (read-only).
import 'dotenv/config';
import { rawGet } from './db.mjs';

const TABLES = ['matches', 'predictions', 'prediction_ledger', 'daily_picks', 'odds_snapshots', 'raw_matches', 'provider_logs', 'league_efficiency', 'track_record', 'prediction_ledger_v3'];

for (const t of TABLES) {
  const r = await rawGet(`/${t}`, { select: '*', limit: '3', order: 'id.desc' }, '');
  if (r.error) { console.log(`\n### ${t}: ERROR ${r.error} ${r.body}`); continue; }
  const rows = r.data ?? [];
  console.log(`\n### ${t} (sample ${rows.length})`);
  if (rows.length === 0) { console.log('EMPTY'); continue; }
  console.log('COLS:', Object.keys(rows[0]).join(', '));
  rows.forEach((row, i) => console.log(JSON.stringify(row).slice(0, 1500)));
}
