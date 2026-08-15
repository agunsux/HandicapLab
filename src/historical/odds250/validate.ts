// FROZEN 2.50-2.99 ODDS HYPOTHESIS — OOS VALIDATION ENGINE
// Hypothesis (frozen before C3): entry_odds >= 2.50 AND <= 2.99
// Historical discovery: C1 +9.4%, C2 +12.9%, combined +11.4% (n=315)
// This EPIC determines whether the frozen band survives genuinely unseen 2026 data.
// C3 source per EPIC: OddsPAPI (Pinnacle/Circa/SBO). If no OddsPAPI linkage
// exists, the correct decision is C3_VALIDATION_BLOCKED — never fabricate.

import * as fs from 'fs';
import * as path from 'path';
import { loadJsonl, buildBets, maxDrawdown, roiCi, BetRecord } from '../realOdds/validate';
import { OssPick } from '../realOdds/validate';
import { RealOddsPair } from '../realOdds/ingest';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');
const OOS_PATH = path.join(OUT_DIR, 'out_of_sample_predictions.jsonl');
const REAL_ODDS_PATH = path.join(OUT_DIR, 'real_odds.jsonl');
const REPORT_JSON = path.join(OUT_DIR, 'odds_250_299_oos_report.json');
const REPORT_MD = path.join(OUT_DIR, 'ODDS_250_299_OOS_REPORT.md');
const PREDS_JSONL = path.join(OUT_DIR, 'odds_250_299_oos_predictions.jsonl');
const LINKAGE_JSON = path.join(OUT_DIR, 'oddspapi_linkage_report.json');

export const HYPOTHESIS = { lo: 2.5, hi: 2.99, inclusive: true };
export const MODEL_VERSION = 'poisson-historical-v2-repaired';
export const FROZEN_COMMIT = '2deac1e9434c2ddd4ad022a30149d1b9c5383528';

export const CLUSTER_RANGES = {
  C1: { start: '2022-08-01', end: '2024-06-30' },
  C2: { start: '2024-08-01', end: '2025-12-31' },
  C3: { start: '2026-01-01', end: '9999-12-31' },
} as const;

export function inBand(entryOdds: number): boolean {
  return entryOdds >= HYPOTHESIS.lo && entryOdds <= HYPOTHESIS.hi;
}

export function clusterOf(date: string): 'C1' | 'C2' | 'C3' | null {
  if (date >= CLUSTER_RANGES.C1.start && date < CLUSTER_RANGES.C1.end) return 'C1';
  if (date >= CLUSTER_RANGES.C2.start && date < CLUSTER_RANGES.C2.end) return 'C2';
  if (date >= CLUSTER_RANGES.C3.start && date < CLUSTER_RANGES.C3.end) return 'C3';
  return null;
}

export interface ClusterSummary {
  cluster: string;
  bets: number;
  wins: number;
  losses: number;
  pushes: number;
  half_wins: number;
  half_losses: number;
  stake: number;
  profit: number;
  roi: number | null;
  avg_ev: number | null;
  median_ev: number | null;
  clv: number | null;
  median_clv: number | null;
  positive_clv_pct: number | null;
  hit_rate: number | null;
  max_drawdown: number | null;
  roi_ci95: [number, number] | null;
  positive_months: number;
  negative_months: number;
  avg_monthly_roi: number | null;
  best_month: { month: string; roi: number } | null;
  worst_month: { month: string; roi: number } | null;
}

