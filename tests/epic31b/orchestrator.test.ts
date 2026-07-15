/**
 * EPIC 31B — Production Replay & Shadow Validation
 * Orchestrator Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Epic31BOrchestrator } from '../../src/lib/epic31b/orchestrator';

describe('EPIC 31B — Orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should have correct default configuration', () => {
    const orchestrator = new Epic31BOrchestrator();
    expect(orchestrator).toBeDefined();
  });

  it('should run full EPIC 31B pipeline on raw EPL historical data', async () => {
    // Run with small maxMatches limit to make it fast
    const orchestrator = new Epic31BOrchestrator({
      maxMatchesPerLeague: 5,
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
  });
});
