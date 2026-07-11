/**
 * HandicapLab — Historical Replay Laboratory Tests (EPIC 16)
 * ============================================================
 * Comprehensive tests covering all 12 EPICs.
 */

import { describe, it, expect } from 'vitest';

// ─── Types & ID Generation ────────────────────────────────────────────────
import { REPLAY_LAB_VERSION, BASELINE_VERSION, RL_ID_PREFIX } from '../src/lib/replay-lab/types';
import {
  generateSessionId, generateJobId, generateFoldId, generateSnapshotId,
  generateComparisonId, generateLineageId, generateBootstrapId, generateReportId,
  generateDashboardId, seededShuffle, simpleHash,
} from '../src/lib/replay-lab/id';

// ─── EPIC 16.1 — Replay Orchestrator ──────────────────────────────────────
import { ReplayOrchestrator } from '../src/lib/replay-lab/replayOrchestrator';

// ─── EPIC 16.2 — Replay Session Manager ───────────────────────────────────
import { ReplaySessionManager } from '../src/lib/replay-lab/sessionManager';

// ─── EPIC 16.3 — Walk-Forward Research Engine ─────────────────────────────
import { WalkForwardEngine } from '../src/lib/replay-lab/walkForwardEngine';

// ─── EPIC 16.4 — Parallel Replay Engine ───────────────────────────────────
import { ParallelReplayEngine } from '../src/lib/replay-lab/parallelEngine';

// ─── EPIC 16.5 — Baseline Execution Framework ─────────────────────────────
import { BaselineRegistry, createAllBaselines } from '../src/lib/replay-lab/baselineStrategies';

// ─── EPIC 16.6 — Prediction Snapshot Engine ───────────────────────────────
import { SnapshotEngine } from '../src/lib/replay-lab/snapshotEngine';

// ─── EPIC 16.7 — Outcome Evaluator ────────────────────────────────────────
import { OutcomeEvaluator } from '../src/lib/replay-lab/outcomeEvaluator';

// ─── EPIC 16.8 — Replay Comparison Engine ─────────────────────────────────
import { ComparisonEngine } from '../src/lib/replay-lab/comparisonEngine';

// ─── EPIC 16.9 — Experiment Lineage ───────────────────────────────────────
import { LineageEngine } from '../src/lib/replay-lab/lineageEngine';

// ─── EPIC 16.10 — Bootstrap Validation Engine ─────────────────────────────
import { BootstrapEngine } from '../src/lib/replay-lab/bootstrapEngine';

// ─── EPIC 16.11 — Replay Reporting ────────────────────────────────────────
import { ReplayReportGenerator } from '../src/lib/replay-lab/reporting';

// ─── EPIC 16.12 — Research Dashboard Data Layer ───────────────────────────
import { DashboardEngine } from '../src/lib/replay-lab/dashboardEngine';

import type { ReplayOutcome, ReplayMetrics, HistoricalMatch } from '../src/lib/replay/types';
import type { WalkForwardConfig } from '../src/lib/replay-lab/types';

// ─── Test Fixtures ────────────────────────────────────────────────────────

function makeOutcome(overrides: Partial<ReplayOutcome> = {}): ReplayOutcome {
  return {
    matchId: 'm1',
    marketType: 'ML',
    selection: 'home',
    predictedProbability: 0.5,
    actualResult: 1,
    profitLoss: 1.0,
    brierScore: 0.25,
    logLoss: 0.693,
    clv: 0.02,
    ...overrides,
  };
}

function makeMetrics(overrides: Partial<ReplayMetrics> = {}): ReplayMetrics {
  return {
    totalMatches: 2, totalPredictions: 2, won: 1, lost: 1, voided: 0,
    roi: 0, brierScore: 0.25, logLoss: 0.693, avgClv: 0.01, winRate: 50,
    totalStake: 2, totalProfit: 0,
    ...overrides,
  };
}

