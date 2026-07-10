// Replay Engine Unit Tests
// Location: tests/replay-engine.test.ts

import { describe, it, expect } from 'vitest';
import {
  ReplayRunner,
  createReplayContext,
  validateDataset,
  JsonDatasetLoader,
  MockReplayDataProvider,
  MOCK_FIXTURES,
  MOCK_ODDS,
  MOCK_RESULTS,
} from '../src/lib/replay/index';
import type {
  HistoricalMatch,
  Predictor,
  ReplayConfig,
} from '../src/lib/replay/index';

// ─── Mock Predictor ──────────────────────────────────────────────────────

class MockPredictor implements Predictor {
  async predict(features: Record<string, unknown>, marketOdds: number, marketSelection: string) {
    if (features.matchId === 'epl-005' || features.matchId === 'epl-010' || features.matchId === 'epl-012') {
      // Draw matches — predict roughly 50/50
      return { homeProbability: 0.45, drawProbability: 0.30, awayProbability: 0.25, expectedValue: 0.05, kellyFraction: 0.05, stake: 0.05 };
    }
    // Home wins — predict home strong
    return { homeProbability: 0.65, drawProbability: 0.20, awayProbability: 0.15, expectedValue: 0.15, kellyFraction: 0.10, stake: 0.10 };
  }
}

// ─── Tests ───────────────────────────────────────────────────────────────

