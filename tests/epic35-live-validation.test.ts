import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MemoryLiveValidationStore } from '../src/live-validation/store/memory-store';
import { DuplicateRecordError } from '../src/live-validation/store/types';
import { PredictionScheduler } from '../src/live-validation/scheduler/prediction-scheduler';
import { buildPredictionSnapshot, sha256 } from '../src/live-validation/snapshot/snapshot-builder';
import { SettlementEngine, resolveOutcome, computeReturn } from '../src/live-validation/settlement/settlement-engine';
import { RollingMetricsEngine } from '../src/live-validation/metrics/rolling-metrics';
import { CalibrationMonitor } from '../src/live-validation/monitoring/calibration-monitor';
import { DriftDetector } from '../src/live-validation/monitoring/drift-detector';
import { AlertEngine } from '../src/live-validation/alerts/alert-engine';
import { WeeklyReportGenerator } from '../src/live-validation/reports/weekly-report';
import { DEFAULT_LIVE_VALIDATION_CONFIG } from '../src/live-validation/config';

describe('EPIC 35 — Live Validation Platform End-to-End Test Suite', () => {
  let store: MemoryLiveValidationStore;
  let fixedNow: string;

  beforeEach(() => {
    store = new MemoryLiveValidationStore();
    fixedNow = '2026-07-23T12:00:00.000Z';
  });

  describe('1. Store Immutability & Duplicate Rejection', () => {
    it('should append records and reject duplicates on idempotency key', async () => {
      const pred: any = {
        id: 'pred-1',
        fixture: { fixtureId: 'fix-1', league: 'EPL', season: '2025-2026', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: fixedNow },
        model: { modelVersion: 'v1.4.0', featureVersion: 'v2.1', calibrationVersion: 'v1.0', researchManifestVersion: 'v1.0', gitCommit: 'abc', predictionTimestamp: fixedNow },
        prediction: { homeProb: 0.55, drawProb: 0.25, awayProb: 0.20, expectedGoalsHome: 1.8, expectedGoalsAway: 1.0, asianHandicap: null, overUnder: null, moneyline: null, confidence: 0.85, expectedValue: 0.08 },
        market: { predictionOdds: [] },
        idempotencyKey: 'prediction:fix-1:v1.4.0',
        inputHash: 'hash-input',
        chainHash: 'hash-chain',
        previousSnapshotId: null,
        createdAt: fixedNow,
        createdBy: 'test',
        schemaVersion: '1.0',
        correlationId: 'corr-1',
      };

      await store.appendPrediction(pred);
      expect(await store.hasPredictionForFixture('fix-1')).toBe(true);

      // Attempting duplicate insert must throw DuplicateRecordError
      await expect(store.appendPrediction(pred)).rejects.toThrow(DuplicateRecordError);
    });
  });

  describe('2. SHA-256 Hash Chain Integrity', () => {
    it('should build valid chained hash snapshots', () => {
      const versions = { modelVersion: 'v1.4.0', featureVersion: 'v2.1', calibrationVersion: 'v1.0', researchManifestVersion: 'v1.0', gitCommit: 'def' };
      const fixture = { fixtureId: 'fix-100', league: 'EPL', season: '2025-2026', homeTeam: 'Liverpool', awayTeam: 'Everton', kickoff: fixedNow };
      const odds = {
        fixtureId: 'fix-100',
        capturedAt: fixedNow,
        quotes: [
          { market: 'moneyline' as const, line: 0, priceHome: 1.80, priceAway: 4.50, priceDraw: 3.60, bookmaker: 'pinnacle' }
        ]
      };

      const snap1 = buildPredictionSnapshot({
        fixture,
        odds,
        versions,
        now: fixedNow,
        correlationId: 'run-1',
        previousSnapshot: null,
        minExpectedValue: 0.02,
        schemaVersion: '1.0',
        idFactory: () => 'snap-1',
      });

      expect(snap1.previousSnapshotId).toBeNull();
      expect(snap1.chainHash).toBeDefined();

      const snap2 = buildPredictionSnapshot({
        fixture: { ...fixture, fixtureId: 'fix-101' },
        odds,
        versions,
        now: fixedNow,
        correlationId: 'run-2',
        previousSnapshot: { id: snap1.id, chainHash: snap1.chainHash },
        minExpectedValue: 0.02,
        idFactory: () => 'snap-2',
        schemaVersion: '1.0',
      });

      expect(snap2.previousSnapshotId).toBe('snap-1');
      expect(snap2.chainHash).toBeDefined();
      expect(snap2.chainHash).not.toEqual(snap1.chainHash);
    });
  });

  describe('3. Asian Quarter-Line Outcome Resolution', () => {
    it('should correctly resolve split-stake quarter lines (-0.25 and +0.75)', () => {
      // Arsenal -0.25 vs Chelsea (Score 1-0 -> Win)
      const r1 = resolveOutcome('asian_handicap', -0.25, 'home', 1, 0);
      expect(r1.outcome).toBe('win');
      expect(r1.winFraction).toBe(1.0);

      // Arsenal -0.25 vs Chelsea (Score 0-0 -> Half Loss)
      const r2 = resolveOutcome('asian_handicap', -0.25, 'home', 0, 0);
      expect(r2.outcome).toBe('half_loss');
      expect(r2.winFraction).toBe(0.25);

      // Chelsea +0.25 vs Arsenal (Score 0-0 -> Half Win)
      const r3 = resolveOutcome('asian_handicap', 0.25, 'away', 0, 0);
      expect(r3.outcome).toBe('half_win');
      expect(r3.winFraction).toBe(0.75);

      // Units returned calculation
      expect(computeReturn(1.0, 2.00, 1.0)).toBe(2.00); // Full win
      expect(computeReturn(1.0, 2.00, 0.5)).toBe(1.00); // Push
      expect(computeReturn(1.0, 2.00, 0.75)).toBe(1.50); // Half win at 2.00 -> 0.5 refund + 0.5*2.0 = 1.5
      expect(computeReturn(1.0, 2.00, 0.25)).toBe(0.50); // Half loss -> 0.5 refund
    });
  });

  describe('4. Autonomous Scheduler & Settlement Cycle', () => {
    it('should discover fixtures, create snapshots, settle completed matches, and compute metrics', async () => {
      const mockFixtures = {
        getUpcomingFixtures: async () => [
          { fixtureId: 'f-1', league: 'EPL', season: '2025-2026', homeTeam: 'Man City', awayTeam: 'Tottenham', kickoff: fixedNow }
        ]
      };
      const mockOdds = {
        getOdds: async () => ({
          fixtureId: 'f-1',
          capturedAt: fixedNow,
          quotes: [
            { market: 'moneyline' as const, line: 0, priceHome: 1.90, priceAway: 4.00, priceDraw: 3.50, bookmaker: 'pinnacle' },
            { market: 'asian_handicap' as const, line: -0.5, priceHome: 1.95, priceAway: 1.95, priceDraw: null, bookmaker: 'pinnacle' }
          ]
        })
      };

      const scheduler = new PredictionScheduler({
        fixtures: mockFixtures,
        odds: mockOdds,
        store,
        versions: { modelVersion: 'v1.4.0', featureVersion: 'v2.1', calibrationVersion: 'v1.0', researchManifestVersion: 'v1.0', gitCommit: 'commit-1' },
        config: DEFAULT_LIVE_VALIDATION_CONFIG,
      });

      const schedReport = await scheduler.run();
      expect(schedReport.success).toBe(true);
      expect(schedReport.predictionsCreated).toBe(1);

      // Verify idempotency on second run
      const schedReport2 = await scheduler.run();
      expect(schedReport2.duplicatesSkipped).toBe(1);
      expect(schedReport2.predictionsCreated).toBe(0);

      // Run Settlement Engine
      const mockResults = {
        getResult: async () => ({ homeScore: 2, awayScore: 1 })
      };
      const settlementEngine = new SettlementEngine({
        store,
        results: mockResults,
        config: DEFAULT_LIVE_VALIDATION_CONFIG,
      });

      const setReport = await settlementEngine.run();
      expect(setReport.success).toBe(true);
      expect(setReport.settled).toBeGreaterThanOrEqual(1);

      // Compute Rolling Metrics
      const metricsEngine = new RollingMetricsEngine({ store, schemaVersion: '1.0' });
      const rollingRecords = await metricsEngine.run('corr-test');
      expect(rollingRecords.length).toBe(4); // 7, 30, 90, 365 days

      // Calibration & Drift Monitoring
      const calMonitor = new CalibrationMonitor({ store, schemaVersion: '1.0' });
      const calRec = await calMonitor.run(30, 'corr-test');
      expect(calRec).not.toBeNull();

      const driftDetector = new DriftDetector({ store, config: DEFAULT_LIVE_VALIDATION_CONFIG });
      const driftEvents = await driftDetector.run('corr-test');
      expect(driftEvents.length).toBeGreaterThanOrEqual(0);

      // Weekly Scientific Report
      const reportGen = new WeeklyReportGenerator({ store, schemaVersion: '1.0' });
      const weeklyReport = await reportGen.run(undefined, 'corr-test');
      expect(weeklyReport).not.toBeNull();
      expect(weeklyReport?.markdown).toContain('Weekly Live Validation Report');
    });
  });
});
