import { describe, it, expect, vi, beforeEach } from 'vitest';
import { evaluateCanonicalProviderHealth } from '@/lib/providers/canonicalHealth';
import { globalGateway } from '@/lib/providers/providerGateway';
import { getBlockedRequestCount, resetBlockedRequestCount } from './setup-env';

describe('P0.3 Canonical Health Provider Gateway Integration', () => {
  beforeEach(() => {
    resetBlockedRequestCount();
    // Re-pause apifootball to assert default cold-boot state
    globalGateway.getHealthMonitor('apifootball').pause();
  });

  it('reports PAUSED immediately on cold start without making any network calls', async () => {
    const initialBlocked = getBlockedRequestCount();
    const report = await evaluateCanonicalProviderHealth();

    expect(report.apiFootball.configured).toBe(true);
    expect(report.apiFootball.status).toBe('PAUSED');
    expect(report.apiFootball.error).toContain('PAUSED');
    expect(report.apiFootball.authenticated).toBe(false);
    expect(report.apiFootball.dataAvailable).toBe(false);

    // Assert that the test network firewall caught 0 outbound calls because none were attempted
    expect(getBlockedRequestCount()).toBe(initialBlocked);
  });

  it('routes through globalGateway when apifootball is explicitly activated', async () => {
    const healthMonitor = globalGateway.getHealthMonitor('apifootball');
    healthMonitor.activateForTest();

    // Mock globalGateway.fetch
    const spy = vi.spyOn(globalGateway, 'fetch').mockResolvedValueOnce(
      new Response(JSON.stringify({ response: { account: { email: 'test@example.com' } } }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    );

    const report = await evaluateCanonicalProviderHealth();

    expect(spy).toHaveBeenCalledWith(
      'apifootball',
      'health',
      expect.stringContaining('/status'),
      expect.objectContaining({ cacheTtlMs: 300000, quotaPriority: 10 })
    );
    expect(report.apiFootball.status).toBe('DATA_AVAILABLE');
    expect(report.apiFootball.authenticated).toBe(true);
    expect(report.apiFootball.dataAvailable).toBe(true);

    spy.mockRestore();
    healthMonitor.pause(); // Return to safe default
  });
});

