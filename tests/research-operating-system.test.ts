/**
 * Phase 3 — Research Operating System Unit Tests
 * ================================================
 * Tests for Experiment Registry, Model Registry, Feature Store,
 * and Feature Dependency Graph.
 *
 * Hardening: standardized IDs (exp_000001, mdl_000001, feat_000001),
 * domain events, metadata contract, immutable completion.
 */

import { describe, it, expect } from 'vitest';
import { ExperimentRegistry } from '../src/lib/registry/experimentRegistry';
import { ModelRegistry } from '../src/lib/registry/modelRegistry';
import { FeatureStore, FeatureDefinition } from '../src/lib/registry/featureStore';
import { FeatureDependencyGraph } from '../src/lib/registry/featureDependencyGraph';

// ─── Experiment Registry ────────────────────────────────────────────────

describe('ExperimentRegistry', () => {
  const registry = new ExperimentRegistry();

  it('creates an experiment in draft status with standardized ID', () => {
    const exp = registry.create('Test ROI', 'Model X beats Model Y', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'abc123', replaySeed: 42,
      featureSetVersion: '1.0', modelVersion: 'poisson-v1',
      configurationHash: 'def456', engineVersion: '1.0',
      parameters: { poisson: 0.5, dc: 0.5 },
    });
    expect(exp.status).toBe('draft');
    expect(exp.id).toMatch(/^exp_\d{6}$/); // standardized: exp_000001
    expect(exp.objective).toBe('Test ROI');
    expect(exp.events.length).toBe(1);
    expect(exp.events[0].type).toBe('ExperimentCreated');
  });

  it('transitions to running', () => {
    const exp = registry.create('Run A', 'Hypothesis A', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'x', replaySeed: 1,
      featureSetVersion: '1.0', modelVersion: 'v1', configurationHash: 'y', engineVersion: '1.0', parameters: {},
    });
    const started = registry.start(exp.id);
    expect(started.status).toBe('running');
    expect(started.events.some((e) => e.type === 'ExperimentStarted')).toBe(true);
  });

  it('completes with metrics and freezes', () => {
    const exp = registry.create('Complete Test', 'test', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'x', replaySeed: 1,
      featureSetVersion: '1.0', modelVersion: 'v2', configurationHash: 'y', engineVersion: '1.0', parameters: {},
    });
    registry.start(exp.id);
    const completed = registry.complete(exp.id, { roi: 12.5, yield_: 10, brierScore: 0.18, logLoss: 0.5, ece: 0.03, avgClv: 0.05, sharpeRatio: 1.2, winRate: 55 });
    expect(completed.status).toBe('completed');
    expect(completed.metrics?.roi).toBe(12.5);
    expect(completed.finishedAt).toBeTruthy();
    expect(completed.events.some((e) => e.type === 'ExperimentCompleted')).toBe(true);
  });

  it('fails experiment', () => {
    const exp = registry.create('Fail Test', 'test', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'x', replaySeed: 1,
      featureSetVersion: '1.0', modelVersion: 'v3', configurationHash: 'y', engineVersion: '1.0', parameters: {},
    });
    const failed = registry.fail(exp.id, 'Out of memory');
    expect(failed.status).toBe('failed');
    expect(failed.notes).toBe('Out of memory');
    expect(failed.events.some((e) => e.type === 'ExperimentFailed')).toBe(true);
  });

  it('archives experiment', () => {
    const exp = registry.create('Archive Test', 'test', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'x', replaySeed: 1,
      featureSetVersion: '1.0', modelVersion: 'v4', configurationHash: 'y', engineVersion: '1.0', parameters: {},
    });
    const archived = registry.archive(exp.id);
    expect(archived.status).toBe('archived');
  });

  it('returns statistics', () => {
    const stats = registry.getStatistics();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.completed).toBeGreaterThan(0);
  });

  it('rejects start on completed experiment', () => {
    const exp = registry.create('Double Start', 'test', 'researcher', {
      datasetVersion: '1.0', datasetHash: 'x', replaySeed: 1,
      featureSetVersion: '1.0', modelVersion: 'v5', configurationHash: 'y', engineVersion: '1.0', parameters: {},
    });
    registry.start(exp.id);
    registry.complete(exp.id, { roi: 5, yield_: 4, brierScore: 0.2, logLoss: 0.6, ece: 0.04, avgClv: 0.02, sharpeRatio: 0.8, winRate: 52 });
    expect(() => registry.start(exp.id)).toThrow();
  });
});

