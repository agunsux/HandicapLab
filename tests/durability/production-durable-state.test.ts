// ============================================================================
// PRODUCTION DURABLE STATE — Phase 6 test isolation suite
// ============================================================================
// Proves the Production Durable State Recovery invariants (tests A–I):
//   A. Production path does NOT use os.tmpdir() as durable storage
//   B. Successful production run persists durable state
//   C. Retry is idempotent
//   D. Failed persistence fails/degrades explicitly
//   E. Health read model reads durable state
//   F. Build-time fallback cannot masquerade as live freshness
//   G. live_validation_job_runs records execution status
//   H. Existing research/test isolation remains intact
//   I. data/golden/europe remains byte-for-byte unchanged
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as os from 'os';

type Call = Record<string, any>;

const { mockSupabase, calls, tableRows, counts, control } = vi.hoisted(() => {
  const calls: Call[] = [];
  const tableRows: Record<string, any[]> = {};
  const counts: Record<string, number> = {};
  const control = {
    upsertError: null as any,
    insertError: null as any,
    updateError: null as any,
    throwOnUpsert: false,
  };

  function makeChain(table: string) {
    const chain: any = {
      _op: null as string | null,
      _selectOpts: undefined as any,
      _payload: undefined as any,
      _options: undefined as any,
      select(_cols?: any, opts?: any) {
        if (chain._op === null) chain._op = 'select';
        chain._selectOpts = opts;
        return chain;
      },
      insert(payload: any) {
        chain._op = 'insert';
        chain._payload = payload;
        calls.push({ table, op: 'insert', payload });
        return chain;
      },
      upsert(payload: any, options: any) {
        calls.push({ table, op: 'upsert', payload, options });
        if (control.throwOnUpsert) throw new Error('simulated transport failure');
        chain._op = 'upsert';
        chain._payload = payload;
        chain._options = options;
        return chain;
      },
      update(payload: any) {
        chain._op = 'update';
        chain._payload = payload;
        calls.push({ table, op: 'update', payload });
        return chain;
      },
      eq(column: string, value: any) {
        calls.push({ table, op: 'eq', column, value });
        return chain;
      },
      gt(column: string, value: any) {
        calls.push({ table, op: 'gt', column, value });
        return chain;
      },
      order() {
        return chain;
      },
      limit() {
        return chain;
      },
      single() {
        return chain;
      },
      then(resolve: any) {
        let result: any = { data: null, error: null, count: null };
        if (chain._op === 'upsert') {
          result = { data: null, error: control.upsertError, count: null };
        } else if (chain._op === 'insert') {
          result = {
            data: control.insertError ? null : { id: 'job-row-1' },
            error: control.insertError,
            count: null,
          };
        } else if (chain._op === 'update') {
          result = { data: null, error: control.updateError, count: null };
        } else {
          if (chain._selectOpts && chain._selectOpts.head) {
            result = {
              data: null,
              error: null,
              count: Object.prototype.hasOwnProperty.call(counts, table) ? counts[table] : null,
            };
          } else {
            result = { data: tableRows[table] ?? [], error: null, count: null };
          }
        }
        chain._op = null;
        chain._selectOpts = undefined;
        if (resolve) resolve(result);
      },
    };
    return chain;
  }

  const mockSupabase = {
    from: (table: string) => makeChain(table),
  };

  return { mockSupabase, calls, tableRows, counts, control };
});

vi.mock('@/lib/supabase.server', () => ({ supabase: mockSupabase }));
vi.mock('../src/lib/supabase.server', () => ({ supabase: mockSupabase }));

import {
  isDurableStateRequired,
  forbiddenEphemeralPrefix,
  persistDailyPredictions,
  startDurableRun,
  completeDurableRun,
  readLatestDurableState,
  getDurableStateHealth,
  toDailyPicksRow,
  toDailyPicksMarketType,
  toDailyPicksVerdict,
  DURABLE_DAILY_PICKS_SOURCE,
  JOB_NAME_DAILY_PIPELINE,
} from '@/lib/durability/productionDurableState';
import { CronLogger } from '@/lib/services/cronLogger';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const FIXTURE_ID = '3f2504e0-4f89-11d3-9a0c-0305e82c3301';

