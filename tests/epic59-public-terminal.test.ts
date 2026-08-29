import { describe, test, expect } from 'vitest';
import { computeActualSampleSize } from '../src/lib/research/ah-solo/ahValueEngine';
import { DailyAhShadowPipeline, RESEARCH_HONESTY_BANNER } from '../src/lib/pipeline/dailyAhShadowPipeline';
import { SEEDED_MODELS } from '../src/lib/terminalData';

describe('EPIC 59: Public Terminal', () => {
  test('model_versions frozen_parameters immutable specification', () => {
    for (const model of SEEDED_MODELS) {
      expect(model.frozen_parameters).toBeDefined();
      expect(typeof model.frozen_parameters).toBe('object');
      expect(model.frozen_parameters.rho).toBe(-0.05);
      expect(model.frozen_parameters.decay_xi).toBe(0.0019);
      expect(model.validation_state).toBe('RESEARCH_ONLY');
    }
  });

  test('all seeded model versions have complete backtest attributes', () => {
    expect(SEEDED_MODELS.length).toBe(4);
    for (const model of SEEDED_MODELS) {
      expect(model.id).toMatch(/^AH-dixoncoles/);
      expect(model.backtest_status).toBe('COMPLETE');
      expect(model.backtest_realized_roi).toBeLessThan(0); // Honest negative backtest ROI
      expect(model.backtest_n_bets).toBeGreaterThan(5000);
      expect(model.backtest_clv_pvalue).toBeGreaterThan(0.05); // Not statistically significant
    }
  });

  test('no QUALIFIED_VALUE in any generated or loaded record', () => {
    const ledger = DailyAhShadowPipeline.loadLedger();
    for (const record of ledger) {
      expect(record.valueQualificationState).not.toBe('QUALIFIED_VALUE');
      expect(['NOT_VALIDATED', 'LOW_CONFIDENCE_EDGE', 'NO_EDGE', 'INSUFFICIENT_DATA']).toContain(
        record.valueQualificationState
      );
    }
  });

  test('research banner is non-promotional and transparent', () => {
    expect(RESEARCH_HONESTY_BANNER).toContain('NOT YET VALIDATED');
    expect(RESEARCH_HONESTY_BANNER).toContain('-2.30%');
    expect(RESEARCH_HONESTY_BANNER).toContain('p=0.601');
  });

  test('sample size is not hardcoded 500 and dynamically computed', () => {
    const dataset = [
      ...Array(250).fill({ line: -0.5, leagueId: 'ENG-PL' }),
      ...Array(40).fill({ line: -1.75, leagueId: 'ENG-PL' }),
    ];

    const countHalf = computeActualSampleSize(-0.5, 'ENG-PL', dataset);
    const countRare = computeActualSampleSize(-1.75, 'ENG-PL', dataset);

    expect(countHalf).toBe(250);
    expect(countRare).toBe(40);
    expect(countHalf).not.toBe(countRare);
    expect(countHalf).not.toBe(500);
  });

  test('summary progress correctly tracks 175 validation gate', () => {
    const summary = DailyAhShadowPipeline.generatePipelineSummary();
    expect(summary.targetSettledGate).toBe(175);
    expect(summary.monetizationEnabled).toBe(false);
    expect(summary.mode).toBe('SHADOW_UNATTENDED');
    expect(summary.gateProgressPct).toBeGreaterThanOrEqual(0);
    expect(summary.gateProgressPct).toBeLessThanOrEqual(100);
  });
});
