import { loadJsonl, buildBets, summarizeBy, monthlyBreakdown } from '../src/historical/realOdds/validate';
import { OssPick } from '../src/historical/realOdds/validate';
import { RealOddsPair } from '../src/historical/realOdds/ingest';
import { clusterOfPick, clusterOf, CLUSTERS } from '../src/historical/regime/analyze';

const fs = require('fs');

const picks = loadJsonl<OssPick>('data/historical/out_of_sample_predictions.jsonl');
const pairs = loadJsonl<RealOddsPair>('data/historical/real_odds.jsonl');
const bets = buildBets(picks, pairs);

// odds bands overall
const bands: Array<[number, number, string]> = [[1, 1.5, '<1.50'], [1.5, 1.8, '1.50-1.79'], [1.8, 2.0, '1.80-1.99'], [2.0, 2.5, '2.00-2.49'], [2.5, 3.0, '2.50-2.99'], [3.0, 999, '3.00+']];
console.log('=== ODDS BANDS (all clusters) ===');
for (const [lo, hi, label] of bands) {
  const b = bets.filter((x) => x.entry_odds >= lo && x.entry_odds < hi);
  const st = b.reduce((s, x) => s + x.stake, 0);
  const pf = b.reduce((s, x) => s + x.profit, 0);
  console.log(label, 'bets=' + b.length, 'roi=' + (st ? Number((pf / st).toFixed(4)) : null), 'profit=' + Number(pf.toFixed(2)));
}

// odds bands per cluster
console.log('\n=== ODDS BANDS BY CLUSTER ===');
for (const c of CLUSTERS) {
  const cb = bets.filter((x) => clusterOf(x.match_date)?.id === c.id);
  const out: Record<string, unknown> = {};
  for (const [lo, hi, label] of bands) {
    const b = cb.filter((x) => x.entry_odds >= lo && x.entry_odds < hi);
    const st = b.reduce((s, x) => s + x.stake, 0);
    const pf = b.reduce((s, x) => s + x.profit, 0);
    out[label] = { bets: b.length, roi: st ? Number((pf / st).toFixed(4)) : null };
  }
  console.log(c.id, JSON.stringify(out));
}

// market breakdown per cluster
console.log('\n=== MARKET BY CLUSTER ===');
for (const c of CLUSTERS) {
  const cb = bets.filter((x) => clusterOf(x.match_date)?.id === c.id);
  console.log(c.id, JSON.stringify(summarizeBy(cb, (b) => b.market)));
}

// league = EPL only; report as single league
console.log('\n=== LEAGUE ===');
const leagues = new Set(picks.map((p) => p.match_id.split('-')[0]));
console.log('leagues in picks:', [...leagues].join(','));

// monthly by cluster
console.log('\n=== MONTHLY C1/C2 ===');
for (const c of CLUSTERS) {
  const cb = bets.filter((x) => clusterOf(x.match_date)?.id === c.id);
  const m = monthlyBreakdown(cb);
  const pos = m.filter((x) => (x.profit as number) > 0).length;
  const neg = m.filter((x) => (x.profit as number) < 0).length;
  const avgRoi = m.length ? m.reduce((s, x) => s + (x.roi as number), 0) / m.length : null;
  console.log(c.id, 'months=' + m.length, 'pos=' + pos, 'neg=' + neg, 'avgMonthlyRoi=' + (avgRoi !== null ? Number(avgRoi.toFixed(4)) : null));
}
