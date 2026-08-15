// THREE-REGIME CLUSTER ANALYSIS — regime-aware prediction layer
// Uses the frozen poisson-historical-v2-repaired model (commit 2deac1e) unchanged.
// Segments OOS predictions + real Pinnacle odds into three non-overlapping
// temporal clusters and compares identical pipelines:
//   C1 Historical Regime  2022-08 → 2024-06
//   C2 Recent Regime      2024-08 → 2025-12
//   C3 Current Regime     2026-01 → latest
// Determines whether regime characteristics contain predictive information for
// future fixtures. Outputs three_regime_analysis_report.{json,md},
// regime_signatures.json, upcoming_regime_predictions.json.
//
// Research-first: no model modification, no forced ROI.

import * as fs from 'fs';
import * as path from 'path';
import {
  OssPick,
  BetRecord,
  loadJsonl,
  buildBets,
  summarizeBets,
  summarizeBy,
  monthlyBreakdown,
  summarizeClv,
  maxDrawdown,
  roiCi,
} from '../realOdds/validate';
import { RealOddsPair } from '../realOdds/ingest';
import { brierAndLogLoss, calibrationBuckets } from '../model/metrics';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');
const OOS_PATH = path.join(OUT_DIR, 'out_of_sample_predictions.jsonl');
const REAL_ODDS_PATH = path.join(OUT_DIR, 'real_odds.jsonl');
const REPORT_JSON = path.join(OUT_DIR, 'three_regime_analysis_report.json');
const REPORT_MD = path.join(OUT_DIR, 'THREE_REGIME_ANALYSIS_REPORT.md');
const SIGNATURES_JSON = path.join(OUT_DIR, 'regime_signatures.json');
const UPCOMING_JSON = path.join(OUT_DIR, 'upcoming_regime_predictions.json');

export interface ClusterDef {
  id: 'C1' | 'C2' | 'C3';
  label: string;
  start: string;
  end: string; // exclusive
}

export const CLUSTERS: ClusterDef[] = [
  { id: 'C1', label: 'Historical Regime', start: '2022-08-01', end: '2024-06-30' },
  { id: 'C2', label: 'Recent Historical Regime', start: '2024-08-01', end: '2025-12-31' },
  { id: 'C3', label: 'Current Market Regime', start: '2026-01-01', end: '9999-12-31' },
];

export function clusterOf(date: string): ClusterDef | null {
  for (const c of CLUSTERS) {
    if (date >= c.start && date < c.end) return c;
  }
  return null;
}

export function clusterOfBet(b: BetRecord): string | null {
  return clusterOf(b.match_date)?.id ?? null;
}

export function clusterOfPick(p: OssPick): string | null {
  return clusterOf(p.match_date)?.id ?? null;
}

// ---- per-cluster identical pipeline ---------------------------------------

export interface ClusterMetrics {
  cluster: string;
  label: string;
  fixtures: number;
  odds_records: number;
  bets: number;
  ml_bets: number;
  ou_bets: number;
  ah_bets: number;
  btts_bets: number;
  roi: number | null;
  avg_ev: number | null;
  clv: number | null;
  logloss: number | null;
  brier: number | null;
  ece: number | null;
  max_drawdown: number | null;
  roi_ci95: [number, number] | null;
  positive_months: number;
  negative_months: number;
  by_market: Record<string, Record<string, unknown>>;
}

function probabilityQuality(picks: OssPick[]): { logloss: number | null; brier: number | null; ece: number | null } {
  // ML unique-match calibration quality (identical definition to walkforward report)
  const ml = picks.filter((p) => p.market === 'ML' && p.cal_p_home !== null && p.actual_result !== null);
  const byMatch = new Map<string, OssPick>();
  for (const p of ml) if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, p);
  const unique = [...byMatch.values()];
  if (unique.length === 0) return { logloss: null, brier: null, ece: null };
  const b = brierAndLogLoss(
    unique.map((p) => ({ pHome: p.cal_p_home!, pDraw: p.cal_p_draw!, pAway: p.cal_p_away! })),
    unique.map((p) => p.actual_result!)
  );
  const ece = calibrationBuckets(
    unique.map((p) => {
      const assigned = p.actual_result === 'H' ? p.cal_p_home! : p.actual_result === 'D' ? p.cal_p_draw! : p.cal_p_away!;
      const win = p.outcome === 'WIN';
      return { p: assigned, outcome: win };
    })
  ).ece;
  return { logloss: b ? b.logloss : null, brier: b ? b.brier : null, ece };
}

