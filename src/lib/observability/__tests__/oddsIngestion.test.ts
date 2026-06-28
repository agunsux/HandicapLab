import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── vi.hoisted() returns values available inside the hoisted vi.mock factory ──
const { mockMaybeSingle, mockSelect, mockInsert, mockFrom } = vi.hoisted(() => {
  const mockMaybeSingle = vi.fn();
  const mockSelect = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
  const mockInsert = vi.fn(() => ({ select: mockSelect }));
  const mockFrom = vi.fn(() => ({ insert: mockInsert }));
  return { mockMaybeSingle, mockSelect, mockInsert, mockFrom };
});

vi.mock('@/lib/supabase.server', () => ({
  supabase: { from: mockFrom },
}));

import {
  OddsIngestionContext,
  type OddsRejectionReason,
} from '@/lib/observability/oddsIngestion';

// ── Helpers ───────────────────────────────────────────────────────────
function successfulFlush(dbId = 'db-uuid-123') {
  mockMaybeSingle.mockResolvedValueOnce({
    data: { id: dbId },
    error: null,
  });
}

function failedFlush(message = 'connection refused') {
  mockMaybeSingle.mockResolvedValueOnce({
    data: null,
    error: { message },
  });
}

function throwingFlush() {
  mockMaybeSingle.mockRejectedValueOnce(new Error('network timeout'));
}

