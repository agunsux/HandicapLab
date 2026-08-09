import * as fs from 'fs';
import * as path from 'path';
import { evaluateEligibility, type EligibilityInput, type EligibilityReason } from './eligibility';
import { oddsMargin1x2, oddsMarginBinary, rankOpportunity, type OpportunityGrade } from './ranking';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');

interface PickRow {
  match_id: string;
  season: string;
  match_date: string;
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  selection: string;
  model_probability: number;
  cal_probability: number | null;
  p_home: number | null;
  p_draw: number | null;
  p_away: number | null;
  market_odds: number | null;
  ev_calibrated: number | null;
  model_version: string;
  feature_version: string;
  outcome: 'WIN' | 'LOSS' | 'PUSH' | null;
  profit: number | null;
  eligible: boolean;
  ineligibility_reason?: string;
}

interface CalFold {
  test_season: string;
  T_ml_at_boundary: boolean;
  T_ou25_at_boundary: boolean;
  T_btts_at_boundary: boolean;
  T_ah_at_boundary: boolean;
}

interface RankedRow {
  match_date: string;
  market: string;
  selection: string;
  probability: number;
  ev_calibrated: number | null;
  score: number | null;
  grade: OpportunityGrade;
  eligibility: { eligible: boolean; reasons: EligibilityReason[] };
}

function loadJsonl<T>(fullPath: string): T[] {
  return fs.readFileSync(fullPath, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
}

function main(): void {
  const picks = loadJsonl<PickRow>(path.join(OUT_DIR, 'out_of_sample_predictions.jsonl'));
  const report = JSON.parse(fs.readFileSync(path.join(OUT_DIR, 'walkforward_report.json'), 'utf8')) as {
    calibration_folds: CalFold[];
    calibration: {
      after: { ML: { ece: number; brier: { brier: number } | null }; OU25: { ece: number }; BTTS: { ece: number }; AH: { ece: number } };
    };
    markets: Record<string, unknown>;
  };

  const anyBoundary = (market: 'ML' | 'OU25' | 'BTTS' | 'AH') => {
    const key = market === 'ML' ? 'T_ml_at_boundary' : market === 'OU25' ? 'T_ou25_at_boundary' : market === 'BTTS' ? 'T_btts_at_boundary' : 'T_ah_at_boundary';
    return report.calibration_folds.some((f) => f[key as keyof CalFold] === true);
  };
  const eceAfter = { ML: report.calibration.after.ML.ece, OU25: report.calibration.after.OU25.ece, BTTS: report.calibration.after.BTTS.ece, AH: report.calibration.after.AH.ece };
  const mlBrierAfter = report.calibration.after.ML.brier?.brier ?? 0.667;
  const calibrationAdequate = (market: 'ML' | 'OU25' | 'BTTS' | 'AH') => {
    if (anyBoundary(market)) return false;
    if (eceAfter[market] > 0.15) return false;
    if (market === 'ML' && mlBrierAfter >= 0.60) return false;
    return true;
  };

  const marginByMatch = new Map<string, { ml: number | null; ou: number | null }>();
  const oddsRows = loadJsonl<{ match_id: string; market_1x2: { home: number; draw: number; away: number } | null; market_ou25: { over: number; under: number } | null }>(path.join(OUT_DIR, 'historical_odds.jsonl'));  for (const o of oddsRows) {
    marginByMatch.set(o.match_id, {
      ml: o.market_1x2 ? oddsMargin1x2(o.market_1x2.home, o.market_1x2.draw, o.market_1x2.away) : null,
      ou: o.market_ou25 ? oddsMarginBinary(o.market_ou25.over, o.market_ou25.under) : null,
    });
  }

  const ranked: RankedRow[] = [];
  const reasonHistogram: Record<string, number> = {};
  const eligibleByDay: Record<string, RankedRow[]> = {};

  for (const p of picks) {
    if (p.market === 'BTTS' || p.market === 'AH') continue;
    const market = p.market as 'ML' | 'OU25';
    const margin = marginByMatch.get(p.match_id);
    const verdict = evaluateEligibility({
      market,
      hasCoreFeatures: !p.ineligibility_reason || p.ineligibility_reason !== 'missing_core_features',
      hasOdds: p.market_odds !== null,
      probability: p.cal_probability ?? p.model_probability,
      predictionTimestamp: `${p.match_date}T00:00:00Z`,
      kickoff: `${p.match_date}T00:00:00Z`,
      modelVersion: p.model_version,
      marketCalibrationAdequate: calibrationAdequate(market),
    });
    for (const r of verdict.reasons) reasonHistogram[r] = (reasonHistogram[r] || 0) + 1;

    const rankedRow: RankedRow = {
      match_date: p.match_date,
      market,
      selection: p.selection,
      probability: p.cal_probability ?? p.model_probability,
      ev_calibrated: p.ev_calibrated,
      score: null,
      grade: 'NONE',
      eligibility: verdict,
    };

    if (verdict.eligible && p.ev_calibrated !== null) {
      const rank = rankOpportunity({
        evCalibrated: p.ev_calibrated,
        marketEceAfter: eceAfter[market],
        featureCompleteness: 'FULL',
        oddsMargin: market === 'ML' ? margin?.ml ?? null : margin?.ou ?? null,
      });
      rankedRow.score = rank.score;
      rankedRow.grade = rank.grade;
      eligibleByDay[p.match_date] = eligibleByDay[p.match_date] || [];
      eligibleByDay[p.match_date].push(rankedRow);
    }
    ranked.push(rankedRow);
  }

  const top3ByDay: Record<string, RankedRow[]> = {};
  for (const [day, rows] of Object.entries(eligibleByDay)) {
    top3ByDay[day] = rows
      .filter((r) => r.grade !== 'NONE' && r.score !== null)
      .sort((a, b) => (b.score ?? -Infinity) - (a.score ?? -Infinity))
      .slice(0, 3);
  }

  const summary = {
    total_candidates: picks.filter((p) => p.market === 'ML' || p.market === 'OU25').length,
    eligible: ranked.filter((r) => r.eligibility.eligible).length,
    no_bet: ranked.filter((r) => !r.eligibility.eligible).length,
    reason_histogram: reasonHistogram,
    calibration_adequate: { ML: calibrationAdequate('ML'), OU25: calibrationAdequate('OU25'), BTTS: calibrationAdequate('BTTS'), AH: calibrationAdequate('AH') },
    calibration_gates: { ml_brier_after: mlBrierAfter, ece_after: eceAfter, any_boundary: { ML: anyBoundary('ML'), OU25: anyBoundary('OU25'), BTTS: anyBoundary('BTTS'), AH: anyBoundary('AH') } },
    days_with_qualified_opportunities: Object.keys(top3ByDay).length,
    top3_example_days: Object.fromEntries(Object.entries(top3ByDay).slice(0, 3)),
    statement: Object.keys(top3ByDay).length === 0
      ? 'NO qualifying opportunities: current model calibration is inadequate (temperature at grid boundary) — correct NO BET behavior'
      : 'opportunities exist; free tier shows top 3 per day, pro shows full ranked universe',
  };

  fs.writeFileSync(path.join(OUT_DIR, 'ranked_opportunities.jsonl'), ranked.map((r) => JSON.stringify(r)).join('\n'));
  fs.writeFileSync(path.join(OUT_DIR, 'eligibility_summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main();