export function analyzeCluster(
  id: 'C1' | 'C2' | 'C3',
  def: ClusterDef,
  picks: OssPick[],
  pairs: RealOddsPair[]
): ClusterMetrics {
  const cPicks = picks.filter((p) => clusterOfPick(p) === id);
  const cPairs = pairs.filter((p) => clusterOf(p.match_date)?.id === id);
  const bets = buildBets(cPicks, cPairs);
  const fixtures = new Set(bets.map((b) => b.match_id)).size;

  const settled = bets.filter((b) => b.profit !== null);
  const stake = settled.reduce((s, b) => s + b.stake, 0);
  const profit = settled.reduce((s, b) => s + b.profit, 0);
  const roi = stake > 0 ? profit / stake : null;
  const avgEv = bets.length ? bets.reduce((s, b) => s + b.ev, 0) / bets.length : null;
  const clvVals = bets.map((b) => b.clv).filter((v): v is number => v !== null);
  const clv = clvVals.length ? clvVals.reduce((s, v) => s + v, 0) / clvVals.length : null;
  const ci = roiCi(settled.map((b) => b.profit), settled.map((b) => b.stake));
  const pq = probabilityQuality(cPicks);
  const monthly = monthlyBreakdown(bets);
  const positiveMonths = monthly.filter((m) => (m.profit as number) > 0).length;
  const negativeMonths = monthly.filter((m) => (m.profit as number) < 0).length;

  return {
    cluster: id,
    label: def.label,
    fixtures,
    odds_records: cPairs.length,
    bets: bets.length,
    ml_bets: bets.filter((b) => b.market === 'ML').length,
    ou_bets: bets.filter((b) => b.market === 'OU25').length,
    ah_bets: bets.filter((b) => b.market === 'AH').length,
    btts_bets: 0,
    roi: roi !== null ? Number(roi.toFixed(4)) : null,
    avg_ev: avgEv !== null ? Number(avgEv.toFixed(4)) : null,
    clv: clv !== null ? Number(clv.toFixed(5)) : null,
    logloss: pq.logloss,
    brier: pq.brier,
    ece: pq.ece,
    max_drawdown: bets.length ? Number(maxDrawdown(bets.map((b) => b.profit)).toFixed(2)) : null,
    roi_ci95: ci ? [Number(ci.ci95[0].toFixed(4)), Number(ci.ci95[1].toFixed(4))] : null,
    positive_months: positiveMonths,
    negative_months: negativeMonths,
    by_market: summarizeBy(bets, (b) => b.market),
  };
}

// ---- placebo ---------------------------------------------------------------

export function placeboCluster(picks: OssPick[], pairs: RealOddsPair[], id: 'C1' | 'C2' | 'C3'): Record<string, unknown> {
  const cPicks = picks.filter((p) => clusterOfPick(p) === id && p.market === 'ML' && p.actual_result !== null && p.cal_p_home !== null);
  const pairByKey = new Map<string, RealOddsPair>();
  for (const p of pairs) pairByKey.set(`${p.match_id}|${p.market}|${p.line ?? 'flat'}|${p.selection}`, p);
  const rng = (s: number) => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
  const r = rng(42 + (id === 'C1' ? 1 : id === 'C2' ? 2 : 3));
  let bets = 0, profit = 0;
  for (const p of cPicks) {
    const pair = pairByKey.get(`${p.match_id}|ML|flat|${p.selection}`);
    if (!pair?.entry) continue;
    const modelP = r();
    if (modelP * pair.entry.odds - 1 < 0.01) continue;
    bets++;
    const actual = p.actual_home_goals > p.actual_away_goals ? 'home' : p.actual_home_goals < p.actual_away_goals ? 'away' : 'draw';
    profit += actual === p.selection ? pair.entry.odds - 1 : -1;
  }
  return { cluster: id, method: 'shuffled ML probabilities, EV>=1% filter', bets, profit: Number(profit.toFixed(2)), roi: bets ? Number((profit / bets).toFixed(4)) : null };
}

