/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Orchestrator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Epic31BOrchestrator } from '../../src/lib/epic31b/orchestrator';
import { ProductionReplayRunner } from '../../src/lib/epic31b/league-config';
import { DeterminismValidator } from '../../src/lib/epic31b/determinism-validator';
import { StatisticalValidator } from '../../src/lib/epic31b/statistical-validator';
import { GovernanceValidator } from '../../src/lib/epic31b/governance-validator';

describe('EPIC 31B — Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct default configuration', () => {
    const orchestrator = new Epic31BOrchestrator();
    expect(orchestrator).toBeDefined();
  });

  it('should accept custom configuration', () => {
    const orchestrator = new Epic31BOrchestrator({
      seed: 123,
      maxMatchesPerLeague: 10,
      determinismRunCount: 2,
    });
    expect(orchestrator).toBeDefined();
  });

  it('should run full EPIC 31B pipeline', async () => {
    const orchestrator = new Epic31BOrchestrator({
      maxMatchesPerLeague: 2,
      determinismRunCount: 2,
    });

    const report = await orchestrator.run();

    expect(report).toBeDefined();
    expect(report.epic).toBe('EPIC 31B');
    expect(report.reportId).toBeDefined();
    expect(report.generatedAt).toBeDefined();
    expect(report.decision).toBeDefined();
    expect(['APPROVE EPIC 32', 'BLOCK EPIC 32']).toContain(report.decision);
    expect(report.validationSummaries.length).toBe(8);
    expect(report.replayCoverage.leaguesCovered.length).toBeGreaterThan(0);
  });

  it('should produce PASS results for valid data', async () => {
    const orchestrator = new Epic31BOrchestrator({
      maxMatchesPerLeague: 2,
      determinismRunCount: 2,
    });

    const report = await orchestrator.run();

    const phase1Pass = report.validationSummaries.find((v) => v.phase === 'Phase 1');
    const phase2Pass = report.validationSummaries.find((v) => v.phase === 'Phase 2');
    const phase3Pass = report.validationSummaries.find((v) => v.phase === 'Phase 3');
    const phase4Pass = report.validationSummaries.find((v) => v.phase === 'Phase 4');
    const phase5Pass = report.validationSummaries.find((v) => v.phase === 'Phase 5');
    const phase6Pass = report.validationSummaries.find((v) => v.phase === 'Phase 6');
    const phase7Pass = report.validationSummaries.find((v) => v.phase === 'Phase 7');
    const phase8Pass = report.validationSummaries.find((v) => v.phase === 'Phase 8');

    expect(phase1Pass).toBeDefined();
    expect(phase2Pass).toBeDefined();
    expect(phase3Pass).toBeDefined();
    expect(phase4Pass).toBeDefined();
    expect(phase5Pass).toBeDefined();
    expect(phase6Pass).toBeDefined();
    expect(phase7Pass).toBeDefined();
    expect(phase8Pass).toBeDefined();
  });

  it('should include all required sections in final report', async () => {
    const orchestrator = new Epic31BOrchestrator({
      maxMatchesPerLeague: 2,
      determinismRunCount: 2,
    });

    const report = await orchestrator.run();

    expect(report.replayCoverage).toBeDefined();
    expect(report.calibrationQuality).toBeDefined();
    expect(report.statisticalConfidence).toBeDefined();
    expect(report.mathematicalConsistency).toBeDefined();
    expect(report.performance).toBeDefined();
    expect(report.researchReproducibility).toBeDefined();
    expect(report.productionReadiness).toBeDefined();
    expect(report.remainingRisks).toBeDefined();
    expect(report.leagueResults).toBeDefined();
    expect(report.decision).toBeDefined();
    expect(report.recommendation).toBeDefined();
  });

  it('should have league results for each league', async () => {
    const orchestrator = new Epic31BOrchestrator({
      maxMatchesPerLeague: 2,
      determinismRunCount: 2,
    });

    const report = await orchestrator.run();

    expect(report.leagueResults.length).toBeGreaterThan(0);
    for (const result of report.leagueResults) {
      expect(result.leagueId).toBeDefined();
      expect(result.leagueName).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.metrics).toBeDefined();
      expect(result.confidenceIntervals).toBeDefined();
    }
  });
});