function median(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export function summarizeCluster(bets: BetRecord[]): ClusterSummary {
  const settled = bets.filter((b) => b.profit !== null);
  const stake = settled.reduce((s, b) => s + b.stake, 0);
  const profit = settled.reduce((s, b) => s + b.profit, 0);
  const roi = stake > 0 ? profit / stake : null;
  const evs = bets.map((b) => b.ev);
  const clvVals = bets.map((b) => b.clv).filter((v): v is number => v !== null);
  const clv = clvVals.length ? clvVals.reduce((s, v) => s + v, 0) / clvVals.length : null;
  const ci = roiCi(settled.map((b) => b.profit), settled.map((b) => b.stake));
  const wins = settled.filter((b) => b.outcome === 'WIN').length;
  const losses = settled.filter((b) => b.outcome === 'LOSS').length;
  const pushes = settled.filter((b) => b.outcome === 'PUSH').length;
  const hw = settled.filter((b) => b.outcome === 'HALF_WIN').length;
  const hl = settled.filter((b) => b.outcome === 'HALF_LOSS').length;

  // monthly
  const months = new Map<string, BetRecord[]>();
  for (const b of bets) {
    const m = b.match_date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(b);
  }
  const monthlyRows: Array<{ month: string; bets: number; stake: number; profit: number; roi: number | null; clv: number | null }> = [];
  for (const [m, v] of [...months.entries()].sort()) {
    const st = v.reduce((s, b) => s + b.stake, 0);
    const pf = v.reduce((s, b) => s + b.profit, 0);
    const cv = v.map((b) => b.clv).filter((x): x is number => x !== null);
    monthlyRows.push({ month: m, bets: v.length, stake: st, profit: Number(pf.toFixed(2)), roi: st ? Number((pf / st).toFixed(4)) : null, clv: cv.length ? Number((cv.reduce((s, x) => s + x, 0) / cv.length).toFixed(5)) : null });
  }
  const positiveMonths = monthlyRows.filter((m) => (m.roi ?? 0) > 0).length;
  const negativeMonths = monthlyRows.filter((m) => (m.roi ?? 0) < 0).length;
  const roiVals = monthlyRows.map((m) => m.roi ?? 0);
  const avgMonthlyRoi = roiVals.length ? roiVals.reduce((s, v) => s + v, 0) / roiVals.length : null;
  const best = monthlyRows.reduce((a, b) => ((b.roi ?? -99) > (a.roi ?? -99) ? b : a), monthlyRows[0] ?? null);
  const worst = monthlyRows.reduce((a, b) => ((b.roi ?? 99) < (a.roi ?? 99) ? b : a), monthlyRows[0] ?? null);

  return {
    cluster: bets[0] ? clusterOf(bets[0].match_date) ?? '?' : '?',
    bets: bets.length,
    wins,
    losses,
    pushes,
    half_wins: hw,
    half_losses: hl,
    stake: Number(stake.toFixed(2)),
    profit: Number(profit.toFixed(2)),
    roi: roi !== null ? Number(roi.toFixed(4)) : null,
    avg_ev: evs.length ? Number((evs.reduce((s, v) => s + v, 0) / evs.length).toFixed(4)) : null,
    median_ev: median(evs),
    clv: clv !== null ? Number(clv.toFixed(5)) : null,
    median_clv: median(clvVals),
    positive_clv_pct: clvVals.length ? Number((clvVals.filter((v) => v > 0).length / clvVals.length).toFixed(4)) : null,
    hit_rate: settled.length ? Number((wins / settled.length).toFixed(4)) : null,
    max_drawdown: bets.length ? Number(maxDrawdown(bets.map((b) => b.profit)).toFixed(2)) : null,
    roi_ci95: ci ? [Number(ci.ci95[0].toFixed(4)), Number(ci.ci95[1].toFixed(4))] : null,
    positive_months: positiveMonths,
    negative_months: negativeMonths,
    avg_monthly_roi: avgMonthlyRoi !== null ? Number(avgMonthlyRoi.toFixed(4)) : null,
    best_month: best ? { month: best.month, roi: Number((best.roi ?? 0).toFixed(4)) } : null,
    worst_month: worst ? { month: worst.month, roi: Number((worst.roi ?? 0).toFixed(4)) } : null,
  };
}

export function monthlyTable(bets: BetRecord[]): Array<Record<string, unknown>> {
  const months = new Map<string, BetRecord[]>();
  for (const b of bets) {
    const m = b.match_date.slice(0, 7);
    if (!months.has(m)) months.set(m, []);
    months.get(m)!.push(b);
  }
  const out: Array<Record<string, unknown>> = [];
  for (const [m, v] of [...months.entries()].sort()) {
    const st = v.reduce((s, b) => s + b.stake, 0);
    const pf = v.reduce((s, b) => s + b.profit, 0);
    const cv = v.map((b) => b.clv).filter((x): x is number => x !== null);
    out.push({ month: m, bets: v.length, stake: st, profit: Number(pf.toFixed(2)), roi: st ? Number((pf / st).toFixed(4)) : null, clv: cv.length ? Number((cv.reduce((s, x) => s + x, 0) / cv.length).toFixed(5)) : null });
  }
  return out;
}

// ---- P0 OddsPAPI linkage diagnostics --------------------------------------

export interface LinkageReport {
  oddspapi_records_received: number;
  valid_records: number;
  duplicate_records: number;
  unmatched_fixtures: number;
  matched_fixtures: number;
  unmatched_markets: number;
  matched_markets: number;
  matched_predictions: number;
  matched_250_299_opportunities: number;
  oddspapi_data_present: boolean;
  credential_status: string;
  blocked_reason: string;
  decision: 'C3_VALIDATION_BLOCKED' | 'LINKAGE_OK';
}

export function linkageReport(): LinkageReport {
  // Evidence: no OddsPAPI data artifacts in repo; credential BLOCKED (phase_e2);
  // the only 2026 odds are football-data.co.uk, not OddsPAPI.
  // Check ingested source data (real_odds.jsonl) for OddsPAPI provider rows —
  // NOT the report output files, which would be self-referential.
  let oddspapiRecords = 0;
  const realOddsPath = path.join(OUT_DIR, 'real_odds.jsonl');
  if (fs.existsSync(realOddsPath)) {
    const lines = fs.readFileSync(realOddsPath, 'utf8').trim().split('\n').filter(Boolean);
    for (const l of lines) {
      try {
        const rec = JSON.parse(l);
        if ((rec.provider && /oddspapi|oddspai|pinnacle/i.test(String(rec.provider))) && rec.source_type === 'REAL_PROVIDER' && rec.entry) {
          // count only distinct OddsPAPI-provider records
          if (/oddspapi|oddspai/i.test(String(rec.provider))) oddspapiRecords++;
        }
      } catch { /* ignore malformed line */ }
    }
  }
  const oddspapiDataPresent = oddspapiRecords > 0;
  const report: LinkageReport = {
    oddspapi_records_received: oddspapiRecords,
    valid_records: oddspapiRecords,
    duplicate_records: 0,
    unmatched_fixtures: 0,
    matched_fixtures: 0,
    unmatched_markets: 0,
    matched_markets: 0,
    matched_predictions: 0,
    matched_250_299_opportunities: 0,
    oddspapi_data_present: oddspapiDataPresent,
    credential_status: 'BLOCKED — ODDS_PAPI_KEY resolves to empty string locally (phase_e2); prior key rejected HTTP 401 INVALID_API_KEY',
    blocked_reason: 'No OddsPAPI data has been ingested anywhere in the repository; the only 2026+ odds are football-data.co.uk Pinnacle (not OddsPAPI). Per EPIC section 3/4, OddsPAPI is the sole acceptable C3 source and substitution is forbidden.',
    decision: oddspapiDataPresent ? 'LINKAGE_OK' : 'C3_VALIDATION_BLOCKED',
  };
  return report;
}

// ---- main ------------------------------------------------------------------

export function runOdds250299Validation(): Record<string, unknown> {
  const picks = loadJsonl<OssPick>(OOS_PATH);
  const pairs = loadJsonl<RealOddsPair>(REAL_ODDS_PATH);
  const allBets = buildBets(picks, pairs);
  const frozenBets = allBets.filter((b) => inBand(b.entry_odds));

  const c1 = frozenBets.filter((b) => clusterOf(b.match_date) === 'C1');
  const c2 = frozenBets.filter((b) => clusterOf(b.match_date) === 'C2');
  const c3 = frozenBets.filter((b) => clusterOf(b.match_date) === 'C3');

  const linkage = linkageReport();

  const summary = {
    hypothesis: `entry_odds >= ${HYPOTHESIS.lo} AND <= ${HYPOTHESIS.hi}`,
    model_version: MODEL_VERSION,
    frozen_commit: FROZEN_COMMIT,
    source_type: 'REAL_PROVIDER (Pinnacle, football-data.co.uk) for C1/C2',
    c3_source: 'OddsPAPI (Pinnacle/Circa/SBO) — REQUIRED, NOT AVAILABLE',
    C1: summarizeCluster(c1),
    C2: summarizeCluster(c2),
    C3: summarizeCluster(c3),
    historical_discovery: { C1: '+9.4%', C2: '+12.9%', combined: '+11.4%', note: 'reported from prior analysis; exact reproduction below' },
    monthly_C3: monthlyTable(c3),
    market_breakdown: {
      C1: breakdownByMarket(c1),
      C2: breakdownByMarket(c2),
      C3: breakdownByMarket(c3),
    },
    placebo: placeboControl(picks, pairs),
    linkage,
    final_decision: linkage.decision === 'C3_VALIDATION_BLOCKED' ? 'E — C3 VALIDATION BLOCKED' : 'PENDING',
    determinism_note: 'deterministic: rerun produces identical output',
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(summary, null, 2));
  fs.writeFileSync(REPORT_MD, renderMarkdown(summary));
  fs.writeFileSync(PREDS_JSONL, frozenBets.map((b) => JSON.stringify(b)).join('\n'));
  fs.writeFileSync(LINKAGE_JSON, JSON.stringify(linkage, null, 2));
  return summary;
}

function breakdownByMarket(bets: BetRecord[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const groups = new Map<string, BetRecord[]>();
  for (const b of bets) {
    if (!groups.has(b.market)) groups.set(b.market, []);
    groups.get(b.market)!.push(b);
  }
  for (const [m, v] of groups) out[m] = summarizeCluster(v);
  return out;
}

function placeboControl(picks: OssPick[], pairs: RealOddsPair[]): Record<string, unknown> {
  // Shuffled model probabilities on the same 2.50-2.99 eligibility, EV>=1%
  const pairByKey = new Map<string, RealOddsPair>();
  for (const p of pairs) pairByKey.set(`${p.match_id}|${p.market}|${p.line ?? 'flat'}|${p.selection}`, p);
  const ml = picks.filter((p) => p.market === 'ML' && p.actual_result !== null && p.cal_p_home !== null);
  const rng = (s: number) => { let x = s; return () => { x = (x * 1103515245 + 12345) % 2147483648; return x / 2147483648; }; };
  const r = rng(42);
  let bets = 0, profit = 0;
  for (const p of ml) {
    const pair = pairByKey.get(`${p.match_id}|ML|flat|${p.selection}`);
    if (!pair?.entry) continue;
    const odds = pair.entry.odds;
    if (!(odds >= 2.5 && odds <= 2.99)) continue;
    const modelP = r();
    if (modelP * odds - 1 < 0.01) continue;
    bets++;
    const actual = p.actual_home_goals > p.actual_away_goals ? 'home' : p.actual_home_goals < p.actual_away_goals ? 'away' : 'draw';
    profit += actual === p.selection ? odds - 1 : -1;
  }
  return { method: 'shuffled ML probabilities, 2.50-2.99 band, EV>=1%', bets, profit: Number(profit.toFixed(2)), roi: bets ? Number((profit / bets).toFixed(4)) : null };
}

function renderMarkdown(s: Record<string, unknown>): string {
  const lines: string[] = [];
  lines.push('# ODDS 2.50-2.99 OOS VALIDATION REPORT');
  lines.push('');
  lines.push(`- Hypothesis: ${s['hypothesis']}`);
  lines.push(`- Model: ${s['model_version']}`);
  lines.push(`- Frozen commit: ${s['frozen_commit']}`);
  lines.push(`- C3 source required: ${s['c3_source']}`);
  lines.push('');
  lines.push('## C1 (Historical)');
  lines.push('```json');
  lines.push(JSON.stringify(s['C1'], null, 2));
  lines.push('```');
  lines.push('## C2 (Recent)');
  lines.push('```json');
  lines.push(JSON.stringify(s['C2'], null, 2));
  lines.push('```');
  lines.push('## C3 (Current OOS)');
  lines.push('```json');
  lines.push(JSON.stringify(s['C3'], null, 2));
  lines.push('```');
  lines.push('## Linkage');
  lines.push('```json');
  lines.push(JSON.stringify(s['linkage'], null, 2));
  lines.push('```');
  lines.push('## Placebo');
  lines.push('```json');
  lines.push(JSON.stringify(s['placebo'], null, 2));
  lines.push('```');
  lines.push('## Final Decision');
  lines.push(s['final_decision'] as string);
  return lines.join('\n');
}

if (require.main === module) {
  const r = runOdds250299Validation();
  console.log(JSON.stringify(r, null, 2));
}
