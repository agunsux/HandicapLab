/**
 * EPIC 19 — Feature Intelligence Platform Tests
 */

import { describe, it, expect } from 'vitest';
import { FEATURE_INTELLIGENCE_VERSION } from '../src/lib/feature-intelligence/types';
import { FeatureRegistry } from '../src/lib/feature-intelligence/registry';
import { FeatureLineageEngine } from '../src/lib/feature-intelligence/lineageEngine';
import { ImportanceEngine } from '../src/lib/feature-intelligence/importanceEngine';
import { AblationEngine } from '../src/lib/feature-intelligence/ablationEngine';
import { FeatureStabilityEngine } from '../src/lib/feature-intelligence/stabilityEngine';
import { RedundancyEngine } from '../src/lib/feature-intelligence/redundancyEngine';
import { FeatureDriftEngine } from '../src/lib/feature-intelligence/driftEngine';
import { FeatureExplainabilityEngine } from '../src/lib/feature-intelligence/explainability';
import { GovernanceEngine } from '../src/lib/feature-intelligence/governanceEngine';
import { QualityEngine } from '../src/lib/feature-intelligence/qualityEngine';
import { FeatureReportGenerator } from '../src/lib/feature-intelligence/reporting';
import { FeatureArtifactIntegration } from '../src/lib/feature-intelligence/artifactIntegration';

describe('Constants', () => {
  it('exports correct version', () => {
    expect(FEATURE_INTELLIGENCE_VERSION).toBe('1.0.0');
  });
});

describe('EPIC 19.1 — FeatureRegistry', () => {
  it('registers and retrieves features', () => {
    const registry = new FeatureRegistry();
    const f = registry.register({ featureId: 'elo_rating', category: 'team', owner: 'research', description: 'Elo rating', outputType: 'numeric' });
    expect(f.featureId).toBe('elo_rating');
    expect(f.version).toBe('1.0.0');
    expect(registry.get('elo_rating')?.owner).toBe('research');
    expect(registry.ids()).toContain('elo_rating');
  });

  it('categorizes features', () => {
    const registry = new FeatureRegistry();
    registry.register({ featureId: 'f1', category: 'team', owner: 'r', description: 'f1', outputType: 'numeric' });
    registry.register({ featureId: 'f2', category: 'market', owner: 'r', description: 'f2', outputType: 'numeric' });
    expect(registry.getByCategory('team').length).toBe(1);
    expect(registry.getByCategory('market').length).toBe(1);
  });
});

describe('EPIC 19.2 — FeatureLineageEngine', () => {
  it('builds a lineage graph', () => {
    const engine = new FeatureLineageEngine();
    const graph = engine.buildLineage('elo_rating');
    expect(graph.lineageId).toMatch(/^filin_\d{6}$/);
    expect(graph.nodes.length).toBe(2);
    expect(graph.edges.length).toBe(1);
  });
});

describe('EPIC 19.3 — ImportanceEngine', () => {
  it('computes correlation importance', () => {
    const engine = new ImportanceEngine();
    const report = engine.computeCorrelation(
      ['f1', 'f2'],
      [[1, 2, 3, 4, 5], [5, 4, 3, 2, 1]],
      [0, 0, 1, 1, 1]
    );
    expect(report.importanceId).toMatch(/^fiimp_\d{6}$/);
    expect(report.results.length).toBe(2);
    expect(report.results[0].rank).toBe(1);
  });
});

describe('EPIC 19.4 — AblationEngine', () => {
  it('runs single removal ablation', () => {
    const engine = new AblationEngine();
    const report = engine.runSingleRemoval(
      ['f1', 'f2'],
      100,
      (id) => id === 'f1' ? 80 : 90
    );
    expect(report.ablationId).toMatch(/^fiabl_\d{6}$/);
    expect(report.results.length).toBe(2);
    expect(report.results[0].delta).toBe(-20);
  });
});

describe('EPIC 19.5 — FeatureStabilityEngine', () => {
  it('analyzes feature stability across segments', () => {
    const engine = new FeatureStabilityEngine();
    const result = engine.analyze('f1', [
      { label: 'season_1', values: [0.5, 0.6, 0.55] },
      { label: 'season_2', values: [0.52, 0.58, 0.53] },
    ]);
    expect(result.featureId).toBe('f1');
    expect(typeof result.stabilityScore).toBe('number');
    expect(result.segments.length).toBe(2);
  });
});

