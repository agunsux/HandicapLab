// HandicapLab Gold Dataset & Time Travel Calibration Tests
// Location: tests/decision-engine-v1/gold-dataset.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { ParquetHelper } from '../../src/lib/data-platform/parquetHelper';
import { FootballDataCSVAdapter } from '../../src/lib/data-platform/footballDataCSVAdapter';
import { GoldDatasetBuilder } from '../../src/lib/data-platform/goldDatasetBuilder';
import { GoldValidator } from '../../src/lib/data-platform/goldValidator';
import { TimeTravelSnapshot } from '../../src/lib/data-platform/timeTravel';
import { CalibrationEngine } from '../../src/lib/data-platform/calibration';
import { BacktestRunner } from '../../src/lib/data-platform/backtestRunner';
import { CanonicalFixture, CanonicalOdds } from '../../src/lib/data-platform/canonicalModel';

const TEST_DIR = path.join(__dirname, 'temp-gold-test');

describe('Sprint 27: Gold Lakehouse Dataset & Time Travel Verification', () => {

  beforeEach(() => {
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    if (fs.existsSync(TEST_DIR)) {
      fs.rmSync(TEST_DIR, { recursive: true, force: true });
    }
  });

  describe('Parquet Helper Gzip JSONL Serialization', () => {
    it('should write and read back tabular rows deterministically', () => {
      const pPath = path.join(TEST_DIR, 'test_table.parquet');
      const rows = [
        { id: '1', name: 'Arsenal', elo: 1600 },
        { id: '2', name: 'Chelsea', elo: 1550 }
      ];

      ParquetHelper.writeSync(pPath, rows);
      expect(fs.existsSync(pPath)).toBe(true);

      const loaded = ParquetHelper.readSync(pPath);
      expect(loaded).toHaveLength(2);
      expect(loaded[0].name).toBe('Arsenal');
      expect(loaded[1].elo).toBe(1550);
    });
  });

  describe('Football Data CSV Adapter Timeline Expansion', () => {
    it('should generate standardized Canonical Models and complete odds timeline', () => {
      const mockRow = {
        Date: '12/09/2020',
        Time: '12:30',
        HomeTeam: 'Fulham',
        AwayTeam: 'Arsenal',
        FTHG: '0',
        FTAG: '3',
        FTR: 'A',
        Referee: 'C Kavanagh',
        B365H: '6.0',
        B365D: '4.33',
        B365A: '1.53',
        B365CH: '5.5',
        B365CD: '4.0',
        B365CA: '1.66'
      };

      const result = FootballDataCSVAdapter.parseCSVRow(mockRow, 0, '2020-2021');
      expect(result.fixture.homeTeam.name).toBe('Fulham');
      expect(result.fixture.awayTeam.name).toBe('Arsenal');
      expect(result.fixture.fullTimeHomeGoals).toBe(0);
      expect(result.fixture.fullTimeAwayGoals).toBe(3);
      expect(result.fixture.referee).toBe('C Kavanagh');

      // Timeline events check: opened, 6h before, 3h before, 1h before, closed
      expect(result.events).toHaveLength(5);
      expect(result.events[0].eventType).toBe('OddsOpened');
      expect(result.events[4].eventType).toBe('OddsClosed');

      // Verify lineups
      expect(result.lineups).toHaveLength(32); // 16 home players, 16 away players
      expect(result.lineups.filter(x => x.role === 'STARTER')).toHaveLength(22);
    });
  });

  describe('Gold Validator Automatic Quality Scoring', () => {
    const dummyFixture: CanonicalFixture = {
      id: 'fix-1',
      providerId: 'csv-0',
      provider: 'FootballData',
      competition: { id: 'EPL', name: 'EPL', region: 'England' },
      homeTeam: { id: 'arsenal', name: 'Arsenal' },
      awayTeam: { id: 'chelsea', name: 'Chelsea' },
      kickoffTime: '2024-09-12T15:00:00Z',
      status: 'FINISHED',
      schemaVersion: '1.0.0',
      fullTimeHomeGoals: 2,
      fullTimeAwayGoals: 1
    };

    const dummyOddsOpen: CanonicalOdds[] = [
      { fixtureId: 'fix-1', provider: 'Pinnacle', marketType: 'ML', selection: 'home', oddsDecimal: 2.0, impliedProbability: 0.5, receivedAt: '2024-09-10T15:00:00Z', providerTimestamp: '2024-09-10T15:00:00Z', processedTimestamp: '2024-09-10T15:00:00Z', latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId: 'fix-1', provider: 'Pinnacle', marketType: 'ML', selection: 'draw', oddsDecimal: 3.2, impliedProbability: 0.3125, receivedAt: '2024-09-10T15:00:00Z', providerTimestamp: '2024-09-10T15:00:00Z', processedTimestamp: '2024-09-10T15:00:00Z', latencyMs: 5, normalizerVersion: '1.0' },
      { fixtureId: 'fix-1', provider: 'Pinnacle', marketType: 'ML', selection: 'away', oddsDecimal: 3.5, impliedProbability: 0.2857, receivedAt: '2024-09-10T15:00:00Z', providerTimestamp: '2024-09-10T15:00:00Z', processedTimestamp: '2024-09-10T15:00:00Z', latencyMs: 5, normalizerVersion: '1.0' }
    ];

    it('should validate clean dataset with 100/100 score', () => {
      const report = GoldValidator.validate([dummyFixture], dummyOddsOpen, dummyOddsOpen);
      expect(report.score).toBe(100);
      expect(report.passed).toBe(true);
    });

    it('should deduct scores and fail validation on impossible outcomes or mismatched data', () => {
      const corruptFixture: CanonicalFixture = {
        ...dummyFixture,
        fullTimeHomeGoals: -5 // impossible score
      };

      const report = GoldValidator.validate([corruptFixture], dummyOddsOpen, dummyOddsOpen);
      expect(report.score).toBeLessThan(95);
      expect(report.passed).toBe(false);
    });

    it('should deduct scores on timezone mismatches and duplicate records', () => {
      const nonUtcFixture: CanonicalFixture = {
        ...dummyFixture,
        kickoffTime: '2024-09-12 15:00:00' // lacks 'Z' or offset
      };

      const report = GoldValidator.validate([nonUtcFixture], dummyOddsOpen, dummyOddsOpen);
      expect(report.score).toBeLessThan(100);
      expect(report.timezoneMismatchCount).toBe(1);
    });
  });

  describe('Time Travel Leakage Prevention Snapshotting', () => {
    it('should completely mask results of fixtures played at or after cutoff timestamp', () => {
      const fixtures: CanonicalFixture[] = [
        { id: 'f1', providerId: '0', provider: 'M', competition: { id: '1', name: 'L', region: 'R' }, homeTeam: { id: 'a', name: 'Arsenal' }, awayTeam: { id: 'c', name: 'Chelsea' }, kickoffTime: '2024-09-12T15:00:00Z', status: 'FINISHED', schemaVersion: '1.0.0', fullTimeHomeGoals: 2, fullTimeAwayGoals: 1 },
        { id: 'f2', providerId: '1', provider: 'M', competition: { id: '1', name: 'L', region: 'R' }, homeTeam: { id: 'm', name: 'Man Utd' }, awayTeam: { id: 'l', name: 'Liverpool' }, kickoffTime: '2024-09-15T15:00:00Z', status: 'FINISHED', schemaVersion: '1.0.0', fullTimeHomeGoals: 0, fullTimeAwayGoals: 3 }
      ];

      // Setup temp gold dir
      ParquetHelper.writeSync(path.join(TEST_DIR, 'fixtures.parquet'), fixtures);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'odds_open.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'odds_close.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'lineups.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'injuries.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'standings.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'elo.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'referees.parquet'), []);
      ParquetHelper.writeSync(path.join(TEST_DIR, 'team_stats.parquet'), []);

      const cutoff = new Date('2024-09-14T12:00:00Z');
      const snapshot = new TimeTravelSnapshot(cutoff, TEST_DIR);

      const resolved = snapshot.getFixtures();
      expect(resolved).toHaveLength(2);

      // Match 1 is before cutoff -> Goals are preserved
      expect(resolved[0].fullTimeHomeGoals).toBe(2);

      // Match 2 is after cutoff -> Goals are strictly MASKED to prevent temporal lookahead leakage
      expect(resolved[1].fullTimeHomeGoals).toBeNull();
      expect(resolved[1].status).toBe('SCHEDULED');
    });
  });

  describe('Calibration Metrics & ECE calculation', () => {
    it('should compute Expected Calibration Error and Maximum Calibration Error accurately', () => {
      const preds = [
        { probability: 0.9, outcome: 1 },
        { probability: 0.95, outcome: 1 },
        { probability: 0.1, outcome: 0 },
        { probability: 0.5, outcome: 0 } // confidence 0.5, outcome 0.0 -> error = 0.5
      ];

      const ece = CalibrationEngine.calculateECE(preds, 5);
      const mce = CalibrationEngine.calculateMCE(preds, 5);

      expect(ece).toBeGreaterThan(0.0);
      expect(mce).toBeCloseTo(0.5, 2);
    });

    it('should correctly fit Platt Scaling parameters and run Isotonic Regression', () => {
      const preds = [
        { probability: 0.8, outcome: 1 },
        { probability: 0.7, outcome: 1 },
        { probability: 0.2, outcome: 0 },
        { probability: 0.3, outcome: 0 }
      ];

      const platt = CalibrationEngine.fitPlattScaling(preds);
      expect(platt.A).toBeGreaterThan(0);

      const isotonicFitter = CalibrationEngine.fitIsotonicRegression(preds);
      expect(isotonicFitter(0.75)).toBeGreaterThan(0.5);
      expect(isotonicFitter(0.25)).toBeLessThan(0.5);
    });
  });
});
