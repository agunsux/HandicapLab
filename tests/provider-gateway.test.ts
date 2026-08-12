import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { ProviderGateway, memoryCache, QuotaExhaustionError, globalMemoryCache } from '@/lib/providers/providerGateway';
import * as quotaManager from '@/lib/providers/quotaManagerV4';

vi.mock('@/lib/providers/quotaManagerV4', () => {
  return {
    reserveQuota: vi.fn(),
    confirmQuota: vi.fn(),
    rollbackQuota: vi.fn(),
  };
});

// Mock fetch globally
const originalFetch = global.fetch;

describe('ProviderGateway', () => {
  let gateway: ProviderGateway;

  beforeEach(() => {
    vi.resetAllMocks();
    global.fetch = vi.fn();
    gateway = new ProviderGateway(memoryCache);
    // Clear cache
    (globalMemoryCache as any)?.clear?.();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('should use cache and NOT reserve quota on cache hit', async () => {
    // Manually set cache
    await memoryCache.set('gwcache:apifootball:fixtures:GET:https://test.com/api:', {
      body: '{"test":"cached"}',
      status: 200,
      headers: { 'content-type': 'application/json' },
    }, 10000);

    const res = await gateway.fetch('apifootball', 'fixtures', 'https://test.com/api', { cacheTtlMs: 10000 });
    
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.test).toBe('cached');

    // Quota reservation should NEVER be called on cache hit
    expect(quotaManager.reserveQuota).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('should reserve quota, call HTTP, and confirm on success', async () => {
    vi.mocked(quotaManager.reserveQuota).mockResolvedValueOnce({
      ok: true,
      reason: 'ok',
      reservationId: 'res-1',
      cost: 1,
      provider: 'apifootball',
      endpoint: 'fixtures',
      mode: 'NORMAL',
    });
    vi.mocked(quotaManager.confirmQuota).mockResolvedValueOnce({ ok: true });

    const mockResponse = new Response('{"data":"fresh"}', { status: 200, headers: new Headers({'x-ratelimit-limit': '7500'}) });
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

    const res = await gateway.fetch('apifootball', 'fixtures', 'https://test.com/api');

    expect(quotaManager.reserveQuota).toHaveBeenCalledWith('apifootball', 'fixtures', 50, expect.any(String));
    expect(global.fetch).toHaveBeenCalledWith('https://test.com/api', expect.any(Object));
    expect(quotaManager.confirmQuota).toHaveBeenCalledWith('res-1', 1, 7500, undefined);
  });

  it('should throw QuotaExhaustionError and NOT call HTTP if quota is exhausted', async () => {
    vi.mocked(quotaManager.reserveQuota).mockResolvedValueOnce({
      ok: false,
      reason: 'QUOTA_EXHAUSTED',
      cost: 1,
      provider: 'apifootball',
      endpoint: 'fixtures',
      mode: 'NORMAL',
    });

    await expect(gateway.fetch('apifootball', 'fixtures', 'https://test.com/api')).rejects.toThrow(QuotaExhaustionError);

    expect(global.fetch).not.toHaveBeenCalled();
    expect(quotaManager.confirmQuota).not.toHaveBeenCalled();
  });

  it('should rollback quota on network failure (throw before response)', async () => {
    vi.mocked(quotaManager.reserveQuota).mockResolvedValueOnce({
      ok: true,
      reason: 'ok',
      reservationId: 'res-2',
      cost: 1,
      provider: 'apifootball',
      endpoint: 'fixtures',
      mode: 'NORMAL',
    });
    vi.mocked(quotaManager.rollbackQuota).mockResolvedValueOnce({ ok: true });

    vi.mocked(global.fetch).mockRejectedValueOnce(new Error('Network disconnected'));

    await expect(gateway.fetch('apifootball', 'fixtures', 'https://test.com/api')).rejects.toThrow('Network disconnected');

    expect(quotaManager.rollbackQuota).toHaveBeenCalledWith('res-2');
    expect(quotaManager.confirmQuota).not.toHaveBeenCalled();
  });

  it('should confirm quota on HTTP 429 because provider hit was made', async () => {
    vi.mocked(quotaManager.reserveQuota).mockResolvedValueOnce({
      ok: true,
      reason: 'ok',
      reservationId: 'res-3',
      cost: 1,
      provider: 'apifootball',
      endpoint: 'fixtures',
      mode: 'NORMAL',
    });
    vi.mocked(quotaManager.confirmQuota).mockResolvedValueOnce({ ok: true });

    const mockResponse = new Response('Rate limited', { status: 429 });
    vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

    const res = await gateway.fetch('apifootball', 'fixtures', 'https://test.com/api');

    expect(res.status).toBe(429);
    expect(quotaManager.confirmQuota).toHaveBeenCalledWith('res-3', 1, undefined, undefined);
    expect(quotaManager.rollbackQuota).not.toHaveBeenCalled();
  });
});
