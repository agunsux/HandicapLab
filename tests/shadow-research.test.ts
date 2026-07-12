/**
 * EPIC 21 — Live Shadow Research Platform Tests
 */

import { describe, it, expect } from 'vitest';
import { SHADOW_PLATFORM_VERSION } from '../src/lib/shadow/types';
import { FixtureQueue } from '../src/lib/shadow/fixtureQueue';
import { ShadowPredictionSnapshot } from '../src/lib/shadow/predictionSnapshot';
import { OddsTimelineTracker } from '../src/lib/shadow/oddsTimeline';
import { MarketMonitor } from '../src/lib/shadow/marketMonitor';
import { ResultCollector } from '../src/lib/shadow/resultCollector';
import { LiveEvaluator } from '../src/lib/shadow/liveEvaluator';
import { ResearchLedger } from '../src/lib/shadow/researchLedger';
import { ShadowDashboardEngine } from '../src/lib/shadow/dashboardEngine';
import { ShadowDriftDetector } from '../src/lib/shadow/driftDetector';
import { ShadowChampionValidator } from '../src/lib/shadow/championValidator';
import { ShadowReportGenerator } from '../src/lib/shadow/reporting';
import { ShadowArtifactIntegration } from '../src/lib/shadow/artifactIntegration';

describe('Constants', () => {
  it('exports correct version', () => {
    expect(SHADOW_PLATFORM_VERSION).toBe('1.0.0');
  });
});

describe('21.1 — FixtureQueue', () => {
  it('adds fixtures with lifecycle', () => {
    const q = new FixtureQueue();
    const f = q.add({ externalId: 'e1', homeTeam: 'Team A', awayTeam: 'Team B', competition: 'EPL', season: '2024-2025', kickoff: '2026-07-12T12:00:00Z', provider: 'football-data' });
    expect(f.fixtureId).toMatch(/^shfix_\d{6}$/);
    expect(f.status).toBe('scheduled');
    const locked = q.updateStatus(f.fixtureId, 'locked');
    expect(locked.status).toBe('locked');
    const pred = q.updateStatus(f.fixtureId, 'prediction_generated');
    expect(pred.status).toBe('prediction_generated');
    expect(q.getByStatus('scheduled').length).toBe(0);
    expect(q.getState().lockedCount).toBe(0);
  });

  it('throws on unknown fixture', () => {
    const q = new FixtureQueue();
    expect(() => q.updateStatus('nonexistent', 'finished')).toThrow();
  });
});

describe('21.2 — PredictionSnapshot', () => {
  it('creates immutable snapshot', () => {
    const engine = new ShadowPredictionSnapshot();
    const snap = engine.capture({
      fixtureId: 'shfix_000001', provider: 'test', market: 'ML',
      homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8,
      predictedHomeProb: 0.55, predictedDrawProb: 0.25, predictedAwayProb: 0.20,
      fairOdds: 1.82, expectedValue: 0.1, recommendedStake: 20,
      decisionPolicy: 'balanced', featureValues: { elo: 0.3, form: 0.7 },
      calibrationVersion: '1.0.0', modelVersion: '2.0.0', experimentVersion: 'exp_001', researchManifest: 'rm_001',
    });
    expect(snap.snapshotId).toMatch(/^shsnap_\d{6}$/);
    expect(snap.immutable).toBe(true);
    expect(snap.expectedValue).toBe(0.1);
    expect(snap.featureValues.elo).toBe(0.3);
  });
});

describe('21.3 — OddsTimelineTracker', () => {
  it('tracks opening-closing CLV', () => {
    const tracker = new OddsTimelineTracker();
    tracker.record('f1', { timestamp: '2026-07-12T10:00:00Z', homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8, market: 'ML', provider: 'book-a' });
    tracker.record('f1', { timestamp: '2026-07-12T11:00:00Z', homeOdds: 1.9, drawOdds: 3.5, awayOdds: 4.0, market: 'ML', provider: 'book-a' });
    const tl = tracker.getTimeline('f1');
    expect(tl.opening?.homeOdds).toBe(2.0);
    expect(tl.current?.homeOdds).toBe(1.9);
    expect(tl.openingClv).toBeCloseTo(0.0526, 3);
    expect(tl.marketMovement).toBe(-0.1);
  });
});

describe('21.4 — MarketMonitor', () => {
  it('detects sharp movement', () => {
    const monitor = new MarketMonitor();
    const event = monitor.detect({ fixtureId: 'f1', market: 'ML', beforeOdds: 2.0, afterOdds: 1.5, timestamp: 't' });
    expect(event).not.toBeNull();
    expect(event!.type).toBe('sharp_movement');
    expect(event!.confidence).toBe(0.9);
  });

  it('returns null for insignificant movement', () => {
    const monitor = new MarketMonitor();
    const event = monitor.detect({ fixtureId: 'f1', market: 'ML', beforeOdds: 2.0, afterOdds: 2.01, timestamp: 't' });
    expect(event).toBeNull();
  });
});

