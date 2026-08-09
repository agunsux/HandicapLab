import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { evaluateEligibility, VALID_MODEL_VERSIONS, type EligibilityInput } from '../../src/historical/engine/eligibility';
import { gradeOpportunity, oddsMargin1x2, oddsMarginBinary, rankOpportunity } from '../../src/historical/engine/ranking';
import { settleAsianHandicap, settleAsianTotal, settleBtts, settleMoneyline } from '../../src/historical/settlement/settlement';

const OUT_DIR = path.resolve(process.cwd(), 'data', 'historical');

function baseInput(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    market: 'ML',
    hasCoreFeatures: true,
    hasOdds: true,
    probability: 0.55,
    predictionTimestamp: '2025-05-10T00:00:00Z',
    kickoff: '2025-05-10T00:00:00Z',
    modelVersion: 'poisson-historical-v1-cal',
    marketCalibrationAdequate: true,
    ...overrides,
  };
}

describe('eligibility gates', () => {
  it('passes when all evidence exists', () => {
    const v = evaluateEligibility(baseInput());
    expect(v.eligible).toBe(true);
    expect(v.reasons).toHaveLength(0);
  });

  it('NO BET on missing core features', () => {
    const v = evaluateEligibility(baseInput({ hasCoreFeatures: false }));
    expect(v.eligible).toBe(false);
    expect(v.reasons).toContain('missing_core_features');
  });

  it('NO BET on missing odds for betting markets', () => {
    const v = evaluateEligibility(baseInput({ hasOdds: false }));
    expect(v.eligible).toBe(false);
    expect(v.reasons).toContain('missing_odds');
  });

  it('NO BET on invalid probability (null, <=5%, >=95%)', () => {
    expect(evaluateEligibility(baseInput({ probability: null })).reasons).toContain('invalid_probability');
    expect(evaluateEligibility(baseInput({ probability: 0.03 })).reasons).toContain('invalid_probability');
    expect(evaluateEligibility(baseInput({ probability: 0.98 })).reasons).toContain('invalid_probability');
  });

  it('NO BET when prediction strictly after kickoff', () => {
    const v = evaluateEligibility(baseInput({ predictionTimestamp: '2025-05-10T16:00:00Z' }));
    expect(v.reasons).toContain('prediction_not_before_kickoff');
  });

  it('boundary equality (kickoff time unknown) is allowed', () => {
    const v = evaluateEligibility(baseInput());
    expect(v.reasons).not.toContain('prediction_not_before_kickoff');
  });

  it('NO BET on invalid model version', () => {
    const v = evaluateEligibility(baseInput({ modelVersion: 'prematch-v1' }));
    expect(v.reasons).toContain('invalid_model_version');
    expect(VALID_MODEL_VERSIONS).toContain('poisson-historical-v1-cal');
  });

  it('NO BET when calibration inadequate', () => {
    const v = evaluateEligibility(baseInput({ marketCalibrationAdequate: false }));
    expect(v.reasons).toContain('calibration_inadequate');
  });
});

describe('ranking', () => {
  it('grade A: low ECE, full features, low margin, positive EV', () => {
    expect(gradeOpportunity({ evCalibrated: 0.08, marketEceAfter: 0.05, featureCompleteness: 'FULL', oddsMargin: 0.03 })).toBe('A');
  });
  it('grade B: medium ECE', () => {
    expect(gradeOpportunity({ evCalibrated: 0.08, marketEceAfter: 0.15, featureCompleteness: 'FULL', oddsMargin: 0.03 })).toBe('B');
  });
  it('grade C: high ECE or partial features', () => {
    expect(gradeOpportunity({ evCalibrated: 0.08, marketEceAfter: 0.25, featureCompleteness: 'FULL', oddsMargin: 0.03 })).toBe('C');
    expect(gradeOpportunity({ evCalibrated: 0.08, marketEceAfter: 0.05, featureCompleteness: 'PARTIAL', oddsMargin: 0.03 })).toBe('C');
  });
  it('grade NONE for non-positive or missing EV', () => {
    expect(gradeOpportunity({ evCalibrated: 0, marketEceAfter: 0.05, featureCompleteness: 'FULL', oddsMargin: 0.03 })).toBe('NONE');
    expect(gradeOpportunity({ evCalibrated: null, marketEceAfter: 0.05, featureCompleteness: 'FULL', oddsMargin: 0.03 })).toBe('NONE');
  });
  it('score penalizes high ECE and fat margins', () => {
    const clean = rankOpportunity({ evCalibrated: 0.10, marketEceAfter: 0.05, featureCompleteness: 'FULL', oddsMargin: 0.03 });
    const poor = rankOpportunity({ evCalibrated: 0.10, marketEceAfter: 0.30, featureCompleteness: 'FULL', oddsMargin: 0.12 });
    expect(poor.score!).toBeLessThan(clean.score!);
  });
  it('odds margin math', () => {
    expect(oddsMargin1x2(2.0, 3.4, 3.5)).toBeCloseTo(1 / 2 + 1 / 3.4 + 1 / 3.5 - 1, 6);
    expect(oddsMarginBinary(1.9, 1.9)).toBeCloseTo(1 / 1.9 + 1 / 1.9 - 1, 6);
  });
});

describe('engine consistency with settlement module (walk-forward picks)', () => {
  const picks = fs.readFileSync(path.join(OUT_DIR, 'out_of_sample_predictions.jsonl'), 'utf8')
    .trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) as Array<{
      match_id: string; market: 'ML' | 'OU25' | 'BTTS' | 'AH'; selection: string;
      outcome: 'WIN' | 'LOSS' | 'PUSH' | null; actual_home_goals: number; actual_away_goals: number;
    }>;

  it('every settled pick outcome matches the canonical settlement engine', () => {
    let mismatches = 0;
    for (const p of picks) {
      if (p.outcome === null) continue;
      let expected: 'WIN' | 'LOSS';
      if (p.market === 'ML') {
        expected = settleMoneyline(p.selection as 'home' | 'draw' | 'away', p.actual_home_goals, p.actual_away_goals) === 'WIN' ? 'WIN' : 'LOSS';
      } else if (p.market === 'OU25') {
        expected = settleAsianTotal(p.selection as 'over' | 'under', 2.5, p.actual_home_goals + p.actual_away_goals) === 'WIN' ? 'WIN' : 'LOSS';
      } else if (p.market === 'BTTS') {
        expected = settleBtts('yes', p.actual_home_goals, p.actual_away_goals) === 'WIN' ? 'WIN' : 'LOSS';
      } else {
        expected = settleAsianHandicap('home', -0.5, p.actual_home_goals, p.actual_away_goals) === 'WIN' ? 'WIN' : 'LOSS';
      }
      if (p.outcome !== expected) mismatches += 1;
    }
    expect(mismatches).toBe(0);
  });
});