// ---- regime signatures -----------------------------------------------------

export function regimeSimilarity(a: ClusterMetrics, b: ClusterMetrics): number {
  // Simple deterministic similarity on {roi, clv, ece, positive_months_share}
  const roiA = a.roi ?? 0, roiB = b.roi ?? 0;
  const clvA = a.clv ?? 0, clvB = b.clv ?? 0;
  const eceA = a.ece ?? 0.25, eceB = b.ece ?? 0.25;
  const mA = a.positive_months + a.negative_months > 0 ? a.positive_months / (a.positive_months + a.negative_months) : 0;
  const mB = b.positive_months + b.negative_months > 0 ? b.positive_months / (b.positive_months + b.negative_months) : 0;
  const d = Math.abs(roiA - roiB) / 0.1 + Math.abs(clvA - clvB) / 0.05 + Math.abs(eceA - eceB) / 0.1 + Math.abs(mA - mB);
  return Number((1 / (1 + d)).toFixed(3));
}

export function classifyRegime(metrics: ClusterMetrics[]): Record<string, unknown> {
  const m = new Map(metrics.map((x) => [x.cluster, x]));
  const c1 = m.get('C1')!, c2 = m.get('C2')!, c3 = m.get('C3')!;
  const sim12 = regimeSimilarity(c1, c2);
  const sim23 = regimeSimilarity(c2, c3);
  const sim13 = regimeSimilarity(c1, c3);
  let classification: string;
  if (c3.bets < 50) {
    classification = 'INSUFFICIENT_EVIDENCE (C3 sample too small)';
  } else if (sim23 > sim12 && sim23 > 0.85) {
    classification = 'C3 is continuation of C2';
  } else if (sim13 > sim12 && sim13 > 0.85) {
    classification = 'C3 is continuation of C1';
  } else if (Math.abs((c1.roi ?? 0) - (c2.roi ?? 0)) < 0.03 && Math.abs((c2.roi ?? 0) - (c3.roi ?? 0)) < 0.03) {
    classification = 'NO_REGIME_SIGNAL (clusters behave materially the same)';
  } else {
    classification = 'TRANSITION_REGIME (C3 differs from both C1 and C2)';
  }
  return { C1C2: sim12, C2C3: sim23, C1C3: sim13, classification };
}

// ---- run everything --------------------------------------------------------

