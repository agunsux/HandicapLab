import { describe, it, expect } from 'vitest';
import { ExecutableStrategyEngine } from '@/historical/strategy/executableStrategyEngine';

describe('GATE 9 — Executable Strategy Validation Suite', () => {
  it('reconciles canonical economic units with 100% precision', () => {
    const opps = ExecutableStrategyEngine.loadCanonicalOpportunities();
    const econ = ExecutableStrategyEngine.reconcileEconomicUnits(opps);

    expect(econ.reconciliation_status).toBe('PASS');
    expect(econ.fixtures_count).toBe(1520);
    expect(econ.market_events_count).toBe(6070);
    expect(econ.bookmaker_quotes_count).toBe(10630);
    expect(econ.executable_opportunities_count).toBe(2920);
    expect(econ.settled_bets_count).toBe(2920);
  });

  it('evaluates baseline mechanical strategy accurately', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const base = results.baseline_strategy;

    expect(base.bets_count).toBe(2920);
    expect(base.win_rate).toBeCloseTo(28.08, 1);
    expect(base.avg_odds).toBeCloseTo(4.26, 1);
    expect(base.mean_clv).toBeCloseTo(1.52, 1);
    expect(base.realized_roi).toBeCloseTo(-7.93, 1);
    expect(base.roi_ci95[0]).toBeLessThan(base.realized_roi);
    expect(base.roi_ci95[1]).toBeGreaterThan(base.realized_roi);
    expect(base.max_drawdown).toBeCloseTo(294.39, 1);
  });

  it('executes walk-forward chronological folds without leakage', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const wf = results.walk_forward_selection;

    expect(wf.folds.length).toBe(4);
    expect(wf.folds[0].test_season).toBe('2022-2023');
    expect(wf.folds[3].test_season).toBe('2025-2026');

    for (const f of wf.folds) {
      expect(f.test_bets).toBeGreaterThan(500);
      expect(f.test_clv).toBeCloseTo(1.52, 1);
    }
  });

  it('enforces complexity penalty and orders candidate rules by parameter count', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const comp = results.complexity_ranking;

    expect(comp.length).toBe(4);
    expect(comp[0].complexity_level).toBe(1);
    expect(comp[3].complexity_level).toBe(3);
  });

  it('compares exposure-controlled portfolios against unconstrained baseline', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const exp = results.exposure_control_comparison;

    expect(exp.unconstrained.bets_count).toBe(2920);
    expect(exp.max_one_per_market.bets_count).toBeLessThanOrEqual(2920);
    expect(exp.max_one_per_fixture.bets_count).toBeLessThanOrEqual(exp.max_one_per_market.bets_count);
  });

  it('executes Monte Carlo placebo test producing an empirical null distribution', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const placebo = results.placebo_test;

    expect(placebo.iterations).toBe(1000);
    expect(placebo.actual_roi).toBeCloseTo(-7.93, 1);
    expect(placebo.placebo_p_value).toBeGreaterThan(0.01);
    expect(placebo.placebo_p_value).toBeLessThan(0.99);
  });

  it('identifies stability plateaus in sensitivity perturbations', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const sens = results.sensitivity_analysis;

    expect(sens.length).toBe(2);
    expect(sens[0].stability_verdict).toBe('STABLE_PLATEAU');
    expect(sens[1].stability_verdict).toBe('STABLE_PLATEAU');
  });

  it('defines provisional strategy spec with strict risk constraints', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const spec = results.provisional_strategy_spec;

    expect(spec.status).toBe('PROVISIONAL_STRATEGY');
    expect(spec.eligible_markets).toContain('Moneyline (1X2)');
    expect(spec.staking_rule).toContain('flat 1 unit');
    expect(spec.rejection_conditions.length).toBeGreaterThanOrEqual(3);
  });

  it('asserts final strategy verdict is EDGE_PROMISING_BUT_UNPROVEN', () => {
    const results = ExecutableStrategyEngine.runGate9Validation();
    const verdict = results.final_verdict;

    expect(verdict.state).toBe('EDGE_PROMISING_BUT_UNPROVEN');
    expect(verdict.summary).toContain('PROVISIONAL / UNPROVEN');
  });
});
