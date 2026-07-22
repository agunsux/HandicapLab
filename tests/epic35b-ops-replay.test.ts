import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryLiveValidationStore } from '../src/live-validation/store/memory-store';
import { JobRunner } from '../src/live-validation/ops/job-runner';
import { ScientificEvidenceArchiver } from '../src/live-validation/archive/evidence-archiver';
import { DeterministicReplayEngine } from '../src/live-validation/replay/replay-engine';
import { buildPredictionSnapshot } from '../src/live-validation/snapshot/snapshot-builder';
import fs from 'fs';
import path from 'path';

describe('EPIC 35B — Production Operations & Scientific Evidence Test Suite', () => {
  let store: MemoryLiveValidationStore;
  let fixedNow: string;

  beforeEach(() => {
    store = new MemoryLiveValidationStore();
    fixedNow = new Date().toISOString();
  });

  describe('1. Job Execution Logging & DLQ (EPIC 35.11 / 35.12)', () => {
    it('should track job run status, calculate duration, and record DLQ items', async () => {
      const run = await JobRunner.startRun('scheduler', 'test-corr-1');
      expect(run.status).toBe('running');

      const finished = await JobRunner.finishRun(run, {
        status: 'succeeded',
        itemsProcessed: 5,
      });

      expect(finished.status).toBe('succeeded');
      expect(finished.durationMs).toBeGreaterThanOrEqual(0);

      const dlq = await JobRunner.pushToDlq({
        jobName: 'scheduler',
        entityType: 'fixture',
        entityId: 'fix-err-1',
        errorCode: 'ODDS_FETCH_TIMEOUT',
        errorMessage: 'Pinnacle API timed out after 5000ms',
        correlationId: 'test-corr-1',
      });

      expect(dlq.entityId).toBe('fix-err-1');
      expect(dlq.resolved).toBe(false);
    });
  });

  describe('2. Scientific Evidence Archive Generation (EPIC 35.13)', () => {
    it('should generate structured daily validation archive under data/validation/YYYY/MM/DD/', async () => {
      const versions = { modelVersion: 'v1.4.0', featureVersion: 'v2.1', calibrationVersion: 'v1.0', researchManifestVersion: 'v1.0', gitCommit: 'commit-123' };
      const fixture = { fixtureId: 'fix-arch-1', league: 'EPL', season: '2025-2026', homeTeam: 'Arsenal', awayTeam: 'Chelsea', kickoff: fixedNow };
      const odds = {
        fixtureId: 'fix-arch-1',
        capturedAt: fixedNow,
        quotes: [
          { market: 'moneyline' as const, line: 0, priceHome: 2.10, priceAway: 3.40, priceDraw: 3.20, bookmaker: 'pinnacle' }
        ]
      };

      const snap = buildPredictionSnapshot({
        fixture,
        odds,
        versions,
        now: fixedNow,
        correlationId: 'run-arch',
        previousSnapshot: null,
        minExpectedValue: 0.02,
        schemaVersion: '1.0',
      });

      await store.appendPrediction(snap);

      const tempDir = path.join(process.cwd(), 'scratch', 'test-validation-archive');
      const archiver = new ScientificEvidenceArchiver(store, tempDir);
      const result = await archiver.exportDailyArchive();

      expect(result.archivePath).toBeDefined();
      expect(result.manifest.predictionsCount).toBe(1);
      expect(result.manifest.files.length).toBe(3);

      const manifestFile = path.join(result.archivePath, 'evidence_manifest.json');
      expect(fs.existsSync(manifestFile)).toBe(true);

      const manifestContent = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
      expect(manifestContent.archiveDate).toBe(new Date().toISOString().slice(0, 10));

      // Clean up scratch dir
      fs.rmSync(tempDir, { recursive: true, force: true });
    });
  });

  describe('3. Deterministic Single-Prediction Bit-Exact Replay (EPIC 35.14)', () => {
    it('should perform bit-exact replay audit on any historical prediction snapshot', async () => {
      const versions = { modelVersion: 'v1.4.0', featureVersion: 'v2.1', calibrationVersion: 'v1.0', researchManifestVersion: 'v1.0', gitCommit: 'commit-999' };
      const fixture = { fixtureId: 'fix-replay-1', league: 'La Liga', season: '2025-2026', homeTeam: 'Real Madrid', awayTeam: 'Barcelona', kickoff: fixedNow };
      const odds = {
        fixtureId: 'fix-replay-1',
        capturedAt: fixedNow,
        quotes: [
          { market: 'moneyline' as const, line: 0, priceHome: 2.05, priceAway: 3.50, priceDraw: 3.30, bookmaker: 'pinnacle' },
          { market: 'asian_handicap' as const, line: -0.5, priceHome: 1.90, priceAway: 1.90, priceDraw: null, bookmaker: 'pinnacle' },
        ]
      };

      const snap = buildPredictionSnapshot({
        fixture,
        odds,
        versions,
        now: fixedNow,
        correlationId: 'run-replay',
        previousSnapshot: null,
        minExpectedValue: 0.02,
        idFactory: () => 'pred-replay-target',
        schemaVersion: '1.0',
      });

      await store.appendPrediction(snap);

      const replayEngine = new DeterministicReplayEngine(store);
      const cert = await replayEngine.replayPrediction('pred-replay-target');

      expect(cert.auditPassed).toBe(true);
      expect(cert.integrity.bitExactProbabilityMatch).toBe(true);
      expect(cert.integrity.inputHashMatch).toBe(true);
      expect(cert.lineage.modelVersion).toBe('v1.4.0');
      expect(cert.lineage.gitCommit).toBe('commit-999');
      expect(cert.deltas.homeProbDelta).toBe(0);
      expect(cert.deltas.drawProbDelta).toBe(0);
      expect(cert.deltas.awayProbDelta).toBe(0);
    });
  });
});
