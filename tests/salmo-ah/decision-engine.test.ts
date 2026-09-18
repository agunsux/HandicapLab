import { describe, it, expect } from 'vitest';
import { AhDecisionEngine } from '../../src/lib/decision/ahDecisionEngine';

describe('Salmo Decision Engine — Transparent Classification Tests', () => {
  it('downgrades missing or invalid odds to GREY (INSUFFICIENT_DATA / ODDS DATA UNAVAILABLE)', () => {
    const res1 = AhDecisionEngine.evaluateDecision({
      marketLine: -0.5,
      marketOdds: null,
      modelProbability: 0.55,
      fairOdds: 1.82,
      expectedValue: 0.05,
    });

    expect(res1.badge).toBe('GREY');
    expect(res1.status).toBe('INSUFFICIENT_DATA');
    expect(res1.statusLabel).toBe('ODDS DATA UNAVAILABLE');
    expect(res1.confidence).toBe('NONE');
    expect(res1.productionReady).toBe(false);

    // Negative or <=1 odds also downgrade
    const res2 = AhDecisionEngine.evaluateDecision({
      marketLine: -0.5,
      marketOdds: 0.95,
      modelProbability: 0.55,
      fairOdds: 1.82,
      expectedValue: 0.05,
    });
    expect(res2.badge).toBe('GREY');
    expect(res2.status).toBe('INSUFFICIENT_DATA');
  });

  it('downgrades missing or invalid model probability to GREY (MODEL DATA INSUFFICIENT)', () => {
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: -0.5,
      marketOdds: 1.95,
      modelProbability: null,
      fairOdds: 1.82,
      expectedValue: 0.05,
    });

    expect(res.badge).toBe('GREY');
    expect(res.status).toBe('INSUFFICIENT_DATA');
    expect(res.statusLabel).toBe('MODEL DATA INSUFFICIENT');
  });

  it('strictly enforces the Research Firewall: candidate signals never trigger live GREEN', () => {
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: -0.75,
      marketOdds: 2.10,
      modelProbability: 0.60,
      fairOdds: 1.70,
      expectedValue: 0.12, // High apparent EV (+12%)
      sampleSize: 400,
      dataQuality: 'HIGH',
      isModelProductionApproved: false, // Firewalled
      researchFirewallActive: true,
    });

    // Must NOT be GREEN because model is unvalidated / firewalled
    expect(res.badge).toBe('GREY');
    expect(res.status).toBe('RESEARCH_ONLY');
    expect(res.statusLabel).toContain('RESEARCH ONLY');
    expect(res.productionReady).toBe(false);
    expect(res.drilldownExplanation.firewallNotice).toBeDefined();
  });

  it('labels firewalled negative-EV bets as RED (NO VALUE)', () => {
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: -0.5,
      marketOdds: 1.65,
      modelProbability: 0.52,
      fairOdds: 1.92,
      expectedValue: -0.14, // -14% EV
      sampleSize: 400,
      dataQuality: 'HIGH',
      isModelProductionApproved: false,
      researchFirewallActive: true,
    });

    expect(res.badge).toBe('RED');
    expect(res.status).toBe('NO_VALUE');
    expect(res.statusLabel).toContain('NO VALUE');
  });

  it('decouples probability from value: 80% win probability at 1.15 odds is RED (NO VALUE)', () => {
    // 80% probability at 1.15 odds has expected value: 0.8 * 0.15 - 0.2 = -0.08 (-8% EV)
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: -1.5,
      marketOdds: 1.15,
      modelProbability: 0.80,
      fairOdds: 1.25,
      expectedValue: -0.08,
      isModelProductionApproved: true,
      researchFirewallActive: false,
    });

    expect(res.badge).toBe('RED');
    expect(res.status).toBe('NO_VALUE');
    expect(res.expectedValuePct).toBe(-8.0);
  });

  it('correctly classifies MARGINAL value (YELLOW) for edge < 3% or low sample size', () => {
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: +0.25,
      marketOdds: 1.95,
      modelProbability: 0.52,
      fairOdds: 1.92,
      expectedValue: 0.015, // +1.5% edge
      sampleSize: 100,
      dataQuality: 'MEDIUM',
      isModelProductionApproved: true,
      researchFirewallActive: false,
    });

    expect(res.badge).toBe('YELLOW');
    expect(res.status).toBe('MARGINAL');
    expect(res.statusLabel).toBe('MARGINAL VALUE');
  });

  it('grants GREEN only when all production validation gates are fully satisfied', () => {
    const res = AhDecisionEngine.evaluateDecision({
      marketLine: -0.5,
      marketOdds: 2.05,
      modelProbability: 0.56,
      fairOdds: 1.78,
      expectedValue: 0.085, // +8.5% edge
      sampleSize: 350,
      dataQuality: 'HIGH',
      isModelProductionApproved: true,
      researchFirewallActive: false,
    });

    expect(res.badge).toBe('GREEN');
    expect(res.status).toBe('VALUE');
    expect(res.confidence).toBe('HIGH');
    expect(res.productionReady).toBe(true);
  });
});
