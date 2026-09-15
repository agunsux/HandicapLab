import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@/lib/supabase.server', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
  },
}));

import { supabase } from '@/lib/supabase.server';
import {
  getEgressMode,
  isWorkerEgress,
  isEgressWorkerRequest,
  shouldDeferProviderWork,
  EGRESS_WORKER_HEADER,
} from '@/lib/crons/egressMode';
import {
  buildEgressEventKey,
  utcDayKey,
  utcHourKey,
  utcFiveMinKey,
  enqueueEgressJob,
  claimNextEgressEvent,
  EGRESS_EVENT_TYPE,
  EGRESS_JOB_PRIORITY,
} from '@/lib/crons/egressQueue';
import { isKnownEgressJob } from '@/lib/crons/egressJobs';
import { loadWorkerConfig } from '../worker/config';

const VALID_JWT =
  'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.abcdefghij';
const VALID_AF_KEY = 'api-football-test-key-1234567890';

function req(headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/cron/discovery', { headers });
}

describe('P0.3 controlled egress — mode', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to serverless', () => {
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', '');
    expect(getEgressMode()).toBe('serverless');
    expect(isWorkerEgress()).toBe(false);
  });

  it('only treats the exact value "worker" as worker mode', () => {
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', 'worker');
    expect(getEgressMode()).toBe('worker');
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', 'WORKER');
    expect(getEgressMode()).toBe('worker');
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', 'wroker');
    expect(getEgressMode()).toBe('serverless');
  });

  it('defers provider work in worker mode but not for the worker itself', () => {
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', 'worker');
    expect(shouldDeferProviderWork(req())).toBe(true);
    expect(isEgressWorkerRequest(req({ [EGRESS_WORKER_HEADER]: '1' }))).toBe(true);
    // The worker's own request must execute, not re-enqueue.
    expect(shouldDeferProviderWork(req({ [EGRESS_WORKER_HEADER]: '1' }))).toBe(false);
  });

  it('never defers in serverless mode', () => {
    vi.stubEnv('APIFOOTBALL_EGRESS_MODE', 'serverless');
    expect(shouldDeferProviderWork(req())).toBe(false);
  });
});

describe('P0.3 controlled egress — idempotency keys', () => {
  it('builds deterministic keys per job + scope', () => {
    expect(buildEgressEventKey('discovery', '2026-09-14')).toBe(
      `${EGRESS_EVENT_TYPE}:discovery:2026-09-14`
    );
    expect(buildEgressEventKey('discovery', '2026-09-14')).toBe(
      buildEgressEventKey('discovery', '2026-09-14')
    );
    expect(buildEgressEventKey('discovery', '2026-09-14')).not.toBe(
      buildEgressEventKey('discovery', '2026-09-15')
    );
  });

  it('produces stable UTC scope windows', () => {
    const d = new Date('2026-09-14T13:07:00.000Z');
    expect(utcDayKey(d)).toBe('2026-09-14');
    expect(utcHourKey(d)).toBe('2026-09-14T13');
    expect(utcFiveMinKey(d)).toBe('2026-09-14T13:05');
    expect(utcFiveMinKey(new Date('2026-09-14T13:04:59.000Z'))).toBe('2026-09-14T13:00');
  });

  it('assigns bounded priorities where settlement is highest', () => {
    expect(EGRESS_JOB_PRIORITY.settle).toBeLessThan(EGRESS_JOB_PRIORITY.discovery);
    expect(EGRESS_JOB_PRIORITY.ah_shadow).toBeGreaterThan(EGRESS_JOB_PRIORITY.discovery);
  });

  it('recognizes only known egress jobs', () => {
    expect(isKnownEgressJob('discovery')).toBe(true);
    expect(isKnownEgressJob('settle')).toBe(true);
    expect(isKnownEgressJob('unknown')).toBe(false);
    expect(isKnownEgressJob(undefined)).toBe(false);
  });
});