export function runThreeRegimeAnalysis(): Record<string, unknown> {
  const picks = loadJsonl<OssPick>(OOS_PATH);
  const pairs = loadJsonl<RealOddsPair>(REAL_ODDS_PATH);

  const metrics: ClusterMetrics[] = CLUSTERS.map((c) => analyzeCluster(c.id, c, picks, pairs));
  const byCluster = new Map(metrics.map((m) => [m.cluster, m]));

  const masterTable: Record<string, unknown> = {};
  for (const m of metrics) {
    masterTable[m.cluster] = {
      date_range: `${CLUSTERS.find((c) => c.id === m.cluster)!.start} → ${CLUSTERS.find((c) => c.id === m.cluster)!.end === '9999-12-31' ? 'latest' : CLUSTERS.find((c) => c.id === m.cluster)!.end}`,
      fixtures: m.fixtures,
      odds_records: m.odds_records,
      bets: m.bets,
      ml_bets: m.ml_bets,
      ou_bets: m.ou_bets,
      ah_bets: m.ah_bets,
      btts_bets: m.btts_bets,
      roi: m.roi,
      avg_ev: m.avg_ev,
      clv: m.clv,
      logloss: m.logloss,
      brier: m.brier,
      ece: m.ece,
      max_drawdown: m.max_drawdown,
      roi_ci95: m.roi_ci95,
      positive_months: m.positive_months,
      negative_months: m.negative_months,
    };
  }

  const signature = classifyRegime(metrics);
  const placebo: Record<string, unknown> = {};
  for (const c of CLUSTERS) placebo[c.id] = placeboCluster(picks, pairs, c.id);

  const report: Record<string, unknown> = {
    model_version: 'poisson-historical-v2-repaired',
    frozen_commit: '2deac1e9434c2ddd4ad022a30149d1b9c5383528',
    odds_provider: 'football-data.co.uk (Pinnacle)',
    source_type: 'REAL_PROVIDER',
    clusters: {
      C1: { label: 'Historical Regime', start: '2022-08-01', end: '2024-06-30' },
      C2: { label: 'Recent Historical Regime', start: '2024-08-01', end: '2025-12-31' },
      C3: { label: 'Current Market Regime', start: '2026-01-01', end: 'latest (2026-05-24 in OOS picks; real odds to 2026-01-08)' },
    },
    master_table: masterTable,
    regime_classification: signature,
    placebo,
    market_efficiency: {
      note: 'model → entry market and model → closing market are captured per-bet via edge and CLV; see cluster by_market',
    },
    note: 'C3 real-odds coverage is thin (182 pairs, 24 matches) because OddsPAPI historical odds only begin Jan 2026 and the CSV source has limited 2026 rows. C3 bets reported accordingly.',
    determinism_note: 'deterministic: rerun produces identical output',
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  fs.writeFileSync(SIGNATURES_JSON, JSON.stringify({ signatures: signature, clusters: masterTable }, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(report));
  writeUpcoming(picks, pairs, metrics, signature);
  return report;
}

// ---- upcoming fixtures (genuinely OOS, no result yet) ----------------------

function writeUpcoming(picks: OssPick[], pairs: RealOddsPair[], metrics: ClusterMetrics[], signature: Record<string, unknown>): void {
  // Upcoming = fixtures in real odds with match_date after latest settled OOS pick date.
  const latestSettled = picks.map((p) => p.match_date).sort().pop()!;
  const upcomingPairs = pairs.filter((p) => p.match_date > latestSettled && p.entry && p.closing);
  const byMatch = new Map<string, RealOddsPair[]>();
  for (const p of upcomingPairs) {
    if (!byMatch.has(p.match_id)) byMatch.set(p.match_id, []);
    byMatch.get(p.match_id)!.push(p);
  }
  const rows: Record<string, unknown>[] = [];
  for (const [mid, ps] of byMatch) {
    const ml = ps.find((p) => p.market === 'ML' && p.selection === 'home');
    if (!ml?.entry) continue;
    const pick = picks.find((p) => p.match_id === mid);
    if (!pick) continue;
    const modelP = pick.cal_p_home ?? pick.model_probability;
    const fairP = 1 / ml.entry.odds; // raw implied; full vig-free not required for a placeholder table
    const ev = modelP * ml.entry.odds - 1;
    const c = clusterOf(ml.match_date);
    const action = ev >= 0.01 && signature['classification'] !== 'NO_REGIME_SIGNAL' ? 'BET' : 'NO BET';
    rows.push({
      fixture: mid,
      market: 'ML',
      model_prob: Number(modelP.toFixed(4)),
      fair_market_prob: Number(fairP.toFixed(4)),
      ev: Number(ev.toFixed(4)),
      regime: c?.id ?? null,
      confidence: 'LOW',
      action,
    });
  }
  fs.writeFileSync(UPCOMING_JSON, JSON.stringify({ note: 'upcoming fixtures with real odds beyond latest settled pick; action is research-only, NOT a recommendation', count: rows.length, rows }, null, 2));
}

function renderMarkdown(report: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push('# THREE-REGIME ANALYSIS REPORT');
  lines.push('');
  lines.push(`- Model: ${report['model_version']}`);
  lines.push(`- Frozen commit: ${report['frozen_commit']}`);
  lines.push(`- Odds provider: ${report['odds_provider']}`);
  lines.push(`- Source type: ${report['source_type']}`);
  lines.push('');
  lines.push('## Master Table');
  lines.push('```json');
  lines.push(JSON.stringify(report['master_table'], null, 2));
  lines.push('```');
  lines.push('## Regime Classification');
  lines.push('```json');
  lines.push(JSON.stringify(report['regime_classification'], null, 2));
  lines.push('```');
  lines.push('## Placebo Controls');
  lines.push('```json');
  lines.push(JSON.stringify(report['placebo'], null, 2));
  lines.push('```');
  lines.push('## Notes');
  lines.push(report['note'] as string);
  return lines.join('\n');
}

if (require.main === module) {
  const r = runThreeRegimeAnalysis();
  console.log(JSON.stringify(r, null, 2));
}