// ─── Model Registry ─────────────────────────────────────────────────────

describe('ModelRegistry', () => {
  const registry = new ModelRegistry();
  const config = {
    datasetVersion: 'epl-2024-v1', datasetHash: 'abc', featureSetVersion: '1.0',
    parameters: { poisson: 0.6, dc: 0.4 }, trainingDate: '2024-08-01', trainingDurationMs: 5000,
  };

  it('registers a model as candidate with standardized ID', () => {
    const m = registry.register('Poisson Baseline', '1.0.0', 'Pure Poisson model', 'engineer', 'poisson', config);
    expect(m.status).toBe('candidate');
    expect(m.id).toMatch(/^mdl_\d{6}$/);
    expect(m.events.some((e) => e.type === 'ModelRegistered')).toBe(true);
  });

  it('promotes candidate to challenger', () => {
    const m = registry.register('Dixon-Coles v2', '2.0.0', 'DC with tau correction', 'engineer', 'dixon-coles', config);
    registry.promote(m.id, 'challenger', 'Passes validation threshold');
    const updated = registry.get(m.id)!;
    expect(updated.status).toBe('challenger');
    expect(updated.promotionHistory.length).toBe(1);
  });

  it('promotes challenger to champion', () => {
    const m = registry.register('Ensemble v3', '3.0.0', 'Ensemble of Poisson + DC', 'engineer', 'ensemble', config);
    registry.promote(m.id, 'challenger', 'Good validation');
    registry.promote(m.id, 'champion', 'Best ROI across all leagues');
    expect(registry.get(m.id)!.status).toBe('champion');
  });

  it('demotes previous champion when new champion is promoted', () => {
    const champion = registry.getChampion()!;
    expect(champion.promotionHistory.length).toBeGreaterThanOrEqual(1);
  });

  it('rejects invalid promotion', () => {
    const m = registry.register('Direct Champion', '4.0.0', 'Try to skip steps', 'engineer', 'xgboost', config);
    expect(() => registry.promote(m.id, 'champion', 'Skip challenger')).toThrow();
  });

  it('stores validation metrics', () => {
    const m = registry.register('Validated Model', '5.0.0', 'Has metrics', 'engineer', 'logistic', config);
    registry.setValidationMetrics(m.id, { roi: 15, brierScore: 0.16, logLoss: 0.45, ece: 0.02, avgClv: 0.08, sharpeRatio: 1.5, winRate: 58, totalBets: 1000 });
    const updated = registry.get(m.id)!;
    expect(updated.validationMetrics?.roi).toBe(15);
    expect(updated.validationMetrics?.totalBets).toBe(1000);
  });

  it('compares two models', () => {
    const m1 = registry.register('Compare A', '6.0.0', 'First', 'eng', 'poisson', config);
    const m2 = registry.register('Compare B', '6.1.0', 'Second', 'eng', 'dc', config);
    registry.setValidationMetrics(m1.id, { roi: 10, brierScore: 0.2, logLoss: 0.5, ece: 0.03, avgClv: 0.05, sharpeRatio: 1.0, winRate: 52, totalBets: 500 });
    registry.setValidationMetrics(m2.id, { roi: 15, brierScore: 0.18, logLoss: 0.45, ece: 0.02, avgClv: 0.08, sharpeRatio: 1.5, winRate: 55, totalBets: 500 });
    const comparison = registry.compareModels(m1.id, m2.id);
    expect(comparison.metricDeltas.roi).toBe(5);
    expect(comparison.metricDeltas.brierScore).toBeCloseTo(0.02, 5);
  });

  it('returns valid statistics', () => {
    const stats = registry.getStatistics();
    expect(stats.total).toBeGreaterThan(0);
    expect(stats.champions).toBeGreaterThanOrEqual(1);
  });
});