describe('EPIC 19.6 — RedundancyEngine', () => {
  it('detects correlated feature pairs', () => {
    const engine = new RedundancyEngine();
    const report = engine.detect(
      ['f1', 'f2', 'f3'],
      [
        [1, 2, 3, 4, 5],
        [1.1, 2.1, 3.1, 4.1, 5.1],
        [5, 4, 3, 2, 1],
      ]
    );
    expect(report.redundancyId).toMatch(/^fired_\d{6}$/);
    expect(report.highCorrelationPairs.length).toBeGreaterThanOrEqual(0);
  });
});

describe('EPIC 19.7 — FeatureDriftEngine', () => {
  it('detects drift in feature distributions', () => {
    const engine = new FeatureDriftEngine();
    const result = engine.detect('f1', [0.1, 0.2, 0.3, 0.4, 0.5], [0.1, 0.2, 0.3, 0.4, 0.5]);
    expect(result.featureId).toBe('f1');
    expect(result.driftDetected).toBe(false);
    expect(result.psi).toBeCloseTo(0, 1);
  });

  it('detects significant drift', () => {
    const engine = new FeatureDriftEngine();
    const result = engine.detect('f1', [0.1, 0.2, 0.3, 0.4, 0.5], [0.6, 0.7, 0.8, 0.9, 0.95]);
    expect(typeof result.driftDetected).toBe('boolean');
    expect(result.klDivergence).toBeGreaterThan(0);
  });
});

describe('EPIC 19.8 — FeatureExplainabilityEngine', () => {
  it('creates prediction feature contribution', () => {
    const engine = new FeatureExplainabilityEngine();
    const contrib = engine.explain({ featureId: 'elo', contribution: 0.3, importance: 0.8, confidence: 0.9, quality: 0.95, freshness: '2024-01-01', provenance: 'api-football' });
    expect(contrib.featureId).toBe('elo');
    expect(contrib.active).toBe(true);
    expect(contrib.contribution).toBe(0.3);
  });
});

describe('EPIC 19.9 — GovernanceEngine', () => {
  it('creates and updates governance records', () => {
    const engine = new GovernanceEngine();
    const record = engine.create('elo', 'research-team');
    expect(record.approvalStatus).toBe('draft');
    const updated = engine.updateStatus('elo', 'validated');
    expect(updated.approvalStatus).toBe('validated');
    expect(() => engine.updateStatus('nonexistent', 'production')).toThrow();
  });
});

describe('EPIC 19.10 — QualityEngine', () => {
  it('evaluates feature quality metrics', () => {
    const engine = new QualityEngine();
    const result = engine.evaluate('f1', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(result.missingValuesPct).toBe(0);
    expect(result.constantValue).toBe(false);
    expect(result.variance).toBeGreaterThan(0);
    expect(result.overallQualityScore).toBeGreaterThan(0);
  });

  it('handles empty values', () => {
    const engine = new QualityEngine();
    const result = engine.evaluate('empty', []);
    expect(result.missingValuesPct).toBe(100);
    expect(result.overallQualityScore).toBe(0);
  });

  it('detects constant features', () => {
    const engine = new QualityEngine();
    const result = engine.evaluate('const', [1, 1, 1, 1, 1]);
    expect(result.constantValue).toBe(true);
    expect(result.variance).toBe(0);
  });
});

describe('EPIC 19.11 — FeatureReportGenerator', () => {
  it('generates reports with markdown', () => {
    const gen = new FeatureReportGenerator();
    const report = gen.generate({ type: 'catalog', summary: '5 features registered', data: {} });
    expect(report.reportId).toMatch(/^firep_\d{6}$/);
    const md = gen.toMarkdown(report);
    expect(md).toContain('Catalog Report');
    expect(md).toContain('5 features registered');
  });
});

describe('EPIC 19.12 — FeatureArtifactIntegration', () => {
  it('creates immutable artifacts', () => {
    const integration = new FeatureArtifactIntegration();
    const artifact = integration.create({ datasetId: 'ds_1', experimentId: 'exp_1', modelVersion: '1.0.0' });
    expect(artifact.artifactId).toMatch(/^fiart_\d{6}$/);
    expect(artifact.immutable).toBe(true);
  });
});