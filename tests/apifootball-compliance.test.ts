import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  canonicalizeUrl,
  canonicalRequestKey,
  requestFingerprint,
} from '@/lib/providers/requestIdentity';
import {
  ProviderGateway,
  memoryCache,
  globalMemoryCache,
  getEndpointTtlMs,
  ProviderUnavailableError,
} from '@/lib/providers/providerGateway';
import { providerAuditLog } from '@/lib/providers/providerAuditLog';
import { ProviderHealthMonitor } from '@/lib/providers/providerHealth';
import {
  getProviderQuotaPolicy,
  PRO_DAILY_HARD_LIMIT,
  PRO_DAILY_SOFT_LIMIT,
} from '@/lib/providers/quotaPolicy';
import * as quotaManager from '@/lib/providers/quotaManagerV4';

vi.mock('@/lib/providers/quotaManagerV4', () => ({
  reserveQuota: vi.fn(),
  confirmQuota: vi.fn(),
  rollbackQuota: vi.fn(),
}));

const originalFetch = global.fetch;

function mockReserveOk(id = 'res-1') {
  vi.mocked(quotaManager.reserveQuota).mockResolvedValueOnce({
    ok: true,
    reason: 'ok',
    reservationId: id,
    cost: 1,
    provider: 'apifootball',
    endpoint: 'fixtures',
    mode: 'NORMAL',
  });
}