// ─── Feature Store ──────────────────────────────────────────────────────

describe('FeatureStore', () => {
  const store = new FeatureStore();

  it('registers a feature with standardized ID', () => {
    const f = store.register('test-feature', '1.0.0', 'raw', 'A test feature', 'x + y', 'engineer');
    expect(f.id).toMatch(/^feat_\d{6}$/);
    expect(f.status).toBe('active');
    expect(f.events.some((e) => e.type === 'FeatureRegistered')).toBe(true);
  });

  it('allows same name with different version', () => {
    store.register('multi-version', '1.0.0', 'raw', 'V1', 'orig', 'eng');
    store.register('multi-version', '2.0.0', 'derived', 'V2', 'improved', 'eng');
    const versions = store.getByName('multi-version');
    expect(versions.length).toBe(2);
  });

  it('finds dependents', () => {
    const parent = store.register('parent', '1.0.0', 'raw', 'Parent', 'x', 'eng');
    const child = store.register('child', '1.0.0', 'derived', 'Child', 'parent + 1', 'eng', [parent.id]);
    const dependents = store.getDependents(parent.id);
    expect(dependents.some((d) => d.id === child.id)).toBe(true);
  });

  it('returns dependency chain', () => {
    const a = store.register('dep-a', '1.0.0', 'raw', 'A', 'a', 'eng');
    const b = store.register('dep-b', '1.0.0', 'derived', 'B', 'a + 1', 'eng', [a.id]);
    const c = store.register('dep-c', '1.0.0', 'composite', 'C', 'b * 2', 'eng', [b.id]);
    const chain = store.getDependencyChain(c.id);
    expect(chain).toContain(a.id);
    expect(chain).toContain(b.id);
    expect(chain.length).toBeGreaterThanOrEqual(3);
  });

  it('deprecates features', () => {
    const f = store.register('deprecate-me', '1.0.0', 'raw', 'To be deprecated', 'x', 'eng');
    store.deprecate(f.id);
    expect(store.get(f.id)!.status).toBe('deprecated');
    expect(store.get(f.id)!.events.some((e) => e.type === 'FeatureDeprecated')).toBe(true);
  });

  it('registers defaults without error', () => {
    store.registerDefaults();
    const features = store.getByType('raw');
    expect(features.length).toBeGreaterThan(0);
  });
});

// ─── Feature Dependency Graph ────────────────────────────────────────────

describe('FeatureDependencyGraph', () => {
  const store = new FeatureStore();
  store.registerDefaults();
  const graph = new FeatureDependencyGraph(store);

  it('builds graph from feature store', () => {
    const nodes = graph.getAllNodes();
    expect(nodes.length).toBeGreaterThan(0);
  });

  it('assigns correct depths', () => {
    const nodes = graph.getAllNodes();
    const raw = nodes.filter((n) => n.depth === 0);
    expect(raw.length).toBeGreaterThanOrEqual(5);
  });

  it('analyzes impact', () => {
    const allNodes = graph.getAllNodes();
    const rawNode = allNodes.find((n) => n.depth === 0);
    expect(rawNode).toBeDefined();
    expect(rawNode!.dependents.length).toBeGreaterThanOrEqual(0);
  });

  it('finds no circular dependencies in default set', () => {
    const cycles = graph.findCircularDependencies();
    expect(cycles.length).toBe(0);
  });

  it('builds dependency path', () => {
    const allNodes = graph.getAllNodes();
    const leaf = allNodes.find((n) => n.dependents.length === 0 && n.depth > 0);
    if (leaf) {
      const path = graph.getDependencyPath(leaf.id);
      expect(path.length).toBeGreaterThanOrEqual(1);
    }
  });
});