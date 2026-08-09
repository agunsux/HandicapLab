// PHASE 1 pre-flight — full raw_matches quality analysis (read-only).
import 'dotenv/config';
import { rawGet } from './db.mjs';

const r = await rawGet('/raw_matches', { select: '*', limit: '3000', order: 'id.asc' });
if (r.error) { console.log('ERR', r.error, r.body); process.exit(1); }
const rows = r.data;
console.log('ROWS:', rows.length);

// id ranges and monotonic
const ids = rows.map(x => x.id);
console.log('ID min/max:', Math.min(...ids), Math.max(...ids));

// null-ness by column
const cols = Object.keys(rows[0]);
for (const c of cols) {
  const nulls = rows.filter(x => x[c] === null || x[c] === undefined).length;
  if (nulls > 0) console.log(`NULL ${c}: ${nulls}/${rows.length}`);
}

// season format distribution
const seasons = {};
rows.forEach(x => { seasons[x.season] = (seasons[x.season] || 0) + 1; });
console.log('SEASONS:', JSON.stringify(seasons));

// per-season date range + counts + odds coverage
const bySeason = {};
rows.forEach(x => {
  const s = x.season;
  bySeason[s] = bySeason[s] || { n: 0, min: null, max: null, withOdds: 0, withGoals: 0, results: {} };
  const b = bySeason[s];
  b.n++;
  const d = x.match_date;
  if (!b.min || d < b.min) b.min = d;
  if (!b.max || d > b.max) b.max = d;
  if (x.home_odds != null) b.withOdds++;
  if (x.full_time_home_goals != null && x.full_time_away_goals != null) b.withGoals++;
  b.results[x.result] = (b.results[x.result] || 0) + 1;
});
for (const [s, b] of Object.entries(bySeason)) {
  console.log(`SEASON ${s}: n=${b.n} range=${b.min}..${b.max} odds=${b.withOdds} goals=${b.withGoals} results=${JSON.stringify(b.results)}`);
}

// duplicates: same season+date+home+away
const keyed = new Map();
let dups = 0;
rows.forEach(x => {
  const k = `${x.season}|${x.match_date}|${x.home_team}|${x.away_team}`;
  if (keyed.has(k)) dups++;
  keyed.set(k, x.id);
});
console.log('DUPLICATE season|date|teams:', dups);

// odds sanity: home_odds vs result
const badOdds = rows.filter(x => x.home_odds != null && (x.home_odds < 1.01 || x.home_odds > 50 || x.away_odds < 1.01)).length;
console.log('SUSPECT ODDS:', badOdds);

// draw odds coverage
const withDraw = rows.filter(x => x.draw_odds != null).length;
const withOU = rows.filter(x => x.over25_odds != null && x.under25_odds != null).length;
console.log('WITH DRAW ODDS:', withDraw, '| WITH OU25 ODDS:', withOU);

// team list
const teams = new Set();
rows.forEach(x => { teams.add(x.home_team); teams.add(x.away_team); });
console.log('UNIQUE TEAMS:', teams.size);

// sample rows from different seasons
for (const s of Object.keys(bySeason).slice(0, 2)) {
  const sample = rows.find(x => x.season === s);
  console.log('SAMPLE:', JSON.stringify(sample));
}