function makeRecord(overrides: Record<string, any> = {}): any {
  return {
    predictionId: 'pred-1',
    canonicalMatchId: FIXTURE_ID,
    match: 'Home vs Away',
    homeTeam: 'Home',
    awayTeam: 'Away',
    competition: 'Premier League',
    market: 'OU',
    selection: 'OVER 2.5',
    line: 2.5,
    modelProbability: 0.61,
    calibratedProbability: 0.61,
    odds: 1.95,
    impliedProbability: 0.5128,
    edge: 0.0972,
    expectedValue: 0.1895,
    confidence: 'HIGH',
    confidenceScore: 82,
    predictionTimestamp: '2026-10-02T04:10:00.000Z',
    kickoffTimestamp: '2026-10-02T18:00:00.000Z',
    oddsTimestamp: '2026-10-02T04:05:00.000Z',
    modelVersion: 'dixon-coles-v1.0',
    featureVersion: 'v1.0',
    runId: 'daily-2026-10-02T04:00Z',
    status: 'QUALIFIED',
    settlement: null,
    createdAt: '2026-10-02T04:10:00.000Z',
    updatedAt: '2026-10-02T04:10:00.000Z',
    ...overrides,
  };
}

function hashDir(dir: string): string {
  if (!fs.existsSync(dir)) return 'MISSING';
  const hash = crypto.createHash('sha256');
  const walk = (d: string) => {
    for (const entry of fs.readdirSync(d).sort()) {
      const full = path.join(d, entry);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else {
        hash.update(entry);
        hash.update(fs.readFileSync(full));
      }
    }
  };
  walk(dir);
  return hash.digest('hex');
}

const GOLDEN_DIR = path.resolve('data/golden/europe');
let goldenHashBefore = '';
let originalVercel: string | undefined;

beforeAll(() => {
  goldenHashBefore = hashDir(GOLDEN_DIR);
});

afterAll(() => {
  // Test I — the suite must not mutate the golden research dataset.
  expect(hashDir(GOLDEN_DIR)).toBe(goldenHashBefore);
});

beforeEach(() => {
  calls.length = 0;
  for (const k of Object.keys(tableRows)) delete tableRows[k];
  for (const k of Object.keys(counts)) delete counts[k];
  control.upsertError = null;
  control.insertError = null;
  control.updateError = null;
  control.throwOnUpsert = false;

  originalVercel = process.env.VERCEL;
  delete process.env.VERCEL;
  delete process.env.VERCEL_ENV;
});

afterEach(() => {
  if (originalVercel === undefined) delete process.env.VERCEL;
  else process.env.VERCEL = originalVercel;
  delete process.env.VERCEL_ENV;
});

// ---------------------------------------------------------------------------
// A. Production path does NOT use os.tmpdir() as durable storage
// ---------------------------------------------------------------------------

describe('A. Production path does not use os.tmpdir() as durable storage', () => {
  it('never routes durable writes through an ephemeral filesystem path', async () => {
    process.env.VERCEL = '1';
    expect(isDurableStateRequired()).toBe(true);
    expect(forbiddenEphemeralPrefix()).toBe(os.tmpdir());

    const result = await persistDailyPredictions([makeRecord()], 'run-a');
    expect(result.written).toBe(1);

    // The only sink used is the durable Supabase table.
    expect(calls.filter((c) => c.op === 'upsert').map((c) => c.table)).toEqual(['daily_picks']);

    const tmp = forbiddenEphemeralPrefix();
    for (const c of calls) {
      const serialized = JSON.stringify(c.payload ?? {});
      expect(serialized).not.toContain(tmp);
      expect(serialized).not.toContain('/tmp/');
      expect(serialized).not.toContain('handicaplab_daily_prediction_ledger.json');
    }
  });
});

// ---------------------------------------------------------------------------
// B. Successful production run persists durable state
// ---------------------------------------------------------------------------

