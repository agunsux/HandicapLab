// Phase 10/11/12 — upcoming windows, bookmaker/market coverage.
import 'dotenv/config';
import { rawGet } from './db.mjs';

const now = new Date();
const in24 = new Date(now.getTime() + 24 * 3600 * 1000).toISOString();
const in48 = new Date(now.getTime() + 48 * 3600 * 1000).toISOString();
const in7d = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString();

// matches windows
const mk = (filter) => rawGet('/matches', { select: 'id,home_team,away_team,league,kickoff,status', ...filter, limit: '0' });
const live = await mk({ 'status': 'eq.live' });
const up = await rawGet('/matches', { select: 'id,home_team,away_team,league,kickoff,status', 'status': 'eq.upcoming', order: 'kickoff.asc', limit: '50' });
const upRows = up.data ?? [];
const w24 = upRows.filter((r) => r.kickoff <= in24).length;
const w48 = upRows.filter((r) => r.kickoff <= in48).length;
const w7d = upRows.filter((r) => r.kickoff <= in7d).length;
console.log('UPCOMING_MATCHES total:', upRows.length, '| <24h:', w24, '| <48h:', w48, '| <7d:', w7d, '| beyond7d:', upRows.length - w7d);
console.log('UPCOMING:', JSON.stringify(upRows.map((r) => ({ h: r.home_team, a: r.away_team, l: r.league, k: r.kickoff })), null, 0));

// daily_picks future windows
const picks = await rawGet('/daily_picks', { select: 'fixture_id,market_type,kickoff_utc,status,verdict,edge_pct', 'status': 'eq.PENDING', limit: '2000' });
const pRows = picks.data ?? [];
const pf = pRows.filter((r) => new Date(r.kickoff_utc) > now);
const p24 = pf.filter((r) => new Date(r.kickoff_utc) <= in24).length;
const p48 = pf.filter((r) => new Date(r.kickoff_utc) <= in48).length;
const p7d = pf.filter((r) => new Date(r.kickoff_utc) <= in7d).length;
console.log('\nPICKS total:', pRows.length, '| future:', pf.length, '| <24h:', p24, '| <48h:', p48, '| <7d:', p7d);
console.log('PICKS verdicts future:', JSON.stringify(Object.entries(pf.reduce((m, r) => { m[r.verdict] = (m[r.verdict] || 0) + 1; return m; }, {}))));

// bookmaker tables
for (const t of ['bookmakers', 'market_books', 'market_dimension', 'wh_bookmakers']) {
  const r = await rawGet(`/${t}`, { select: 'id', limit: '0' });
  console.log(`\n${t}: count=${r.count}${r.error ? ' ERR ' + r.error : ''}`);
}
// distinct bookmakers in odds_snapshots via sample
const bs = await rawGet('/odds_snapshots', { select: 'bookmaker,market', limit: '2000' });
if (!bs.error) {
  const dm = {};
  (bs.data ?? []).forEach((r) => { const k = `${r.bookmaker}|${r.market}`; dm[k] = (dm[k] || 0) + 1; });
  console.log('ODDS bookmaker|market dist:', JSON.stringify(dm));
}
// raw_odds bookmakers
const ro = await rawGet('/raw_odds', { select: 'bookmaker,market,price', limit: '50' });
console.log('RAW_ODDS rows:', JSON.stringify(ro.data ?? ro.body));