describe('API-Football P0 compliance', () => {
  describe('canonical request identity (Phase 4)', () => {
    it('treats reordered query params as the same request', () => {
      const a = canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url: 'https://host/fixtures?league=39&season=2026' });
      const b = canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url: 'https://host/fixtures?season=2026&league=39' });
      expect(a).toBe(b);
    });

    it('distinguishes different parameters', () => {
      const a = canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url: 'https://host/fixtures?league=39' });
      const b = canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url: 'https://host/fixtures?league=140' });
      expect(a).not.toBe(b);
    });

    it('never includes a credential-like parameter in the identity or fingerprint', () => {
      const url = 'https://host/fixtures?league=39&apiKey=SUPERSECRETVALUE';
      const key = canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url });
      const fp = requestFingerprint({ provider: 'apifootball', endpoint: 'fixtures', url });
      expect(key).not.toContain('SUPERSECRETVALUE');
      expect(fp).not.toContain('SUPERSECRETVALUE');
      // identical request without the credential resolves to the same identity
      expect(key).toBe(canonicalRequestKey({ provider: 'apifootball', endpoint: 'fixtures', url: 'https://host/fixtures?league=39' }));
    });

    it('canonicalizes host case and trailing slashes', () => {
      expect(canonicalizeUrl('HTTPS://Host.COM/fixtures/?a=1')).toBe('https://host.com/fixtures?a=1');
    });
  });

  describe('endpoint TTL policy (Phase 5)', () => {
    it('has sane, differentiated TTLs', () => {
      expect(getEndpointTtlMs('leagues')).toBeGreaterThan(getEndpointTtlMs('fixtures'));
      expect(getEndpointTtlMs('odds/live')).toBeLessThan(getEndpointTtlMs('odds'));
      expect(getEndpointTtlMs('unknown-endpoint')).toBeGreaterThan(0);
    });
  });

  describe('gateway dedup + cache + provenance (Phases 4/5/10)', () => {
    let gateway: ProviderGateway;

    beforeEach(() => {
      vi.resetAllMocks();
      global.fetch = vi.fn();
      globalMemoryCache.clear();
      providerAuditLog.reset();
      gateway = new ProviderGateway(memoryCache);
      gateway.getHealthMonitor('apifootball').activateForTest();
    });

    afterAll(() => {
      global.fetch = originalFetch;
    });

    it('collapses N concurrent identical requests to ONE provider call', async () => {
      mockReserveOk('res-concurrent');
      vi.mocked(quotaManager.confirmQuota).mockResolvedValue({ ok: true });
      const mockResponse = new Response('{"ok":true}', { status: 200 });
      vi.mocked(global.fetch).mockResolvedValueOnce(mockResponse as any);

      const url = 'https://host/fixtures?league=39&season=2026';
      const [r1, r2, r3] = await Promise.all([
        gateway.fetch('apifootball', 'fixtures', url, { cacheTtlMs: 60000 }),
        gateway.fetch('apifootball', 'fixtures', url, { cacheTtlMs: 60000 }),
        gateway.fetch('apifootball', 'fixtures', url, { cacheTtlMs: 60000 }),
      ]);

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(quotaManager.reserveQuota).toHaveBeenCalledTimes(1);
      expect(r1.status).toBe(200);
      expect(r2.status).toBe(200);
      expect(r3.status).toBe(200);
    });

    it('returns the cached response without a second provider call', async () => {
      mockReserveOk('res-cache');
      vi.mocked(quotaManager.confirmQuota).mockResolvedValue({ ok: true });
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response('{"v":1}', { status: 200 }) as any);

      const url = 'https://host/fixtures?date=2026-01-01';
      await gateway.fetch('apifootball', 'fixtures', url, { cacheTtlMs: 60000 });
      const second = await gateway.fetch('apifootball', 'fixtures', url, { cacheTtlMs: 60000 });

      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(quotaManager.reserveQuota).toHaveBeenCalledTimes(1); // cache hit never reserves
      expect(await second.text()).toContain('"v":1');
      expect(second.headers.get('x-hl-source-status')).toBe('CACHE');
    });

    it('attaches REAL_PROVIDER provenance and audit classification on a fresh call', async () => {
      mockReserveOk('res-prov');
      vi.mocked(quotaManager.confirmQuota).mockResolvedValue({ ok: true });
      vi.mocked(global.fetch).mockResolvedValueOnce(new Response('{"v":2}', { status: 200 }) as any);

      const res = await gateway.fetch('apifootball', 'fixtures', 'https://host/fixtures?date=2026-02-02', { cacheTtlMs: 60000 });
      expect(res.headers.get('x-hl-provider')).toBe('apifootball');
      expect(res.headers.get('x-hl-source-status')).toBe('REAL_PROVIDER');
      expect(res.headers.get('x-hl-request-fingerprint')).toMatch(/^[0-9a-f]{8}$/);

      const summary = providerAuditLog.getSummary();
      expect(summary.providerRequests).toBe(1);
      expect(summary.byEndpoint['fixtures']).toBe(1);
    });

    it('rejects requests while the provider circuit is open and audits it', async () => {
      mockReserveOk('res-circuit');
      vi.mocked(quotaManager.confirmQuota).mockResolvedValue({ ok: true });

      const monitor = gateway.getHealthMonitor('apifootball');
      for (let i = 0; i < 5; i++) monitor.onFailure();
      expect(monitor.getState()).toBe('FAILED');

      await expect(
        gateway.fetch('apifootball', 'fixtures', 'https://host/fixtures?date=2026-03-03', { cacheTtlMs: 0 })
      ).rejects.toBeInstanceOf(ProviderUnavailableError);

      expect(global.fetch).not.toHaveBeenCalled();
      const summary = providerAuditLog.getSummary();
      expect(summary.byClassification['CIRCUIT_OPEN']).toBe(1);
    });
  });

  describe('quota plan centralization (Phase 7)', () => {
    it('uses the Pro contract by default', () => {
      expect(PRO_DAILY_HARD_LIMIT).toBe(7500);
      expect(PRO_DAILY_SOFT_LIMIT).toBe(6000);
      const policy = getProviderQuotaPolicy('apifootball');
      expect(policy.hardLimit).toBe(7500);
      expect(policy.softLimit).toBe(6000);
    });
  });

  describe('provider health states (Phase 8)', () => {
    it('defaults apifootball to PAUSED on cold start per P0 requirement', async () => {
      const monitor = new ProviderHealthMonitor({ provider: 'apifootball' });
      expect(monitor.getState()).toBe('PAUSED');
      await expect(monitor.allowRequest()).resolves.toBe(false);
    });

    it('maps circuit transitions to ACTIVE/PAUSED/FAILED/DISABLED once activated', () => {
      const monitor = new ProviderHealthMonitor({ provider: 'apifootball', failureThreshold: 2, cooldownMs: 1 });
      expect(monitor.getState()).toBe('PAUSED');
      monitor.activateForTest();
      expect(monitor.getState()).toBe('ACTIVE');
      monitor.onFailure();
      monitor.onFailure();
      expect(monitor.getState()).toBe('FAILED');
      monitor.disable();
      expect(monitor.getState()).toBe('DISABLED');
      monitor.enable();
      expect(monitor.getState()).toBe('ACTIVE');
    });
  });

  describe('secret safety (Phase 2)', () => {
    const srcDir = path.join(process.cwd(), 'src');

    function walk(dir: string, acc: string[] = []): string[] {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full, acc);
        else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) acc.push(full);
      }
      return acc;
    }

    it('never references a client-exposed API-Football secret', () => {
      const offenders: string[] = [];
      for (const file of walk(srcDir)) {
        const content = fs.readFileSync(file, 'utf-8');
        if (/NEXT_PUBLIC_[A-Z_]*FOOTBALL/.test(content) || /VITE_[A-Z_]*FOOTBALL/.test(content)) {
          offenders.push(path.relative(process.cwd(), file));
        }
      }
      expect(offenders).toEqual([]);
    });

    it('does not log the API-Football key in scratch diagnostics', () => {
      const scratch = path.join(process.cwd(), 'scratch', 'check-key-status.ts');
      if (!fs.existsSync(scratch)) return;
      const content = fs.readFileSync(scratch, 'utf-8');
      expect(content).not.toMatch(/with key/);
      expect(content).not.toMatch(/rapidapi\.com/i);
      expect(content).not.toMatch(/x-rapidapi-key/i);
      expect(content).not.toMatch(/\$\{apiKey\}/);
    });
  });
});