describe('21.5 — ResultCollector', () => {
  it('collects match result with computed fields', () => {
    const collector = new ResultCollector();
    const r = collector.collect({ fixtureId: 'f1', homeGoals: 2, awayGoals: 1 });
    expect(r.winner).toBe('home');
    expect(r.btts).toBe(true);
    expect(r.ouResult).toBe('over');
    expect(r.ahResult).toBe('H1');
  });
});

describe('21.6 — LiveEvaluator', () => {
  it('evaluates prediction vs actual', () => {
    const ev = new LiveEvaluator();
    const result = ev.evaluate({ fixtureId: 'f1', market: 'ML', predictedProbability: 0.6, marketProbability: 0.5, closingOddsProbability: 0.55, actualResult: 1 });
    expect(result.correct).toBe(true);
    expect(result.roi).toBeGreaterThan(0);
    expect(result.brierScore).toBeGreaterThan(0);
  });
});

describe('21.7 — ResearchLedger', () => {
  it('stores immutable research entries', () => {
    const ledger = new ResearchLedger();
    const entry = ledger.add({ fixtureId: 'f1', snapshotId: 's1', market: 'ML', predictedProb: 0.6, marketOdds: 2.0, stake: 20, actualResult: 1, profit: 20, closingOdds: 1.9, clv: 0.05, calibrationVersion: '1.0', policyUsed: 'balanced', decisionTrace: ['ev_pass'], researchArtifactIds: ['art_1'] });
    expect(entry.entryId).toMatch(/^shledger_\d{6}$/);
    expect(entry.immutable).toBe(true);
    expect(ledger.count()).toBe(1);
  });
});

describe('21.8 — ShadowDashboardEngine', () => {
  it('aggregates metrics', () => {
    const engine = new ShadowDashboardEngine();
    const report = engine.generate([], [], 'today');
    expect(report.dashboardId).toMatch(/^shdash_\d{6}$/);
    expect(report.metrics.totalPredictions).toBe(0);
  });
});

describe('21.9 — ShadowDriftDetector', () => {
  it('detects high severity drift', () => {
    const detector = new ShadowDriftDetector();
    const report = detector.detect([{ dimension: 'performance', severity: 'high', confidence: 0.95, value: 0.8, threshold: 0.5, recommendedAction: 'Review model' }]);
    expect(report.overallDrift).toBe(true);
    expect(report.alerts.length).toBe(1);
  });
});

describe('21.10 — ShadowChampionValidator', () => {
  it('returns PASS when all gates pass', () => {
    const validator = new ShadowChampionValidator();
    const result = validator.validate(
      { totalPredictions: 100, roi: 10, yield_: 0.05, clv: 0.02, winRate: 55, expectedValue: 0.03, calibration: 0.04, brierScore: 0.2, sharpeRatio: 0.5, kellyGrowth: 0.1, maxDrawdown: 0.2, averageEdge: 0.03 },
      { minFixtures: 50, minClv: 0, minRoi: 0, minEdge: 0, minConsistency: 0, minCalibration: 0.1, minStability: 0 }
    );
    expect(result.status).toBe('PASS');
  });

  it('returns FAIL when most gates fail', () => {
    const validator = new ShadowChampionValidator();
    const result = validator.validate(
      { totalPredictions: 10, roi: -20, yield_: -0.1, clv: -0.05, winRate: 30, expectedValue: -0.05, calibration: 0.5, brierScore: 0.5, sharpeRatio: -0.5, kellyGrowth: -0.1, maxDrawdown: 0.5, averageEdge: -0.05 },
      { minFixtures: 100, minClv: 0.05, minRoi: 5, minEdge: 0.02, minConsistency: 80, minCalibration: 0.1, minStability: 80 }
    );
    expect(result.status).toBe('FAIL');
  });
});

describe('21.11 — ShadowReportGenerator', () => {
  it('generates markdown reports', () => {
    const gen = new ShadowReportGenerator();
    const metrics = { totalPredictions: 10, roi: 5.5, yield_: 0.05, clv: 0.02, winRate: 60, expectedValue: 0.03, calibration: 0.04, brierScore: 0.2, sharpeRatio: 0.5, kellyGrowth: 0.1, maxDrawdown: 0.15, averageEdge: 0.03 };
    const report = gen.generate({ type: 'daily', summary: '10 predictions', metrics, data: {} });
    expect(report.reportId).toMatch(/^shrep_\d{6}$/);
    const md = gen.toMarkdown(report);
    expect(md).toContain('Daily Shadow Research Report');
    expect(md).toContain('ROI: 5.5%');
  });
});

describe('21.12 — ShadowArtifactIntegration', () => {
  it('creates artifact with all links', () => {
    const integration = new ShadowArtifactIntegration();
    const art = integration.create({ fixtureId: 'f1', snapshotId: 's1', evaluationId: 'e1', ledgerEntryId: 'l1' });
    expect(art.artifactId).toMatch(/^shart_\d{6}$/);
    expect(art.immutable).toBe(true);
    expect(art.evidenceLink).toContain('evidence://shadow/');
  });
});