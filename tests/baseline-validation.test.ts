/**
 * HandicapLab — Baseline Validation Suite Tests (EPIC 17)
 * Comprehensive tests covering all 10 EPICs.
 */

import { describe, it, expect } from 'vitest';

import { BASELINE_VALIDATION_VERSION, BUILTIN_BASELINE_DESCRIPTORS } from '../src/lib/baseline-validation/types';
import { MetricsEngine } from '../src/lib/baseline-validation/metricsEngine';
import { ScenarioEngine } from '../src/lib/baseline-validation/scenarioEngine';
import { StatisticalComparisonEngine } from '../src/lib/baseline-validation/statisticalComparison';
import { RankingEngine } from '../src/lib/baseline-validation/rankingEngine';
import { ChampionValidator } from '../src/lib/baseline-validation/championValidator';
import { StabilityAnalyzer } from '../src/lib/baseline-validation/stabilityAnalyzer';
import { BenchmarkReportGenerator } from '../src/lib/baseline-validation/benchmarkReporting';
import { ArtifactIntegration } from '../src/lib/baseline-validation/artifactIntegration';
import {
  generateScenarioId, generateRankingId, generatePromotionId,
  generateStabilityId, generateBVReportId, generateArtifactId,
} from '../src/lib/baseline-validation/id';
import type { ReplayOutcome, ReplayMetrics, HistoricalMatch } from '../src/lib/replay/types';
import type { ChampionPromotionCriteria } from '../src/lib/baseline-validation/types';
import type { BaselineId } from '../src/lib/replay-lab/types';

function makeOutcome(overrides: Partial<ReplayOutcome> = {}): ReplayOutcome {
  return { matchId: 'm1', marketType: 'ML', selection: 'home', predictedProbability: 0.5, actualResult: 1, profitLoss: 1.0, brierScore: 0.25, logLoss: 0.693, clv: 0.02, ...overrides };
}

function makeMetrics(overrides: Partial<ReplayMetrics> = {}): ReplayMetrics {
  return { totalMatches: 2, totalPredictions: 10, won: 5, lost: 3, voided: 2, roi: 5, brierScore: 0.2, logLoss: 0.5, avgClv: 0.01, winRate: 50, totalStake: 10, totalProfit: 0.5, ...overrides };
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
  it('exports correct version', () => {
    expect(BASELINE_VALIDATION_VERSION).toBe('1.0.0');
  });

  it('defines all 11 built-in baseline descriptors', () => {
    expect(BUILTIN_BASELINE_DESCRIPTORS.length).toBe(11);
    expect(BUILTIN_BASELINE_DESCRIPTORS.map((d) => d.id)).toContain('champion');
    expect(BUILTIN_BASELINE_DESCRIPTORS.map((d) => d.id)).toContain('poisson');
  });
});

describe('ID Generation', () => {
  it('generates IDs with correct prefixes', () => {
    expect(generateScenarioId()).toMatch(/^bvsc_\d{6}$/);
    expect(generateRankingId()).toMatch(/^bvrnk_\d{6}$/);
    expect(generatePromotionId()).toMatch(/^bvprom_\d{6}$/);
    expect(generateStabilityId()).toMatch(/^bvstab_\d{6}$/);
    expect(generateBVReportId()).toMatch(/^bvreport_\d{6}$/);
    expect(generateArtifactId()).toMatch(/^bvart_\d{6}$/);
  });
});

