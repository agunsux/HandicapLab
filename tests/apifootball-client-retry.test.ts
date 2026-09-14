import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Isolate the canonical client from the real gateway so we can drive provider
// responses deterministically (429 / 5xx / gateway rejection).
vi.mock('@/lib/providers/providerGateway', () => ({
  globalGateway: { fetch: vi.fn() },
}));

import { apiFootballClient } from '@/lib/apis/apifootball';
import { globalGateway } from '@/lib/providers/providerGateway';

const validEnvelope = {
  get: 'fixtures',
  parameters: {},
  errors: null,
  results: 0,
  paging: { current: 1, total: 1 },
  response: [],
};

function envelopeResponse(status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(validEnvelope), { status, headers });
}

describe('ApiFootballClient bounded retry/backoff (Phases 6/11)', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.APIFOOTBALL_KEY = 'api-football-test-key-1234567890';
    process.env.APIFOOTBALL_RETRY_BASE_MS = '2';
  });

  afterEach(() => {
    delete process.env.APIFOOTBALL_RETRY_BASE_MS;
  });

  it('retries HTTP 429 a bounded number of times, honouring Retry-After', async () => {
    vi.mocked(globalGateway.fetch)
      .mockImplementationOnce(async () => envelopeResponse(429, { 'retry-after': '0' }))
      .mockImplementationOnce(async () => envelopeResponse(200));

    const res = await apiFootballClient.getFixtures(39, 2026);

    expect(globalGateway.fetch).toHaveBeenCalledTimes(2);
    expect(res.response).toEqual([]);
  });

  it('exhausts a hard maximum of 2 retries on repeated 5xx and then throws', async () => {
    vi.mocked(globalGateway.fetch).mockImplementation(async () => envelopeResponse(500));

    await expect(apiFootballClient.getFixtures(39, 2026)).rejects.toThrow();
    // 1 initial attempt + 2 bounded retries = 3, never more.
    expect(globalGateway.fetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry when the gateway rejects (quota / circuit) and surfaces the error', async () => {
    const err = Object.assign(new Error('Quota exhausted or blocked for apifootball'), {
      name: 'QuotaExhaustionError',
    });
    vi.mocked(globalGateway.fetch).mockRejectedValue(err);

    await expect(apiFootballClient.getFixtures(39, 2026)).rejects.toThrow(/Quota exhausted/);
    expect(globalGateway.fetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry a non-retryable 4xx client error', async () => {
    vi.mocked(globalGateway.fetch).mockImplementation(async () => envelopeResponse(400));

    await expect(apiFootballClient.getFixtures(39, 2026)).rejects.toThrow();
    expect(globalGateway.fetch).toHaveBeenCalledTimes(1);
  });
});
