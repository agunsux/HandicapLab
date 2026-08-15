import { describe, it, expect } from 'vitest';
import {
  extractRealOddsFromCsv,
  pairRealOdds,
  settleRealOutcome,
  profitOfOutcome,
  buildRealOddsDataset,
} from '../src/historical/realOdds/ingest';
import {
  vigFreeProb3,
  vigFreeProb2,
  modelAhProbs,
  modelOuProbs,
  maxDrawdown,
  roiCi,
  runRealOddsValidation,
} from '../src/historical/realOdds/validate';
import * as fs from 'fs';
import * as path from 'path';

describe('Real Odds Ingest', () => {
  it('should extract real Pinnacle opening and closing odds from CSV', () => {
    const csv = path.resolve(process.cwd(), 'data', 'bronze', 'football_data', '2023-2024.csv');
    const records = extractRealOddsFromCsv(csv);
    expect(records.length).toBeGreaterThan(0);
    const mlEntry = records.find((r) => r.market === 'ML' && r.odds_type === 'entry');
    const mlClose = records.find((r) => r.market === 'ML' && r.odds_type === 'closing');
    expect(mlEntry).toBeDefined();
    expect(mlClose).toBeDefined();
    expect(mlEntry!.source_type).toBe('REAL_PROVIDER');
    expect(mlEntry!.odds).toBeGreaterThan(1.0);
    expect(mlEntry!.match_id).toMatch(/^EPL-2023-2024-/);
  });

  it('should pair entry and closing into single records', () => {
    const csv = path.resolve(process.cwd(), 'data', 'bronze', 'football_data', '2023-2024.csv');
    const pairs = pairRealOdds(extractRealOddsFromCsv(csv));
    expect(pairs.length).toBeGreaterThan(0);
    const withBoth = pairs.filter((p) => p.entry && p.closing);
    expect(withBoth.length).toBeGreaterThan(0);
    const ml = withBoth.find((p) => p.market === 'ML' && p.selection === 'home');
    expect(ml).toBeDefined();
    expect(ml!.entry!.odds).toBeGreaterThan(1.0);
    expect(ml!.closing!.odds).toBeGreaterThan(1.0);
  });

  it('should include Asian Handicap quarter lines', () => {
    const csv = path.resolve(process.cwd(), 'data', 'bronze', 'football_data', '2023-2024.csv');
    const pairs = pairRealOdds(extractRealOddsFromCsv(csv));
    const ahQuarter = pairs.filter((p) => p.market === 'AH' && p.line !== null && (Math.abs(p.line! % 1) === 0.25 || Math.abs(p.line! % 1) === 0.75));
    expect(ahQuarter.length).toBeGreaterThan(0);
  });
});

describe('Vig-free probability', () => {
  it('should normalize three-way market removing overround', () => {
    const p = vigFreeProb3(2.0, 3.5, 4.0);
    const sum = p.home + p.draw + p.away;
    expect(sum).toBeCloseTo(1.0, 6);
    expect(p.home).toBeGreaterThan(p.away);
  });

  it('should normalize two-way market', () => {
    const p = vigFreeProb2(1.9, 1.9);
    expect(p.x + p.y).toBeCloseTo(1.0, 6);
    expect(p.x).toBeCloseTo(0.5, 4);
  });
});

describe('Model probability at line', () => {
  it('should produce bounded AH probabilities for quarter lines', () => {
    const p = modelAhProbs(1.5, 1.2, -0.25);
    expect(p.home).toBeGreaterThan(0);
    expect(p.home).toBeLessThan(1);
    expect(p.home + p.away).toBeCloseTo(1.0, 6);
  });

  it('should produce bounded OU probabilities', () => {
    const p = modelOuProbs(1.5, 1.2, 2.5);
    expect(p.over).toBeGreaterThan(0);
    expect(p.over).toBeLessThan(1);
    expect(p.over + p.under).toBeCloseTo(1.0, 6);
  });
});

describe('Quarter-line settlement', () => {
  it('should settle AH -0.25 as WIN when home wins by 1 (both halves win)', () => {
    expect(settleRealOutcome('AH', 'home', -0.25, 2, 1)).toBe('WIN');
  });

  it('should settle AH -0.25 as HALF_LOSS on a draw', () => {
    expect(settleRealOutcome('AH', 'home', -0.25, 1, 1)).toBe('HALF_LOSS');
  });

  it('should settle AH +0.25 as HALF_WIN on a draw', () => {
    expect(settleRealOutcome('AH', 'home', 0.25, 1, 1)).toBe('HALF_WIN');
  });

  it('should settle AH -0.5 as WIN when home wins by 1', () => {
    expect(settleRealOutcome('AH', 'home', -0.5, 1, 0)).toBe('WIN');
  });

  it('should settle AH 0 as PUSH on a draw', () => {
    expect(settleRealOutcome('AH', 'home', 0, 1, 1)).toBe('PUSH');
  });

  it('should settle OU 2.5 correctly', () => {
    expect(settleRealOutcome('OU25', 'over', 2.5, 2, 1)).toBe('WIN');
    expect(settleRealOutcome('OU25', 'under', 2.5, 2, 0)).toBe('WIN');
  });
});

describe('Profit of outcome', () => {
  it('should compute half-win profit', () => {
    expect(profitOfOutcome('HALF_WIN', 2.0)).toBeCloseTo(0.5, 6);
  });
  it('should compute half-loss', () => {
    expect(profitOfOutcome('HALF_LOSS', 2.0)).toBeCloseTo(-0.5, 6);
  });
  it('should compute push as zero', () => {
    expect(profitOfOutcome('PUSH', 2.0)).toBe(0);
  });
});

describe('Drawdown and CI', () => {
  it('should compute max drawdown from profit series', () => {
    expect(maxDrawdown([1, -1, 1, -2])).toBe(-2);
    expect(maxDrawdown([1, 1, 1])).toBe(0);
  });

  it('should compute ROI CI', () => {
    const ci = roiCi([1, -1, 1, -1], [1, 1, 1, 1]);
    expect(ci).not.toBeNull();
    expect(ci!.roi).toBeCloseTo(0, 6);
    expect(ci!.ci95[0]).toBeLessThanOrEqual(0);
    expect(ci!.ci95[1]).toBeGreaterThanOrEqual(0);
  });
});

describe('Real odds validation (end-to-end, deterministic)', () => {
  it('should build real odds dataset', () => {
    const r = buildRealOddsDataset();
    expect(r.records).toBeGreaterThan(0);
    expect(r.pairs).toBeGreaterThan(0);
    expect(fs.existsSync(r.file)).toBe(true);
  });

  it('should run validation deterministically and report honest status', () => {
    const r1 = runRealOddsValidation();
    const r2 = runRealOddsValidation();
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
    expect(r1['total_bets']).toBeGreaterThan(0);
    // status must be one of the honest classifiers, never fabricated PROFITABLE
    expect(['INSUFFICIENT_EVIDENCE', 'NOT_PROFITABLE', 'NOT_PROFITABLE_YET_POSITIVE', 'PROFITABILITY_VALIDATED']).toContain(r1['profitability_status']);
  });
});