// ── Tests ─────────────────────────────────────────────────────────────
describe('OddsIngestionContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ────────────────────────────────────────────────────────────────────
  // 1. Idempotency
  // ────────────────────────────────────────────────────────────────────
  describe('flush() idempotency', () => {
    it('inserts exactly one row on repeated flush() calls', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      ctx.fixturesReceived = 50;
      ctx.oddsEnriched = 40;
      ctx.signalsGenerated = 5;
      ctx.fixturesWithoutOdds = 10;

      successfulFlush();

      await ctx.flush();
      await ctx.flush(); // second call — should be a no-op
      await ctx.flush(); // third call — should be a no-op

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(ctx.flushed).toBe(true);
    });

    it('marks flushed even if the DB insert fails', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      failedFlush();

      await ctx.flush();
      await ctx.flush();

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(ctx.flushed).toBe(true);
      expect(ctx.persistedId).toBeNull();
    });

    it('marks flushed even if flush() throws an exception', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      throwingFlush();

      await ctx.flush();
      await ctx.flush();

      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(ctx.flushed).toBe(true);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 2. No duplicate cron_runs
  // ────────────────────────────────────────────────────────────────────
  describe('no duplicate rows', () => {
    it('sends a unique execution_id with each context instance', () => {
      const ctx1 = new OddsIngestionContext('capture-odds');
      const ctx2 = new OddsIngestionContext('capture-odds');

      expect(ctx1.executionId).not.toBe(ctx2.executionId);
      // UUID v4 format
      expect(ctx1.executionId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
      );
    });

    it('includes execution_id in the insert payload', async () => {
      const ctx = new OddsIngestionContext('generate-signals');
      successfulFlush();

      await ctx.flush();

      const insertPayload = mockInsert.mock.calls[0][0];
      expect(insertPayload.execution_id).toBe(ctx.executionId);
      expect(insertPayload.cron_name).toBe('generate-signals');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 3. run_id / execution_id tracking
  // ────────────────────────────────────────────────────────────────────
  describe('execution_id and persistedId', () => {
    it('stores the DB-generated id after successful flush', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      successfulFlush('row-uuid-abc');

      await ctx.flush();

      expect(ctx.persistedId).toBe('row-uuid-abc');
    });

    it('persistedId remains null when flush DB-errors', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      failedFlush();

      await ctx.flush();

      expect(ctx.persistedId).toBeNull();
    });

    it('summary() includes executionId', () => {
      const ctx = new OddsIngestionContext('capture-odds');
      const s = ctx.summary();
      expect(s.executionId).toBe(ctx.executionId);
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 4. Failure flush cannot throw and mask original error
  // ────────────────────────────────────────────────────────────────────
  describe('failure safety', () => {
    it('flush() never throws even when supabase insert rejects', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      throwingFlush();

      // Must resolve, not reject
      await expect(ctx.flush()).resolves.toBeUndefined();
    });

    it('flush() never throws even when supabase returns an error', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      failedFlush('relation "odds_ingestion_runs" does not exist');

      await expect(ctx.flush()).resolves.toBeUndefined();
    });

    it('does not interfere with catching the original pipeline error', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      throwingFlush();

      const pipelineError = new Error('odds provider timeout');
      let caughtError: Error | null = null;

      try {
        // Simulate pipeline failure
        throw pipelineError;
      } catch (err) {
        caughtError = err as Error;
        // Flush in catch block — must not mask caughtError
        await ctx.flush();
      }

      expect(caughtError).toBe(pipelineError);
      expect(caughtError!.message).toBe('odds provider timeout');
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 5. Test scenarios — correct counter persistence
  // ────────────────────────────────────────────────────────────────────
  describe('counter accuracy for pipeline scenarios', () => {
    it('odds provider timeout — records zero enriched, zero signals', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      ctx.fixturesReceived = 60;
      // Provider timed out: nothing enriched, all missing
      ctx.fixturesWithoutOdds = 60;

      successfulFlush();
      await ctx.flush();

      const payload = mockInsert.mock.calls[0][0];
      expect(payload.fixtures_received).toBe(60);
      expect(payload.odds_enriched).toBe(0);
      expect(payload.odds_rejected).toBe(0);
      expect(payload.signals_generated).toBe(0);
      expect(payload.fixtures_without_odds).toBe(60);
      expect(payload.rejection_log).toEqual([]);
    });

    it('malformed odds batch — all rejected with malformed_price', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      ctx.fixturesReceived = 20;

      for (let i = 0; i < 20; i++) {
        ctx.reject({
          homeTeam: `Home${i}`,
          awayTeam: `Away${i}`,
          market: 'moneyline',
          reason: 'malformed_price',
          detail: 'price was NaN',
        });
      }

      successfulFlush();
      await ctx.flush();

      const payload = mockInsert.mock.calls[0][0];
      expect(payload.fixtures_received).toBe(20);
      expect(payload.odds_rejected).toBe(20);
      expect(payload.odds_enriched).toBe(0);
      expect(payload.signals_generated).toBe(0);
      expect(payload.rejection_log).toHaveLength(20);

      const summary = ctx.summary();
      expect(summary.rejectionBreakdown.malformed_price).toBe(20);
    });

    it('signal generation exception — partial signals before crash', async () => {
      const ctx = new OddsIngestionContext('generate-signals');
      ctx.fixturesReceived = 30;
      ctx.oddsEnriched = 25;
      ctx.signalsGenerated = 12; // 12 signals generated before crash

      ctx.reject({
        homeTeam: 'CrashTeam',
        awayTeam: 'OtherTeam',
        market: 'asian_handicap',
        reason: 'missing_line',
        detail: 'exception during line matching',
      });

      successfulFlush();
      await ctx.flush();

      const payload = mockInsert.mock.calls[0][0];
      expect(payload.signals_generated).toBe(12);
      expect(payload.odds_enriched).toBe(25);
      expect(payload.odds_rejected).toBe(1);
    });

    it('partial success — 50 processed, 10 failed', async () => {
      const ctx = new OddsIngestionContext('capture-odds');
      ctx.fixturesReceived = 60;
      ctx.oddsEnriched = 50;
      ctx.signalsGenerated = 45;
      ctx.fixturesWithoutOdds = 5;

      // 10 failures with mixed reasons
      const reasons: OddsRejectionReason[] = [
        'malformed_price', 'malformed_price', 'malformed_price',
        'missing_market', 'missing_market',
        'invalid_bookmaker', 'invalid_bookmaker', 'invalid_bookmaker',
        'missing_line', 'missing_line',
      ];
      for (const reason of reasons) {
        ctx.reject({
          homeTeam: 'TeamA',
          awayTeam: 'TeamB',
          market: 'moneyline',
          reason,
        });
      }

      successfulFlush();
      await ctx.flush();

      const payload = mockInsert.mock.calls[0][0];
      expect(payload.fixtures_received).toBe(60);
      expect(payload.odds_enriched).toBe(50);
      expect(payload.odds_rejected).toBe(10);
      expect(payload.signals_generated).toBe(45);
      expect(payload.fixtures_without_odds).toBe(5);
      expect(payload.rejection_log).toHaveLength(10);

      const summary = ctx.summary();
      expect(summary.rejectionBreakdown).toEqual({
        malformed_price: 3,
        missing_market: 2,
        invalid_bookmaker: 3,
        missing_line: 2,
      });
    });
  });

  // ────────────────────────────────────────────────────────────────────
  // 6. reject() behaviour
  // ────────────────────────────────────────────────────────────────────
  describe('reject()', () => {
    it('auto-increments oddsRejected and stores in rejection log', () => {
      const ctx = new OddsIngestionContext('capture-odds');
      expect(ctx.oddsRejected).toBe(0);

      ctx.reject({
        homeTeam: 'Liverpool',
        awayTeam: 'Arsenal',
        market: 'moneyline',
        reason: 'malformed_price',
        detail: 'price = Infinity',
      });

      expect(ctx.oddsRejected).toBe(1);

      ctx.reject({
        signalId: 'sig-123',
        homeTeam: 'Chelsea',
        awayTeam: 'Spurs',
        market: 'asian_handicap',
        reason: 'missing_line',
      });

      expect(ctx.oddsRejected).toBe(2);
    });
  });
});