describe('P0.3 controlled egress — queue RPCs', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('enqueues with a deterministic event_key via enqueue_event RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'evt-1', error: null } as never);

    const id = await enqueueEgressJob({ job: 'discovery', scope: '2026-09-14' });

    expect(id).toBe('evt-1');
    expect(supabase.rpc).toHaveBeenCalledWith(
      'enqueue_event',
      expect.objectContaining({
        p_event_type: EGRESS_EVENT_TYPE,
        p_event_key: `${EGRESS_EVENT_TYPE}:discovery:2026-09-14`,
        p_priority: EGRESS_JOB_PRIORITY.discovery,
      })
    );
  });

  it('returns the existing event id when enqueue is deduplicated', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'evt-existing', error: null } as never);
    const id = await enqueueEgressJob({ job: 'settle', scope: '2026-09-14T13' });
    expect(id).toBe('evt-existing');
  });

  it('claims atomically via claim_next_event and normalizes array results', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ id: 'evt-claim', event_type: EGRESS_EVENT_TYPE }],
      error: null,
    } as never);

    const record = await claimNextEgressEvent(300);
    expect(record?.id).toBe('evt-claim');
    expect(supabase.rpc).toHaveBeenCalledWith('claim_next_event', {
      p_event_types: [EGRESS_EVENT_TYPE],
      p_lock_seconds: 300,
    });
  });

  it('returns null when there is nothing to claim', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: [], error: null } as never);
    expect(await claimNextEgressEvent(300)).toBeNull();
  });

  it('throws when the queue RPC errors', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: { message: 'boom' } } as never);
    await expect(enqueueEgressJob({ job: 'enrichment', scope: 'x' })).rejects.toThrow(/boom/);
  });
});

describe('P0.3 controlled egress — worker config', () => {
  const baseEnv = () => ({
    SUPABASE_URL: 'https://project.supabase.co',
    SUPABASE_SERVICE_ROLE_KEY: VALID_JWT,
    CRON_SECRET: 'cron-secret-value',
    APIFOOTBALL_KEY: VALID_AF_KEY,
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fails closed when Supabase URL is missing', () => {
    const env = { ...baseEnv(), SUPABASE_URL: '', NEXT_PUBLIC_SUPABASE_URL: '' };
    expect(() => loadWorkerConfig({ env, hostnameFn: () => 'test-host' })).toThrow(/SUPABASE_URL/);
  });

  it('fails closed when the API-Football key is missing', () => {
    const env = { ...baseEnv(), APIFOOTBALL_KEY: '', API_FOOTBALL_KEY: '' };
    vi.stubEnv('APIFOOTBALL_KEY', '');
    vi.stubEnv('API_FOOTBALL_KEY', '');
    expect(() => loadWorkerConfig({ env, hostnameFn: () => 'test-host' })).toThrow(/FAIL CLOSED/);
  });

  it('fails closed when CRON_SECRET is missing', () => {
    vi.stubEnv('APIFOOTBALL_KEY', VALID_AF_KEY);
    const env = { ...baseEnv(), CRON_SECRET: '' };
    expect(() => loadWorkerConfig({ env, hostnameFn: () => 'test-host' })).toThrow(/CRON_SECRET/);
  });

  it('defaults concurrency to 1 and clamps to a hard maximum of 2', () => {
    vi.stubEnv('APIFOOTBALL_KEY', VALID_AF_KEY);
    const base = loadWorkerConfig({ env: baseEnv(), hostnameFn: () => 'test-host' });
    expect(base.concurrency).toBe(1);

    const high = loadWorkerConfig({
      env: { ...baseEnv(), EGRESS_WORKER_CONCURRENCY: '9' },
      hostnameFn: () => 'test-host',
    });
    expect(high.concurrency).toBe(2);

    const zero = loadWorkerConfig({
      env: { ...baseEnv(), EGRESS_WORKER_CONCURRENCY: '0' },
      hostnameFn: () => 'test-host',
    });
    expect(zero.concurrency).toBe(1);
  });
});