describe('EPIC 17.4 — MetricsEngine', () => {
  const engine = new MetricsEngine();

  it('computes all 20 metrics from outcomes', () => {
    const outcomes = Array.from({ length: 10 }, (_, i) => makeOutcome({
      matchId: `m${i}`,
      profitLoss: i % 2 === 0 ? 1.0 : -0.5,
      actualResult: i % 2 === 0 ? 1 : 0,
    }));
    const metrics = engine.evaluate(outcomes);
    expect(metrics.roi).not.toBe(0);
    expect(metrics.brierScore).toBeGreaterThan(0);
    expect(metrics.sharpeRatio).not.toBe(0);
    expect(metrics.sortinoRatio).not.toBe(0);
    expect(metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(metrics.profitFactor).toBeGreaterThan(0);
  });

  it('returns zeros for empty outcomes', () => {
    const metrics = engine.evaluate([]);
    expect(metrics.roi).toBe(0);
    expect(metrics.sharpeRatio).toBe(0);
    expect(metrics.kellyGrowth).toBe(0);
    expect(metrics.netProfit).toBe(0);
  });

  it('computes hit rate correctly', () => {
    const outcomes = [
      makeOutcome({ actualResult: 1 }),
      makeOutcome({ actualResult: 0.5 }),
      makeOutcome({ actualResult: 0 }),
    ];
    const metrics = engine.evaluate(outcomes);
    expect(metrics.hitRate).toBeCloseTo(0.6667, 3);
    expect(metrics.winRate).toBeCloseTo(0.3333, 3);
    expect(metrics.pushRate).toBeCloseTo(0.3333, 3);
  });
});

describe('EPIC 17.3 — ScenarioEngine', () => {
  const engine = new ScenarioEngine();

  it('filters matches by season', () => {
    const matches = [
      makeMatch('m1', '2024-08-01T12:00:00Z', 'comp:epl', '2024-2025'),
      makeMatch('m2', '2023-08-01T12:00:00Z', 'comp:epl', '2023-2024'),
    ];
    const filtered = engine.filterMatches(matches, { type: 'single_season', label: 'test', seasonIds: ['2024-2025'] });
    expect(filtered.length).toBe(1);
    expect(filtered[0].fixture.season).toBe('2024-2025');
  });

  it('filters matches by league', () => {
    const matches = [
      makeMatch('m1', '2024-08-01T12:00:00Z', 'comp:epl'),
      makeMatch('m2', '2024-08-01T12:00:00Z', 'comp:laliga'),
    ];
    const filtered = engine.filterMatches(matches, { type: 'single_league', label: 'test', leagueIds: ['comp:epl'] });
    expect(filtered.length).toBe(1);
  });

  it('creates a scenario result', () => {
    const result = engine.createScenario({ type: 'single_season', label: 'EPL 2024' }, []);
    expect(result.scenarioId).toMatch(/^bvsc_\d{6}$/);
    expect(result.config.label).toBe('EPL 2024');
  });
});

describe('EPIC 17.5 — StatisticalComparisonEngine', () => {
  const engine = new StatisticalComparisonEngine();

  it('compares two baselines and produces statistics', () => {
    const outcomesA = [makeOutcome({ profitLoss: 0.5 }), makeOutcome({ profitLoss: -0.2 })];
    const outcomesB = [makeOutcome({ profitLoss: 0.8 }), makeOutcome({ profitLoss: -0.1 })];
    const result = engine.comparePaired(
      outcomesA, outcomesB, 'champion' as BaselineId, 'closing_odds' as BaselineId,
      'profit', (o) => o.reduce((s, x) => s + x.profitLoss, 0) / o.length
    );
    expect(result.baselineA).toBe('champion');
    expect(result.baselineB).toBe('closing_odds');
    expect(typeof result.delta).toBe('number');
    expect(typeof result.significant).toBe('boolean');
    expect(result.pValue).toBeGreaterThanOrEqual(0);
    expect(result.pValue).toBeLessThanOrEqual(1);
  });
});

describe('EPIC 17.6 — RankingEngine', () => {
  const engine = new RankingEngine();

  it('ranks baselines by composite score', () => {
    const report = engine.rank([
      { baselineId: 'champion' as BaselineId, metrics: makeMetrics({ roi: 10 }) },
      { baselineId: 'poisson' as BaselineId, metrics: makeMetrics({ roi: 5 }) },
    ], { statisticalSignificance: 0, roi: 1, clv: 0.5, calibration: 0.5, stability: 0.3, drawdown: 0.3, sampleSize: 0.2 });

    expect(report.rankingId).toMatch(/^bvrnk_\d{6}$/);
    expect(report.entries.length).toBe(2);
    expect(report.entries[0].rank).toBe(1);
  });
});

describe('EPIC 17.7 — ChampionValidator', () => {
  const validator = new ChampionValidator();

  it('promotes when all gates pass', () => {
    const criteria: ChampionPromotionCriteria = {
      minRoiCiLower: -5, minClv: -0.1, maxEce: 0.5, minSampleSize: 100,
      requireWalkForwardSuccess: false, requireNoLeakage: false,
      minIntegrityScore: 80, maxDrawdownPct: 50,
    };
    const decision = validator.evaluate('champion' as BaselineId, 'rls_000001', {
      roi: 5, yield_: 0.05, netProfit: 10, expectedValue: 0.1,
      closingLineValue: 0.01, hitRate: 0.5, winRate: 0.4, lossRate: 0.3, pushRate: 0.3,
      brierScore: 0.2, logLoss: 0.5, calibrationError: 0.05,
      maxDrawdown: 0.1, profitFactor: 1.5, sharpeRatio: 0.5, sortinoRatio: 0.7,
      kellyGrowth: 0.1, averageOdds: 2.0, betFrequency: 1.0, expectedVsActual: 0.02,
    }, criteria, { walkForwardSuccess: true, noLeakage: true, integrityScore: 95 });

    expect(decision.promotionId).toMatch(/^bvprom_\d{6}$/);
    expect(decision.passed).toBe(true);
    expect(decision.recommended).toBe(true);
    expect(decision.decisionReport).toContain('PASSED');
  });

  it('rejects when gates fail', () => {
    const criteria: ChampionPromotionCriteria = {
      minRoiCiLower: 10, minClv: 0.5, maxEce: 0.01, minSampleSize: 1000,
      requireWalkForwardSuccess: true, requireNoLeakage: true,
      minIntegrityScore: 99, maxDrawdownPct: 5,
    };
    const decision = validator.evaluate('poisson' as BaselineId, 'rls_000002', {
      roi: 2, yield_: 0.02, netProfit: 1, expectedValue: 0.01,
      closingLineValue: 0.001, hitRate: 0.4, winRate: 0.3, lossRate: 0.4, pushRate: 0.3,
      brierScore: 0.3, logLoss: 0.6, calibrationError: 0.1,
      maxDrawdown: 0.3, profitFactor: 0.8, sharpeRatio: 0.2, sortinoRatio: 0.3,
      kellyGrowth: 0.05, averageOdds: 1.8, betFrequency: 0.9, expectedVsActual: 0.05,
    }, criteria);

    expect(decision.passed).toBe(false);
    expect(decision.recommended).toBe(false);
    expect(decision.decisionReport).toContain('FAILED');
    expect(decision.gates.some((g) => !g.passed)).toBe(true);
  });
});

describe('EPIC 17.8 — StabilityAnalyzer', () => {
  const analyzer = new StabilityAnalyzer();

  it('analyzes stability across confidence buckets', () => {
    const outcomes = [
      makeOutcome({ predictedProbability: 0.3, actualResult: 0, profitLoss: -1 }),
      makeOutcome({ predictedProbability: 0.5, actualResult: 1, profitLoss: 1 }),
      makeOutcome({ predictedProbability: 0.8, actualResult: 1, profitLoss: 1.5 }),
    ];
    const report = analyzer.analyze('champion' as BaselineId, outcomes);
    expect(report.stabilityId).toMatch(/^bvstab_\d{6}$/);
    expect(report.dimensions.length).toBeGreaterThanOrEqual(1);
    expect(typeof report.overallStabilityScore).toBe('number');
  });
});

describe('EPIC 17.9 — BenchmarkReportGenerator', () => {
  const gen = new BenchmarkReportGenerator();

  it('generates a complete benchmark report', () => {
    const report = gen.generateReport({
      datasets: ['ds_000001'],
      replaySessions: ['rls_000001'],
      baselines: ['champion', 'poisson'],
      evaluationMetrics: [],
      championDecision: null,
      evidenceLinks: [],
      datasetFingerprints: [],
      modelVersions: ['1.0.0'],
      recommendations: ['Test recommendation'],
    });
    expect(report.reportId).toMatch(/^bvreport_\d{6}$/);
    expect(report.executiveSummary).toContain('Baseline Validation Report');
    expect(report.recommendations).toContain('Test recommendation');
  });

  it('produces markdown output', () => {
    const report = gen.generateReport({ datasets: [], replaySessions: [], baselines: ['champion'], evaluationMetrics: [], championDecision: null, evidenceLinks: [], datasetFingerprints: [], modelVersions: [], recommendations: [] });
    const md = gen.toMarkdown(report);
    expect(md).toContain('# Baseline Validation Report');
  });
});

describe('EPIC 17.10 — ArtifactIntegration', () => {
  const integration = new ArtifactIntegration();

  it('creates an immutable validation artifact with full traceability', () => {
    const artifact = integration.createArtifact({
      benchmarkReportId: 'bvreport_000001',
      datasetId: 'ds_000001',
      evidenceArtifactId: 'evd_000001',
      replaySessionId: 'rls_000001',
      experimentId: 'exp_000001',
      modelVersion: '2.0.0',
      featureVersion: '3.0.0',
    });
    expect(artifact.artifactId).toMatch(/^bvart_\d{6}$/);
    expect(artifact.immutable).toBe(true);
    expect(artifact.evaluationHash).toMatch(/^[a-f0-9]{16}$/);
    expect(artifact.modelVersion).toBe('2.0.0');
  });
});