describe('Replay Engine', () => {
  describe('MockReplayDataProvider', () => {
    it('loads 15 mock EPL matches', async () => {
      const provider = new MockReplayDataProvider();
      const ctx = createReplayContext({ provider: 'test', leagueId: '39' });
      const matches = await provider.loadMatches(ctx);
      expect(matches).toHaveLength(15);
    });

    it('each match has fixture, odds, and result', async () => {
      const provider = new MockReplayDataProvider();
      const ctx = createReplayContext({ provider: 'test' });
      const matches = await provider.loadMatches(ctx);
      for (const m of matches) {
        expect(m.fixture).toBeDefined();
        expect(m.fixture.id).toBeTruthy();
        expect(m.odds.length).toBeGreaterThan(0);
        expect(m.result).toBeDefined();
      }
    });
  });

  describe('DatasetLoader (JSON)', () => {
    it('parses a valid dataset from object', () => {
      const loader = new JsonDatasetLoader();
      const dataset = { fixtures: MOCK_FIXTURES, odds: MOCK_ODDS, results: MOCK_RESULTS };
      const loaded = loader.loadFromObject(dataset);
      expect(loaded.fixtures).toHaveLength(15);
      expect(loaded.odds).toHaveLength(15);
      expect(loaded.results).toHaveLength(15);
      expect(loaded.errors).toHaveLength(0);
    });

    it('returns errors for empty fixtures', () => {
      const loader = new JsonDatasetLoader();
      const loaded = loader.loadFromObject({ fixtures: [], odds: [], results: [] });
      expect(loaded.errors.length).toBeGreaterThan(0);
      expect(loaded.errors[0].severity).toBe('error');
    });

    it('returns errors for invalid data', () => {
      const loader = new JsonDatasetLoader();
      const loaded = loader.loadFromObject(null);
      expect(loaded.errors.length).toBeGreaterThan(0);
    });
  });

  describe('Validator', () => {
    it('validates valid matches successfully', () => {
      const matches: HistoricalMatch[] = MOCK_FIXTURES.map((f) => ({
        fixture: f,
        odds: MOCK_ODDS.filter((o) => o.fixtureId === f.id),
        result: MOCK_RESULTS.find((r) => r.fixtureId === f.id),
      }));
      const ctx = createReplayContext({ provider: 'test' });
      const report = validateDataset(matches, ctx);
      expect(report.totalFixtures).toBe(15);
      expect(report.validFixtures).toBe(15);
      expect(report.invalidFixtures).toBe(0);
    });

    it('detects missing home team', () => {
      const badFixture = { ...MOCK_FIXTURES[0], homeTeam: '' };
      const matches: HistoricalMatch[] = [{
        fixture: badFixture,
        odds: [],
        result: MOCK_RESULTS[0],
      }];
      const ctx = createReplayContext({ provider: 'test' });
      const report = validateDataset(matches, ctx);
      expect(report.validFixtures).toBe(0);
      expect(report.validationErrors.some((e) => e.field === 'homeTeam')).toBe(true);
    });

    it('detects invalid kickoff date', () => {
      const badFixture = { ...MOCK_FIXTURES[0], kickoff: 'not-a-date' };
      const matches: HistoricalMatch[] = [{
        fixture: badFixture,
        odds: [],
        result: MOCK_RESULTS[0],
      }];
      const ctx = createReplayContext({ provider: 'test' });
      const report = validateDataset(matches, ctx);
      expect(report.validationErrors.some((e) => e.field === 'kickoff')).toBe(true);
    });

    it('detects invalid scores', () => {
      const badResult = { ...MOCK_RESULTS[0], homeGoals: -1 };
      const matches: HistoricalMatch[] = [{
        fixture: MOCK_FIXTURES[0],
        odds: [MOCK_ODDS[0]],
        result: badResult,
      }];
      const ctx = createReplayContext({ provider: 'test' });
      const report = validateDataset(matches, ctx);
      expect(report.validationErrors.some((e) => e.field === 'homeGoals')).toBe(true);
    });
  });

  describe('ReplayContext', () => {
    it('generates unique execution IDs', () => {
      const ctx1 = createReplayContext({ provider: 'a' });
      const ctx2 = createReplayContext({ provider: 'b' });
      expect(ctx1.executionId).not.toBe(ctx2.executionId);
    });

    it('propagates provider name', () => {
      const ctx = createReplayContext({ provider: 'EPL 2024' });
      expect(ctx.provider).toBe('EPL 2024');
    });
  });

  describe('ReplayRunner End-to-End', () => {
    it('runs end-to-end with mock predictor and returns results', async () => {
      const provider = new MockReplayDataProvider();
      const predictor = new MockPredictor();
      const runner = new ReplayRunner(provider, predictor, { maxMatches: 5 });

      const result = await runner.run();

      expect(result.id).toBeTruthy();
      expect(result.context.provider).toBe('Mock EPL 2024-25');
      expect(result.metrics.totalMatches).toBeGreaterThan(0);
      expect(result.metrics.totalPredictions).toBeGreaterThan(0);
      expect(typeof result.metrics.roi).toBe('number');
      expect(typeof result.metrics.brierScore).toBe('number');
      expect(typeof result.metrics.winRate).toBe('number');
      expect(typeof result.metrics.avgClv).toBe('number');
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('respects maxMatches limit', async () => {
      const provider = new MockReplayDataProvider();
      const predictor = new MockPredictor();
      const runner = new ReplayRunner(provider, predictor, { maxMatches: 3 });

      const result = await runner.run();
      expect(result.metrics.totalMatches).toBeLessThanOrEqual(3);
    });

    it('computes valid metrics', async () => {
      const provider = new MockReplayDataProvider();
      const predictor = new MockPredictor();
      const runner = new ReplayRunner(provider, predictor, { maxMatches: 15 });

      const result = await runner.run();
      const m = result.metrics;

      expect(m.totalPredictions).toBeGreaterThan(0);
      expect(m.won + m.lost + m.voided).toBe(m.totalPredictions);
      expect(m.roi).not.toBeNaN();
      expect(m.brierScore).toBeGreaterThanOrEqual(0);
      expect(m.brierScore).toBeLessThanOrEqual(1);
      expect(m.avgClv).not.toBeNaN();
      expect(result.validationReport.totalFixtures).toBe(15);
    });

    it('completes within reasonable time', async () => {
      const provider = new MockReplayDataProvider();
      const predictor = new MockPredictor();
      const runner = new ReplayRunner(provider, predictor, { maxMatches: 15 });

      const result = await runner.run();
      // Even with mock predictor, should complete in < 5s
      expect(result.durationMs).toBeLessThan(5000);
    });
  });
});