describe('B. Successful production run persists durable state', () => {
  it('upserts every representable record into daily_picks', async () => {
    process.env.VERCEL = '1';
    const records = [
      makeRecord(),
      makeRecord({
        predictionId: 'pred-2',
        market: 'AH',
        selection: 'HOME -0.5',
        line: -0.5,
        calibratedProbability: 0.58,
        odds: 1.85,
      }),
    ];

    const res = await persistDailyPredictions(records, 'run-b');

    expect(res.attempted).toBe(true);
    expect(res.skipped).toBe(false);
    expect(res.submitted).toBe(2);
    expect(res.written).toBe(2);
    expect(res.failed).toBe(0);

    const upsert = calls.find((c) => c.op === 'upsert')!;
    expect(upsert.table).toBe('daily_picks');
    expect(upsert.payload).toHaveLength(2);
    expect(upsert.payload[0].source).toBe(DURABLE_DAILY_PICKS_SOURCE);
    expect(upsert.payload[0].status).toBe('PENDING');
    expect(upsert.payload[0].verdict).toBe('LAYAK');
    expect(upsert.payload[0].market_type).toBe('OVER_UNDER');
    expect(upsert.payload[1].market_type).toBe('ASIAN_HANDICAP');
  });
});

// ---------------------------------------------------------------------------
// C. Retry is idempotent
// ---------------------------------------------------------------------------