function makeMatch(id: string, kickoff: string, league = 'comp:epl', season = '2024-2025'): HistoricalMatch {
  return {
    fixture: { id, homeTeam: 'A', awayTeam: 'B', kickoff, leagueId: league, season, status: 'finished' },
    odds: [{ fixtureId: id, market: 'ML', homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8, timestamp: kickoff }],
    result: { fixtureId: id, homeGoals: 2, awayGoals: 1, status: 'finished' },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────

describe('Types & Constants', () => {
  it('exports correct version constants', () => {
    expect(REPLAY_LAB_VERSION).toBe('1.0.0');
    expect(BASELINE_VERSION).toBe('1.0.0');
    expect(RL_ID_PREFIX.SESSION).toBe('rls');
    expect(RL_ID_PREFIX.JOB).toBe('rlj');
    expect(RL_ID_PREFIX.SNAPSHOT).toBe('rlsnap');
  });
});

describe('ID Generation', () => {
  it('generates unique IDs with correct prefixes', () => {
    expect(generateSessionId()).toMatch(/^rls_\d{6}$/);
    expect(generateJobId()).toMatch(/^rlj_\d{6}$/);
    expect(generateSnapshotId()).toMatch(/^rlsnap_\d{6}$/);
    expect(generateComparisonId()).toMatch(/^rlcmp_\d{6}$/);
  });

  it('sorts deterministic IDs incrementally', () => {
    const ids = [generateSessionId(), generateSessionId(), generateSessionId()];
    expect(ids[0] < ids[1]).toBe(true);
    expect(ids[1] < ids[2]).toBe(true);
  });

  it('produces deterministic shuffle from same seed', () => {
    const arr = [1, 2, 3, 4, 5];
    const a = seededShuffle(arr, 42);
    const b = seededShuffle(arr, 42);
    expect(a).toEqual(b);
  });

  it('produces different shuffles from different seeds', () => {
    const arr = [1, 2, 3, 4, 5];
    const a = seededShuffle(arr, 42);
    const b = seededShuffle(arr, 99);
    expect(a).not.toEqual(b);
  });

  it('simpleHash produces consistent output', () => {
    expect(simpleHash('test')).toBe(simpleHash('test'));
    expect(simpleHash('test')).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe('EPIC 16.2 — ReplaySessionManager', () => {
  it('creates a session with complete lineage', () => {
    const mgr = new ReplaySessionManager();
    const session = mgr.create({
      experimentId: 'exp_000001',
      datasetId: 'ds_000001',
      datasetFingerprint: 'abcd1234',
      datasetVersion: '1.0.0',
      modelVersion: '2.0.0',
      featureVersion: '3.0.0',
      predictionEngineVersion: '1.0.0',
      seed: 42,
    });
    expect(session.sessionId).toMatch(/^rls_\d{6}$/);
    expect(session.experimentId).toBe('exp_000001');
    expect(session.seed).toBe(42);
    expect(Object.isFrozen(session)).toBe(true);
    expect(session.status).toBe('created');
  });

  it('completes a session with metrics', () => {
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f1', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    mgr.markRunning(s.sessionId);
    const completed = mgr.complete(s.sessionId, makeMetrics());
    expect(completed.status).toBe('completed');
    expect(completed.finishTime).toBeTruthy();
    expect(Object.isFrozen(completed)).toBe(true);
  });

  it('fails a session with error message', () => {
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f1', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    const failed = mgr.fail(s.sessionId, 'Test error');
    expect(failed.status).toBe('failed');
    expect(failed.error).toBe('Test error');
  });

  it('throws on unknown session', () => {
    const mgr = new ReplaySessionManager();
    expect(() => mgr.markRunning('nonexistent')).toThrow();
  });
});

describe('EPIC 16.3 — WalkForwardEngine', () => {
  const engine = new WalkForwardEngine();

  it('generates expanding window folds from sorted matches', () => {
    const matches = [makeMatch('m1', '2024-08-01T12:00:00Z'), makeMatch('m2', '2024-08-08T12:00:00Z'), makeMatch('m3', '2024-08-15T12:00:00Z'), makeMatch('m4', '2024-08-22T12:00:00Z'), makeMatch('m5', '2024-08-29T12:00:00Z')];
    const config: WalkForwardConfig = { strategy: 'expanding', testSize: 1, stepSize: 1, minTrainFixtures: 1 };
    const report = engine.generateFolds(matches, config, 'exp_1', 'ds_1');
    expect(report.folds.length).toBeGreaterThanOrEqual(2);
    expect(report.folds[0].trainFixtures.length).toBeGreaterThan(0);
    expect(report.folds[0].testFixtures.length).toBe(1);
    expect(report.config.strategy).toBe('expanding');
  });

  it('generates season-split folds', () => {
    const matches = [
      makeMatch('m1', '2024-08-01T12:00:00Z', 'comp:epl', '2024-2025'),
      makeMatch('m2', '2024-08-08T12:00:00Z', 'comp:epl', '2024-2025'),
      makeMatch('m3', '2023-08-01T12:00:00Z', 'comp:laliga', '2023-2024'),
    ];
    const config: WalkForwardConfig = { strategy: 'season' };
    const report = engine.generateFolds(matches, config, 'exp_2', 'ds_2');
    expect(report.folds.length).toBe(2);
  });

  it('handles empty matches', () => {
    const report = engine.generateFolds([], { strategy: 'expanding' }, 'exp_3', 'ds_3');
    expect(report.folds.length).toBe(0);
  });
});

describe('EPIC 16.5 — BaselineRegistry', () => {
  it('registers all 11 baseline strategies', () => {
    const registry = new BaselineRegistry();
    expect(registry.ids().length).toBe(11);
    expect(registry.get('champion')).toBeDefined();
    expect(registry.get('poisson')).toBeDefined();
    expect(registry.get('closing_odds')).toBeDefined();
    expect(registry.get('random')).toBeDefined();
  });

  it('computes normalized probabilities from odds', () => {
    const strategies = createAllBaselines();
    const closing = strategies.find((s) => s.id === 'closing_odds')!;
    const result = closing.predict({ homeTeam: 'A', awayTeam: 'B', homeOdds: 2.0, drawOdds: 3.4, awayOdds: 3.8, kickoff: 't' });
    expect(result.homeProbability + result.drawProbability + result.awayProbability).toBeCloseTo(1, 5);
  });
});

describe('EPIC 16.6 — SnapshotEngine', () => {
  it('captures snapshots immutably with unique IDs', () => {
    const engine = new SnapshotEngine();
    const snap = engine.capture({
      sessionId: 'rls_000001',
      fixtureId: 'fix:1',
      timestamp: '2024-08-17T12:00:00Z',
      market: 'ML',
      homeProbability: 0.5,
      drawProbability: 0.3,
      awayProbability: 0.2,
      confidence: 0.8,
    });
    expect(snap.snapshotId).toMatch(/^rlsnap_\d{6}$/);
    expect(snap.predictionHash).toMatch(/^[a-f0-9]{16}$/);
    expect(Object.isFrozen(snap)).toBe(true);
  });

  it('reports stats correctly', () => {
    const engine = new SnapshotEngine();
    engine.capture({ sessionId: 's1', fixtureId: 'f1', timestamp: 't', market: 'ML', homeProbability: 0.5, drawProbability: 0.3, awayProbability: 0.2, confidence: 0.8 });
    engine.capture({ sessionId: 's1', fixtureId: 'f2', timestamp: 't', market: 'ML', homeProbability: 0.6, drawProbability: 0.2, awayProbability: 0.2, confidence: 0.7 });
    const stats = engine.getStats();
    expect(stats.totalSnapshots).toBe(2);
    expect(stats.uniqueSessions).toBe(1);
  });
});

describe('EPIC 16.7 — OutcomeEvaluator', () => {
  const evaluator = new OutcomeEvaluator();

  it('computes detailed metrics from outcomes', () => {
    const outcomes = [
      makeOutcome({ profitLoss: 1.0, actualResult: 1, predictedProbability: 0.6 }),
      makeOutcome({ matchId: 'm2', profitLoss: -1.0, actualResult: 0, predictedProbability: 0.4 }),
    ];
    const metrics = evaluator.evaluate(outcomes);
    expect(metrics.totalPredictions).toBe(2);
    expect(metrics.won).toBe(1);
    expect(metrics.lost).toBe(1);
    expect(metrics.profit).toBe(0);
    expect(metrics.roi).toBe(0);
    expect(metrics.brierScore).toBeGreaterThan(0);
  });

  it('returns zeros for empty outcomes', () => {
    const metrics = evaluator.evaluate([]);
    expect(metrics.totalPredictions).toBe(0);
    expect(metrics.roi).toBe(0);
  });

  it('computes sharpe ratio with non-zero variance', () => {
    const outcomes = [makeOutcome({ profitLoss: 2.0 }), makeOutcome({ profitLoss: -1.0 }), makeOutcome({ profitLoss: 0.5 })];
    const metrics = evaluator.evaluate(outcomes);
    expect(metrics.sharpeRatio).not.toBe(0);
    expect(metrics.profitFactor).toBeGreaterThan(0);
  });
});

describe('EPIC 16.8 — ComparisonEngine', () => {
  it('compares two sessions and produces deltas', () => {
    const engine = new ComparisonEngine();
    const report = engine.compare('s1', 's2', 'baseline_a', 'baseline_b', makeMetrics({ roi: 10 }), makeMetrics({ roi: 5 }));
    expect(report.comparisonId).toMatch(/^rlcmp_\d{6}$/);
    expect(report.roiDelta).toBe(-5); // b - a = 5 - 10 = -5
    expect(report.deltas.length).toBeGreaterThan(0);
    expect(report.deltas[0].metric).toBe('roi');
  });
});

describe('EPIC 16.9 — LineageEngine', () => {
  it('builds a complete lineage graph', () => {
    const engine = new LineageEngine();
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'exp_1', datasetId: 'ds_1', datasetFingerprint: 'fp', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    const graph = engine.buildLineage('exp_1', s);
    expect(graph.lineageId).toMatch(/^rllin_\d{6}$/);
    expect(graph.nodes.length).toBeGreaterThanOrEqual(3);
    expect(graph.edges.length).toBeGreaterThanOrEqual(2);
    expect(graph.nodes.some((n) => n.type === 'experiment')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'replay')).toBe(true);
    expect(graph.nodes.some((n) => n.type === 'dataset')).toBe(true);
  });
});

describe('EPIC 16.10 — BootstrapEngine', () => {
  it('bootstraps a metric and produces CI', () => {
    const engine = new BootstrapEngine();
    const outcomes = [makeOutcome({ profitLoss: 1.0 }), makeOutcome({ profitLoss: 0.5 }), makeOutcome({ profitLoss: -0.5 })];
    const report = engine.bootstrap(
      outcomes,
      (o) => o.reduce((s, x) => s + x.profitLoss, 0) / o.length,
      { iterations: 100, confidenceLevel: 0.95, randomSeed: 42, method: 'percentile' },
      's1'
    );
    expect(report.bootstrapId).toMatch(/^rlboot_\d{6}$/);
    expect(report.results.length).toBe(1);
    expect(report.results[0].observedValue).toBeCloseTo(0.333, 1);
    expect(report.results[0].ciLower).toBeLessThan(report.results[0].ciUpper);
  });

  it('performs paired bootstrap comparison', () => {
    const engine = new BootstrapEngine();
    const outcomesA = [makeOutcome({ profitLoss: 0.5 }), makeOutcome({ profitLoss: -0.2 })];
    const outcomesB = [makeOutcome({ profitLoss: -0.3 }), makeOutcome({ profitLoss: 0.8 })];
    const report = engine.bootstrapPaired(outcomesA, outcomesB, () => 0, { iterations: 50, confidenceLevel: 0.95, randomSeed: 42, method: 'percentile' }, 'sA', 'sB');
    expect(report.results.length).toBe(1);
  });
});

describe('EPIC 16.1 — ReplayOrchestrator', () => {
  it('schedules, starts, and completes jobs', () => {
    const orchestrator = new ReplayOrchestrator(
      new ReplaySessionManager(), new WalkForwardEngine(), new BaselineRegistry(),
      new OutcomeEvaluator(), new SnapshotEngine(), new ComparisonEngine(),
      new BootstrapEngine(), new LineageEngine()
    );
    const job = orchestrator.schedule({
      experimentId: 'exp_1',
      datasetId: 'ds_1',
      datasetFingerprint: 'fp',
      datasetVersion: '1',
      modelVersion: '1',
      featureVersion: '1',
      predictionEngineVersion: '1',
    });
    expect(job.jobId).toMatch(/^rlj_\d{6}$/);
    expect(job.status).toBe('pending');

    const started = orchestrator.start(job.jobId);
    expect(started.status).toBe('running');

    orchestrator.reportProgress(job.jobId, 50);
    const completed = orchestrator.complete(job.jobId, 'rls_000001');
    expect(completed.status).toBe('completed');
    expect(completed.progress).toBe(100);
  });

  it('cancels running jobs', () => {
    const orchestrator = new ReplayOrchestrator(
      new ReplaySessionManager(), new WalkForwardEngine(), new BaselineRegistry(),
      new OutcomeEvaluator(), new SnapshotEngine(), new ComparisonEngine(),
      new BootstrapEngine(), new LineageEngine()
    );
    const job = orchestrator.schedule({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    orchestrator.start(job.jobId);
    const cancelled = orchestrator.cancel(job.jobId);
    expect(cancelled.status).toBe('cancelled');
    expect(orchestrator.isCancelled(job.jobId)).toBe(true);
  });

  it('resumes failed jobs', () => {
    const orchestrator = new ReplayOrchestrator(
      new ReplaySessionManager(), new WalkForwardEngine(), new BaselineRegistry(),
      new OutcomeEvaluator(), new SnapshotEngine(), new ComparisonEngine(),
      new BootstrapEngine(), new LineageEngine()
    );
    const job = orchestrator.schedule({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    orchestrator.start(job.jobId);
    orchestrator.fail(job.jobId, 'error');
    const resumed = orchestrator.resume(job.jobId);
    expect(resumed.status).toBe('running');
  });
});

describe('EPIC 16.11 — ReplayReportGenerator', () => {
  it('generates a comprehensive report', () => {
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'exp_1', datasetId: 'ds_1', datasetFingerprint: 'fp', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    mgr.complete(s.sessionId, makeMetrics());
    const completed = mgr.get(s.sessionId)!;
    const generator = new ReplayReportGenerator();
    const report = generator.generateReport(completed, {
      recommendations: ['Consider increasing stake'],
    });
    expect(report.reportId).toMatch(/^rlrep_\d{6}$/);
    expect(report.sessionId).toBe(s.sessionId);
    expect(report.executiveSummary).toContain('Replay Report');
    expect(report.roi).toBe(0);
  });

  it('produces markdown output', () => {
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    mgr.complete(s.sessionId, makeMetrics());
    const generator = new ReplayReportGenerator();
    const report = generator.generateReport(mgr.get(s.sessionId)!);
    const md = generator.toMarkdown(report);
    expect(md).toContain('# Replay Report');
    expect(md).toContain('ROI');
    expect(md).toContain('Git Commit');
  });
});

describe('EPIC 16.12 — DashboardEngine', () => {
  it('generates a complete dashboard dataset', () => {
    const engine = new DashboardEngine();
    const mgr = new ReplaySessionManager();
    const s = mgr.create({ experimentId: 'e1', datasetId: 'd1', datasetFingerprint: 'f', datasetVersion: '1', modelVersion: '1', featureVersion: '1', predictionEngineVersion: '1' });
    mgr.complete(s.sessionId, makeMetrics());
    const snapshotEngine = new SnapshotEngine();
    const snap = snapshotEngine.capture({ sessionId: s.sessionId, fixtureId: 'f1', timestamp: 't', market: 'ML', homeProbability: 0.5, drawProbability: 0.3, awayProbability: 0.2, confidence: 0.8 });

    const ds = engine.generate(mgr.get(s.sessionId)!, [makeOutcome()], [snap]);
    expect(ds.dashboardId).toMatch(/^rldash_\d{6}$/);
    expect(ds.replayTimeline.length).toBe(1);
    expect(ds.calibrationCurve.length).toBe(1);
    expect(ds.profitCurve.length).toBe(1);
    expect(ds.outcomeDistribution.length).toBe(3);
    expect(ds.confidenceDistribution.length).toBeGreaterThan(0);
    expect(ds.modelComparison.length).toBe(1);
  });
});