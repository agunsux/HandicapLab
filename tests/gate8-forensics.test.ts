import { describe, it, expect } from 'vitest';
import { EdgeForensicsEngine } from '@/historical/forensics/edgeForensicsEngine';

describe('GATE 8 — Edge Forensics & Model Repair Suite', () => {
  it('loads persisted out-of-sample picks correctly', () => {
    const picks = EdgeForensicsEngine.loadPersistedPicks();
    expect(picks.length).toBeGreaterThan(1000);
    expect(picks[0]).toHaveProperty('match_id');
    expect(picks[0]).toHaveProperty('market');
    expect(picks[0]).toHaveProperty('market_odds');
    expect(picks[0]).toHaveProperty('ev');
  });

  it('reproduces Gate 5-7 baseline metrics accurately', () => {
    const results = EdgeForensicsEngine.runForensics();
    const baseline = results.phase1_baseline_reproduction;

    expect(baseline.reproduced).toBe(true);
    expect(baseline.out_of_sample_matches).toBe(1520);
    expect(baseline.moneyline_log_loss).toBeCloseTo(1.02663, 3);
    expect(baseline.moneyline_brier).toBeCloseTo(0.61491, 3);
    expect(baseline.moneyline_ece).toBeCloseTo(0.01444, 3);
    expect(baseline.ev3_bets).toBe(2920);
    expect(baseline.ev3_roi).toBeCloseTo(-7.93, 1);
    expect(baseline.mean_clv).toBeCloseTo(1.52, 1);
  });

  it('computes multidimensional diagnostics across markets, EV buckets, and seasons', () => {
    const results = EdgeForensicsEngine.runForensics();
    const diag = results.phase2_diagnostics;

    expect(diag.by_market.length).toBe(4);
    expect(diag.by_market.map((m) => m.key)).toEqual(['ML', 'OU25', 'BTTS', 'AH']);

    expect(diag.by_ev_bucket.length).toBe(5);
    expect(diag.by_season.length).toBeGreaterThanOrEqual(4);
    expect(diag.by_competition.length).toBeGreaterThanOrEqual(1);
  });

  it('classifies false edges into defined diagnostic categories', () => {
    const results = EdgeForensicsEngine.runForensics();
    const falseEdges = results.phase3_false_edge_analysis;

    expect(falseEdges.total_ev_bets).toBe(2920);
    expect(falseEdges.total_losses).toBeGreaterThan(1000);
    expect(falseEdges.classifications.length).toBe(5);
    expect(falseEdges.classifications[0].cause).toContain('Longshot Variance');
  });

  it('produces rigorous market-by-market verdicts', () => {
    const results = EdgeForensicsEngine.runForensics();
    const verdicts = results.phase4_market_verdicts;

    expect(verdicts.length).toBe(4);
    const ml = verdicts.find((v) => v.market.includes('Moneyline'));
    const ah = verdicts.find((v) => v.market.includes('Asian Handicap'));
    const btts = verdicts.find((v) => v.market.includes('Both Teams'));

    expect(ml?.verdict).toBe('KEEP');
    expect(ah?.verdict).toBe('KEEP');
    expect(btts?.verdict).toBe('DEFER');
  });

  it('evaluates predefined EV thresholds grid monotonically', () => {
    const results = EdgeForensicsEngine.runForensics();
    const thresholds = results.phase5_threshold_analysis;

    expect(thresholds.length).toBe(7);
    // Number of bets should decrease as EV threshold increases
    for (let i = 1; i < thresholds.length; i++) {
      expect(thresholds[i].bets).toBeLessThanOrEqual(thresholds[i - 1].bets);
    }
  });

  it('recommends KEEP_BASELINE and rejects ad-hoc curve-fitting repairs', () => {
    const results = EdgeForensicsEngine.runForensics();
    const comp = results.phase6_7_model_comparison;

    expect(comp.recommendation).toBe('KEEP_BASELINE');
    expect(comp.models.some((m) => m.decision === 'BASELINE')).toBe(true);
    expect(comp.models.some((m) => m.decision === 'REJECTED')).toBe(true);
  });

  it('disambiguates bet independence vs observation multiplicity', () => {
    const results = EdgeForensicsEngine.runForensics();
    const ind = results.phase9_independence_check;

    expect(ind.fixture_count).toBe(1520);
    expect(ind.observation_count).toBe(10630);
    expect(ind.executable_bets_ev3).toBe(2920);
    expect(ind.observation_to_fixture_ratio).toBeGreaterThan(1.0);
  });

  it('asserts final scientific verdict is strictly classified as unproven strategy', () => {
    const results = EdgeForensicsEngine.runForensics();
    const verdict = results.phase10_final_verdict;

    expect(verdict.state).toBe('EDGE_PROMISING_BUT_UNPROVEN');
    expect(verdict.verdict_code).toBe('MODEL_VALIDATED / STRATEGY_NOT_YET_VALIDATED');
  });
});