describe('C. Retry is idempotent', () => {
  it('reuses the existing UNIQUE conflict key so retries cannot duplicate', async () => {
    process.env.VERCEL = '1';
    const rec = makeRecord();

    await persistDailyPredictions([rec], 'run-c');
    await persistDailyPredictions([rec], 'run-c');

    const upserts = calls.filter((c) => c.op === 'upsert');
    expect(upserts).toHaveLength(2);
    for (const u of upserts) {
      expect(u.options.onConflict).toBe('fixture_id,market_type,source');
    }

    const keys = upserts.map(
      (u) => `${u.payload[0].fixture_id}|${u.payload[0].market_type}|${u.payload[0].source}`
    );
    expect(new Set(keys).size).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// D. Failed persistence fails / degrades explicitly
// ---------------------------------------------------------------------------

describe('D. Failed persistence fails or degrades explicitly', () => {
  it('reports failed>0 when the durable write returns an error', async () => {
    process.env.VERCEL = '1';
    control.upsertError = { message: 'permission denied', code: '42501' };

    const res = await persistDailyPredictions([makeRecord()], 'run-d');

    expect(res.attempted).toBe(true);
    expect(res.written).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errors.join(' ')).toContain('permission denied');
  });

  it('reports failed>0 on transport throw — never a silent /tmp fallback', async () => {
    process.env.VERCEL = '1';
    control.throwOnUpsert = true;

    const res = await persistDailyPredictions([makeRecord()], 'run-d2');

    expect(res.written).toBe(0);
    expect(res.failed).toBe(1);
    expect(res.errors.join(' ')).toContain('simulated transport failure');
    // Still no ephemeral sink was used.
    expect(calls.filter((c) => c.op === 'upsert').map((c) => c.table)).toEqual(['daily_picks']);
  });

  it('counts unrepresentable records as failures rather than dropping them silently', async () => {
    process.env.VERCEL = '1';
    const res = await persistDailyPredictions(
      [makeRecord(), makeRecord({ predictionId: 'bad', canonicalMatchId: 'not-a-uuid' })],
      'run-d3'
    );

    expect(res.submitted).toBe(1);
    expect(res.written).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors.join(' ')).toContain('Unrepresentable record skipped');
  });
});

// ---------------------------------------------------------------------------
// E. Health read model reads durable state
// ---------------------------------------------------------------------------

describe('E. Health read model reads durable state', () => {
  it('reports DURABLE with durable timestamps and counts when reads succeed', async () => {
    process.env.VERCEL = '1';
    tableRows['odds_snapshots'] = [{ captured_at: '2026-10-02T04:05:00.000Z' }];
    tableRows['daily_picks'] = [{ created_at: '2026-10-02T04:10:00.000Z' }];
    tableRows['live_validation_job_runs'] = [
      {
        id: 'r1',
        job_name: JOB_NAME_DAILY_PIPELINE,
        status: 'SUCCESS',
        started_at: '2026-10-02T04:00:00.000Z',
        finished_at: '2026-10-02T04:12:00.000Z',
        items_processed: 70,
        correlation_id: 'daily-2026-10-02T04:00Z',
      },
    ];
    counts['daily_picks'] = 30;
    counts['matches'] = 756;

    const snap = await readLatestDurableState(Date.parse('2026-10-02T05:00:00.000Z'));

    expect(snap.dataSource).toBe('DURABLE');
    expect(snap.available).toBe(true);
    expect(snap.degraded).toBe(false);
    expect(snap.reason).toBeNull();
    expect(snap.latestOddsTimestampUtc).toBe('2026-10-02T04:05:00.000Z');
    expect(snap.latestPredictionTimestampUtc).toBe('2026-10-02T04:10:00.000Z');
    expect(snap.predictionCount).toBe(30);
    expect(snap.upcomingFixtureCount).toBe(756);
    expect(snap.latestRun?.status).toBe('SUCCESS');
    expect(snap.latestRun?.runId).toBe('daily-2026-10-02T04:00Z');
    expect(snap.latestRun?.itemsProcessed).toBe(70);

    const health = await getDurableStateHealth();
    expect(health.required).toBe(true);
    expect(health.available).toBe(true);
    expect(health.degraded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// F. Build-time fallback cannot masquerade as live freshness
// ---------------------------------------------------------------------------

describe('F. Build-time fallback cannot masquerade as live freshness', () => {
  it('degrades explicitly when durable reads return nothing', async () => {
    process.env.VERCEL = '1';

    const snap = await readLatestDurableState();

    expect(snap.available).toBe(false);
    expect(snap.degraded).toBe(true);
    expect(snap.dataSource).toBe('UNAVAILABLE');
    expect(snap.latestOddsTimestampUtc).toBeNull();
    expect(snap.latestPredictionTimestampUtc).toBeNull();
    expect(snap.reason).toContain('All durable reads failed');
  });

  it('never surfaces the frozen build-time constant as live state', async () => {
    process.env.VERCEL = '1';

    const snap = await readLatestDurableState();
    const serialized = JSON.stringify(snap);

    expect(serialized).not.toContain('2026-09-21T19:05:26.901Z');
    expect(serialized).not.toContain('2026-09-29T18:11:15.339Z');
    expect(serialized).not.toContain('550');
  });

  it('is not required (and stays neutral) outside Vercel', async () => {
    const snap = await readLatestDurableState();
    expect(snap.dataSource).toBe('UNAVAILABLE');
    expect(snap.degraded).toBe(true);
    const health = await getDurableStateHealth();
    expect(health.required).toBe(false);
    expect(health.degraded).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// G. Job-run observability is recorded (replaces the missing cron_runs table)
// ---------------------------------------------------------------------------

describe('G. live_validation_job_runs records execution status', () => {
  it('CronLogger.start() records a RUNNING job row with a correlation id', async () => {
    const id = await CronLogger.start('daily-pipeline');

    expect(id).toBe('job-row-1');
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.table).toBe('live_validation_job_runs');
    expect(insert.payload.job_name).toBe('daily-pipeline');
    expect(insert.payload.status).toBe('RUNNING');
    expect(typeof insert.payload.started_at).toBe('string');
    expect(String(insert.payload.correlation_id)).toContain('daily-pipeline:');
  });

  it('CronLogger.end() marks SUCCESS / FAILED with finished_at and error category', async () => {
    await CronLogger.end('job-row-1', 70, null);
    let update = calls.filter((c) => c.op === 'update').pop()!;
    expect(update.table).toBe('live_validation_job_runs');
    expect(update.payload.status).toBe('SUCCESS');
    expect(update.payload.items_processed).toBe(70);
    expect(update.payload.items_failed).toBe(0);
    expect(update.payload.error_message).toBeNull();
    expect(typeof update.payload.finished_at).toBe('string');

    calls.length = 0;
    await CronLogger.end('job-row-1', 0, new Error('quota exceeded for provider'));
    update = calls.filter((c) => c.op === 'update').pop()!;
    expect(update.payload.status).toBe('FAILED');
    expect(update.payload.error_message).toBe('API_QUOTA_EXCEEDED');
  });

  it('never targets the non-existent cron_runs table', async () => {
    await CronLogger.start('daily-pipeline');
    await CronLogger.end('job-row-1', 1, null);
    expect(calls.some((c) => c.table === 'cron_runs')).toBe(false);
    expect(calls.some((c) => c.table === 'live_validation_job_runs')).toBe(true);
  });

  it('startDurableRun / completeDurableRun record the run lifecycle', async () => {
    process.env.VERCEL = '1';

    const id = await startDurableRun('daily-2026-10-02T04:00Z');
    expect(id).toBe('job-row-1');
    const insert = calls.find((c) => c.op === 'insert')!;
    expect(insert.table).toBe('live_validation_job_runs');
    expect(insert.payload.job_name).toBe(JOB_NAME_DAILY_PIPELINE);
    expect(insert.payload.correlation_id).toBe('daily-2026-10-02T04:00Z');

    const ok = await completeDurableRun('job-row-1', {
      status: 'PARTIAL',
      itemsProcessed: 5,
      itemsFailed: 2,
      durationMs: 1000,
      errorMessage: 'durable persistence partial',
    });
    expect(ok).toBe(true);
    const update = calls.filter((c) => c.op === 'update').pop()!;
    expect(update.table).toBe('live_validation_job_runs');
    expect(update.payload.status).toBe('PARTIAL');
    expect(update.payload.items_failed).toBe(2);
    expect(update.payload.error_message).toBe('durable persistence partial');
  });
});

// ---------------------------------------------------------------------------
// H. Existing research / test isolation remains intact
// ---------------------------------------------------------------------------

describe('H. Existing research/test isolation remains intact', () => {
  it('is a total no-op outside Vercel and never contacts Supabase', async () => {
    expect(isDurableStateRequired()).toBe(false);

    const res = await persistDailyPredictions([makeRecord()], 'run-h');
    expect(res.skipped).toBe(true);
    expect(res.attempted).toBe(false);
    expect(res.written).toBe(0);
    expect(res.failed).toBe(0);

    expect(await startDurableRun('run-h')).toBeNull();
    expect(await completeDurableRun('job-row-1', { status: 'SUCCESS' })).toBe(false);

    const snap = await readLatestDurableState();
    expect(snap.dataSource).toBe('UNAVAILABLE');

    expect(calls).toHaveLength(0);
  });

  it('maps markets and verdicts into the production CHECK domains', () => {
    expect(toDailyPicksMarketType('AH')).toBe('ASIAN_HANDICAP');
    expect(toDailyPicksMarketType('OU')).toBe('OVER_UNDER');
    expect(toDailyPicksMarketType('BTTS')).toBe('BTTS');
    expect(toDailyPicksMarketType('MONEYLINE')).toBe('MONEYLINE');
    expect(toDailyPicksMarketType('UNKNOWN')).toBeNull();

    expect(toDailyPicksVerdict('HIGH')).toBe('LAYAK');
    expect(toDailyPicksVerdict('MEDIUM')).toBe('PANTAU');
    expect(toDailyPicksVerdict('LOW')).toBe('LEWATI');
    expect(toDailyPicksVerdict('PASS')).toBe('LEWATI');
  });

  it('rejects records that cannot satisfy production constraints', () => {
    expect(toDailyPicksRow(makeRecord({ canonicalMatchId: 'not-a-uuid' }), 'run')).toBeNull();
    expect(toDailyPicksRow(makeRecord({ market: 'XYZ' }), 'run')).toBeNull();
    expect(
      toDailyPicksRow(makeRecord({ calibratedProbability: 0, modelProbability: 0 }), 'run')
    ).toBeNull();
    expect(
      toDailyPicksRow(makeRecord({ calibratedProbability: null, modelProbability: null }), 'run')
    ).toBeNull();

    // A valid record still maps cleanly.
    expect(toDailyPicksRow(makeRecord(), 'run')).not.toBeNull();
  });

  it('preserves odds provenance (line + odds timestamp + bookmaker) without DDL', () => {
    const row = toDailyPicksRow(makeRecord(), 'run-h')!;

    // 04:10 (prediction) - 04:05 (odds) = 300000 ms
    expect(row.data_age_ms).toBe(300000);
    expect(row.market_bookmaker).toBe('Pinnacle');

    const reasoning = JSON.parse(row.reasoning as string);
    expect(reasoning.line).toBe(2.5);
    expect(reasoning.oddsTimestamp).toBe('2026-10-02T04:05:00.000Z');
    expect(reasoning.bookmaker).toBe('Pinnacle');
    expect(reasoning.runId).toBe('run-h');
  });
});




