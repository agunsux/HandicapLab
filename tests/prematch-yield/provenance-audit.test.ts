import { describe, it, expect } from 'vitest';
import {
  pearsonCorrelation,
  medianValue,
  runProvenanceAudit,
  PairedFixtureOdds,
} from '../../src/lib/research/prematch-yield/provenanceAudit';

describe('Prematch Yield Provenance Audit (Task 5)', () => {
  it('computes exact Pearson correlation on known reference vectors', () => {
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBe(1.0);
    expect(pearsonCorrelation([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBe(-1.0);
    expect(pearsonCorrelation([1, 2, 3], [1, 2, 3])).toBe(1.0);
  });

  it('computes median values accurately for odd and even lists', () => {
    expect(medianValue([10, 20, 30])).toBe(20);
    expect(medianValue([10, 20, 30, 40])).toBe(25);
    expect(medianValue([0.05, 0.02, 0.09])).toBe(0.05);
  });

  it('evaluates Gate G-E and Gate G-F fail-closed on deviating quotes', () => {
    // Generate synthetic paired fixtures with heavy retail noise (r < 0.95 and high spread)
    const fixtures: PairedFixtureOdds[] = [
      {
        canonicalId: 'match-1',
        matchDate: '2024-08-16',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        footy: {
          odds_ft_1: 2.10,
          odds_ft_x: 3.40,
          odds_ft_2: 3.50,
          odds_ft_over25: 2.30, // wide deviation from 1.95
          odds_ft_under25: 1.65,
          odds_btts_yes: 1.80,
          odds_btts_no: 2.00,
        },
        pinnacle: {
          mlOpening: { home: 2.05, draw: 3.50, away: 3.60 },
          mlClosing: { home: 2.02, draw: 3.55, away: 3.65 },
          ouOpening: { over: 1.95, under: 1.95 },
          ouClosing: { over: 1.90, under: 2.00 },
        },
      },
      {
        canonicalId: 'match-2',
        matchDate: '2024-08-17',
        homeTeam: 'Team C',
        awayTeam: 'Team D',
        footy: {
          odds_ft_1: 1.50,
          odds_ft_x: 4.20,
          odds_ft_2: 6.50,
          odds_ft_over25: 1.55,
          odds_ft_under25: 2.45,
          odds_btts_yes: 1.95,
          odds_btts_no: 1.85,
        },
        pinnacle: {
          mlOpening: { home: 1.52, draw: 4.30, away: 6.80 },
          mlClosing: { home: 1.48, draw: 4.40, away: 7.20 },
          ouOpening: { over: 1.85, under: 2.05 }, // wide deviation: footy 1.55 vs pin 1.85
          ouClosing: { over: 1.80, under: 2.10 },
        },
      },
    ];

    const report = runProvenanceAudit(fixtures, '2024-2025');

    expect(report.pairedFixtureCount).toBe(2);
    // Gate G-E target: r >= 0.95 & medDiff <= 0.05
    // Here diffs are 0.35 and 0.30 -> medDiff > 0.05
    expect(report.gates.gateGE.status).toBe('BLOCKED');
    expect(report.gates.gateGF.status).toBe('BLOCKED');
    expect(report.provenanceStatus).toBe('FAILED_PROVENANCE');
  });

  it('measures overround discrepancy accurately', () => {
    // FootyStats: 1.90 / 1.90 -> 1/1.90 + 1/1.90 - 1 = ~5.26%
    // Pinnacle: 1.96 / 1.96 -> 1/1.96 + 1/1.96 - 1 = ~2.04%
    const fixtures: PairedFixtureOdds[] = [
      {
        canonicalId: 'match-1',
        matchDate: '2024-08-16',
        homeTeam: 'Team A',
        awayTeam: 'Team B',
        footy: {
          odds_ft_1: 2.50,
          odds_ft_x: 3.20,
          odds_ft_2: 3.00,
          odds_ft_over25: 1.90,
          odds_ft_under25: 1.90,
          odds_btts_yes: null,
          odds_btts_no: null,
        },
        pinnacle: {
          mlOpening: { home: 2.60, draw: 3.30, away: 3.10 },
          mlClosing: { home: 2.60, draw: 3.30, away: 3.10 },
          ouOpening: { over: 1.96, under: 1.96 },
          ouClosing: { over: 1.96, under: 1.96 },
        },
      },
    ];

    const report = runProvenanceAudit(fixtures, '2024-2025');
    expect(report.overroundAudit.ou25.footystatsMedianOverroundPct).toBeCloseTo(5.26, 1);
    expect(report.overroundAudit.ou25.pinnacleOpenMedianOverroundPct).toBeCloseTo(2.04, 1);
  });
});

