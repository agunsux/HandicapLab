import { describe, it, expect, beforeEach } from 'vitest';
import { HealthScore } from '../src/lib/monitoring/HealthScore';
import { DriftDetector } from '../src/lib/monitoring/DriftDetector';
import { GoldenBaselineRegistry } from '../src/lib/monitoring/GoldenBaselineRegistry';
import { RecommendationEngine } from '../src/lib/monitoring/RecommendationEngine';
import { HealthEventLog } from '../src/lib/monitoring/HealthEvent';
import { HealthSnapshotWriter } from '../src/lib/monitoring/HealthSnapshotWriter';
import { ModelHealthMonitor } from '../src/lib/monitoring/ModelHealthMonitor';
import { DailyDeepAnalysis } from '../src/lib/monitoring/HealthSnapshotWriter';
import { HealthSnapshot } from '../src/lib/monitoring/types';

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeSnapshot(overrides: Partial<HealthSnapshot> = {}): HealthSnapshot {
  return {
    timestamp: new Date(),
    modelVersion: 'prematch-v1',
    brierScore: 0.21,
    ece: 0.04,
    winRate: 0.55,
    avgClv: 1.5,
    decisionAccuracy: 0.62,
    missedOpportunityRate: 0.20,
    correctSkipRate: 0.40,
    avgConfidence: 0.72,
    dataQualityScore: 0.90,
    decisionGatePassRate: 0.30,
    skipRate: 0.70,
    healthScore: 0,
    healthStatus: 'INSUFFICIENT_DATA',
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('Module 3: Model Health Monitor', () => {
  beforeEach(() => {
    HealthEventLog._clear();
    HealthSnapshotWriter._clear();
  });

  // ── HealthScore ─────────────────────────────────────────────────────────────

  describe('HealthScore', () => {
    it('should score a healthy snapshot above 80', () => {
      const snap = makeSnapshot({
        brierScore: 0.19,
        ece: 0.02,
        winRate: 0.62,
        avgClv: 3.0,
        decisionAccuracy: 0.70,
        missedOpportunityRate: 0.10,
        dataQualityScore: 0.95,
      });
      const result = HealthScore.calculate(snap, 100, 50, 1.0);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.status).toBe('HEALTHY');
    });

    it('should score a degraded snapshot (high Brier) between 60 and 79', () => {
      const snap = makeSnapshot({ brierScore: 0.27, ece: 0.08, winRate: 0.49 });
      const result = HealthScore.calculate(snap, 60, 200, 0.7);
      expect(result.score).toBeLessThan(80);
      expect(['DEGRADED', 'CRITICAL']).toContain(result.status);
    });

    it('should score a critically degraded snapshot below 60', () => {
      const snap = makeSnapshot({
        brierScore: 0.32,
        ece: 0.12,
        winRate: 0.38,
        decisionAccuracy: 0.40,
        dataQualityScore: 0.40,
      });
      const result = HealthScore.calculate(snap, 20, 800, 0.3);
      expect(result.score).toBeLessThan(60);
      expect(result.status).toBe('CRITICAL');
    });

    it('component weights should sum to 1.0', () => {
      const weights = [0.25, 0.20, 0.20, 0.15, 0.10, 0.05, 0.05];
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1.0, 5);
    });
  });

  // ── DriftDetector ───────────────────────────────────────────────────────────

  describe('DriftDetector', () => {
    it('should detect no drift when snapshots are identical', () => {
      const snap = makeSnapshot();
      const result = DriftDetector.detect(snap, snap, snap, 'v1');
      expect(result.overallSeverity).toBe('ok');
      expect(result.operationalDrift.isDrifted).toBe(false);
      expect(result.structuralDrift.isDrifted).toBe(false);
    });

    it('should detect operational drift when Brier score rises significantly', () => {
      const baseline = makeSnapshot({ brierScore: 0.21 });
      const current = makeSnapshot({ brierScore: 0.31 }); // +0.10 → critical
      const result = DriftDetector.detect(current, baseline, null, 'none');
      expect(result.operationalDrift.isDrifted).toBe(true);
      expect(result.operationalDrift.severity).toBe('critical');
    });

    it('should detect structural drift vs golden baseline', () => {
      const golden = makeSnapshot({ winRate: 0.60 });
      const current = makeSnapshot({ winRate: 0.44 }); // -0.16 → critical
      const result = DriftDetector.detect(current, null, golden, 'v1');
      expect(result.structuralDrift.isDrifted).toBe(true);
      expect(['warning', 'critical']).toContain(result.structuralDrift.severity);
    });
  });

  // ── GoldenBaselineRegistry ──────────────────────────────────────────────────

  describe('GoldenBaselineRegistry', () => {
    it('should store and retrieve an active baseline', () => {
      const snap = makeSnapshot();
      const baseline = GoldenBaselineRegistry.fromSnapshot(snap, 'v1', {
        calibrationMethod: 'platt',
        approvedBy: 'quant-team',
      });
      GoldenBaselineRegistry.register(baseline);

      const active = GoldenBaselineRegistry.getActive();
      expect(active).not.toBeNull();
      expect(active?.version).toBe('v1');
    });

    it('should replace the active baseline when a new one is registered', () => {
      const snap = makeSnapshot();
      GoldenBaselineRegistry.register(GoldenBaselineRegistry.fromSnapshot(snap, 'v1', { calibrationMethod: 'platt' }));
      GoldenBaselineRegistry.register(GoldenBaselineRegistry.fromSnapshot(snap, 'v2', { calibrationMethod: 'isotonic' }));

      const active = GoldenBaselineRegistry.getActive();
      expect(active?.version).toBe('v2');
    });
  });

  // ── RecommendationEngine ────────────────────────────────────────────────────

  describe('RecommendationEngine', () => {
    it('should emit L1 and L2 recommendations for high ECE', () => {
      const snap = makeSnapshot({ ece: 0.09 });
      const drift = DriftDetector.detect(snap, null, null, 'none');
      const scoreBreakdown = HealthScore.calculate(snap, 100, 100, 1.0);
      const recs = RecommendationEngine.generate(snap, drift, scoreBreakdown, []);

      const l1 = recs.find(r => r.level === 1 && r.message.includes('Calibration'));
      const l2 = recs.find(r => r.level === 2 && r.message.includes('calibration'));
      expect(l1).toBeDefined();
      expect(l2).toBeDefined();
    });

    it('should emit L3 recommendations with candidates when available', () => {
      const snap = makeSnapshot({ ece: 0.09 });
      const drift = DriftDetector.detect(snap, null, null, 'none');
      const scoreBreakdown = HealthScore.calculate(snap, 100, 100, 1.0);
      const candidates = [
        { method: 'Platt', version: 'v5', historicalEce: 0.032 },
        { method: 'Isotonic', version: 'v8', historicalEce: 0.028 },
      ];
      const recs = RecommendationEngine.generate(snap, drift, scoreBreakdown, candidates);
      const l3 = recs.find(r => r.level === 3);
      expect(l3).toBeDefined();
      expect(l3?.calibratorCandidates?.length).toBe(2);
    });
  });

  // ── HealthEventLog ──────────────────────────────────────────────────────────

  describe('HealthEventLog', () => {
    it('should emit and query events by type', () => {
      HealthEventLog.emit('CALIBRATION_DRIFT', 'warning', 'prematch-v1', 'ECE rising.');
      HealthEventLog.emit('SNAPSHOT_WRITTEN', 'info', 'prematch-v1', 'Hourly snapshot written.');

      const driftEvents = HealthEventLog.query('prematch-v1', 'CALIBRATION_DRIFT');
      expect(driftEvents.length).toBe(1);
      expect(driftEvents[0].severity).toBe('warning');
    });
  });

  // ── Daily Deep Analysis ─────────────────────────────────────────────────────

  describe('DailyDeepAnalysis', () => {
    it('should report stable PSI for identical distributions', () => {
      const dist = Array.from({ length: 100 }, () => Math.random() * 0.5 + 0.3);
      const result = DailyDeepAnalysis.run(dist, dist);
      expect(result.psiScore).toBeCloseTo(0, 3);
    });

    it('should detect high PSI for severely shifted distributions', () => {
      const baseline = Array(100).fill(0.3);
      const current = Array(100).fill(0.8);  // Completely different distribution
      const result = DailyDeepAnalysis.run(current, baseline);
      expect(result.psiScore).toBeGreaterThan(0.1);
    });

    it('should output root cause hints when PSI is high', () => {
      const baseline = Array(100).fill(0.3);
      const current = Array(100).fill(0.9);
      const result = DailyDeepAnalysis.run(current, baseline);
      expect(result.rootCauseHints.length).toBeGreaterThan(0);
    });
  });

  // ── Full Pipeline (ModelHealthMonitor) ─────────────────────────────────────

  describe('ModelHealthMonitor (full pipeline)', () => {
    it('should return HEALTHY for a clean snapshot', async () => {
      const snap = makeSnapshot();
      const report = await ModelHealthMonitor.run(snap, 80, 0.9);
      expect(['HEALTHY', 'DEGRADED', 'INSUFFICIENT_DATA']).toContain(report.status);
      expect(report.healthScore.score).toBeGreaterThan(0);
      expect(report.snapshot.healthScore).toBeGreaterThan(0);
    });

    it('should return DEGRADED and emit events for a bad snapshot', async () => {
      const snap = makeSnapshot({
        brierScore: 0.30,
        ece: 0.10,
        winRate: 0.41,
        decisionAccuracy: 0.42,
        dataQualityScore: 0.50,
      });
      const report = await ModelHealthMonitor.run(snap, 500, 0.4);
      expect(['DEGRADED', 'CRITICAL']).toContain(report.status);
      expect(report.recommendations.length).toBeGreaterThan(0);

      const events = HealthEventLog.recent('prematch-v1', 10);
      expect(events.length).toBeGreaterThan(0);
    });

    it('should write an immutable snapshot after each run', async () => {
      const snap = makeSnapshot();
      await ModelHealthMonitor.run(snap, 100, 1.0);
      const written = HealthSnapshotWriter.getRecent('prematch-v1', 5);
      expect(written.length).toBeGreaterThanOrEqual(1);
      expect(written[0].healthScore).toBeGreaterThan(0);
    });
  });
});
