import { describe, it, expect } from 'vitest';
import { AhHistoryService } from '../../src/lib/services/ahHistoryService';
import { AhUpcomingService } from '../../src/lib/services/ahUpcomingService';
import { AhDecisionEngine } from '../../src/lib/decision/ahDecisionEngine';

describe('Salmo AH — API & Domain Consistency Tests', () => {
  it('ensures history query produces valid structure matching API schema', () => {
    const res = AhHistoryService.queryObservations({ league: 'ENG-PL', limit: 20 });

    expect(res.filtersApplied).toBeDefined();
    expect(res.summary).toBeDefined();
    expect(res.summary.sampleSize).toBeGreaterThan(0);
    expect(res.summary.hitRatePct).toBeGreaterThanOrEqual(0);
    expect(res.totalMatchesAvailable).toBeGreaterThan(0);
    expect(Array.isArray(res.observations)).toBe(true);
    expect(res.datasetUpdated).toBeDefined();
  });

  it('ensures league breakdown returns all available lines with two-sided metrics', () => {
    const breakdown = AhHistoryService.getLeagueBreakdown('ENG-PL');

    expect(breakdown.leagueId).toBe('ENG-PL');
    expect(breakdown.totalObservations).toBeGreaterThan(0);
    expect(Array.isArray(breakdown.lines)).toBe(true);

    if (breakdown.lines.length > 0) {
      const line0 = breakdown.lines[0];
      expect(line0.line).toBeDefined();
      expect(line0.homeMetrics).toBeDefined();
      expect(line0.awayMetrics).toBeDefined();
    }
  });

  it('ensures match calculation trace returns valid quarter-line math', () => {
    const res = AhHistoryService.queryObservations({ limit: 10 });
    const match = res.observations.find((o) => Math.abs(o.selectionLine % 0.5) === 0.25);

    if (match) {
      const trace = AhHistoryService.getMatchCalculationTrace(match.observationId);
      expect(trace).not.toBeNull();
      expect(trace?.isQuarterLine).toBe(true);
      expect(trace?.componentLines).toHaveLength(2);
      expect(trace?.componentOutcomes).toHaveLength(2);
    }
  });

  it('ensures upcoming service output maps cleanly into Salmo decision payload', async () => {
    const res = await AhUpcomingService.getUpcomingAhFixtures({ daysAhead: 7, limit: 10 });

    expect(res.totalFixtures).toBe(res.fixtures.length);
    for (const f of res.fixtures) {
      expect(f.decisionHome.badge).toBeDefined();
      expect(f.decisionHome.drilldownExplanation).toBeDefined();
      expect(f.decisionHome.drilldownExplanation.probabilityAssessment).toBeDefined();
      expect(f.decisionHome.drilldownExplanation.valueAssessment).toBeDefined();
    }
  });
});
