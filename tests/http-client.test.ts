// HTTP Layer Tests — RateLimiter, CircuitBreaker, Cache, HttpClient
import { describe, it, expect, beforeEach } from 'vitest';
import { RateLimiter } from '../src/lib/http/RateLimiter';
import { CircuitBreaker } from '../src/lib/http/CircuitBreaker';
import { Cache } from '../src/lib/http/Cache';

describe('RateLimiter', () => {
  const limiter = new RateLimiter({ maxRequests: 5, windowMs: 60_000, provider: 'test' });

  it('allows requests within limit', async () => {
    for (let i = 0; i < 5; i++) {
      expect(await limiter.acquire()).toBe(true);
    }
  });

  it('returns remaining tokens count', () => {
    const r = new RateLimiter({ maxRequests: 10, windowMs: 60_000, provider: 'test' });
    expect(r.getTokensRemaining()).toBe(10);
  });

  it('reset restores full tokens', () => {
    const r = new RateLimiter({ maxRequests: 3, windowMs: 60_000, provider: 'test' });
    r.acquire(); r.acquire(); r.acquire();
    r.reset();
    expect(r.getTokensRemaining()).toBe(3);
  });
});

describe('CircuitBreaker', () => {
  let cb: CircuitBreaker;

  beforeEach(() => {
    cb = new CircuitBreaker({ failureThreshold: 3, cooldownMs: 60_000, halfOpenSuccessThreshold: 2, provider: 'test' });
  });

  it('starts closed', () => {
    expect(cb.getStatus().state).toBe('CLOSED');
  });

  it('opens after failure threshold', () => {
    cb.onFailure();
    cb.onFailure();
    cb.onFailure();
    expect(cb.getStatus().state).toBe('OPEN');
    expect(cb.getStatus().failureCount).toBe(3);
  });

  it('blocks requests when open', async () => {
    cb.onFailure(); cb.onFailure(); cb.onFailure();
    expect(await cb.allowRequest()).toBe(false);
  });

  it('allows requests when closed', async () => {
    expect(await cb.allowRequest()).toBe(true);
  });

  it('reset restores closed state', () => {
    cb.onFailure(); cb.onFailure(); cb.onFailure();
    expect(cb.getStatus().state).toBe('OPEN');
    cb.reset();
    expect(cb.getStatus().state).toBe('CLOSED');
    expect(cb.getStatus().failureCount).toBe(0);
  });
});

describe('Cache', () => {
  let cache: Cache;

  beforeEach(() => {
    cache = new Cache({ defaultTtlMs: 1000, maxEntries: 100, provider: 'test' });
  });

  it('stores and retrieves values', () => {
    cache.set('key1', { foo: 'bar' });
    expect(cache.get('key1')).toEqual({ foo: 'bar' });
  });

  it('returns null for missing key', () => {
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('expires entries after TTL', async () => {
    cache = new Cache({ defaultTtlMs: 10, maxEntries: 100, provider: 'test' });
    cache.set('key', 'value');
    await new Promise(r => setTimeout(r, 20));
    expect(cache.get('key')).toBeNull();
  });

  it('has() checks existence', () => {
    cache.set('key', 'val');
    expect(cache.has('key')).toBe(true);
    expect(cache.has('other')).toBe(false);
  });

  it('delete() removes entry', () => {
    cache.set('key', 'val');
    cache.delete('key');
    expect(cache.has('key')).toBe(false);
  });

  it('clear() removes all entries', () => {
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.getStats().size).toBe(0);
  });

  it('tracks hit/miss rate', () => {
    cache.get('miss');
    cache.get('miss2');
    cache.set('hit', 'val');
    cache.get('hit');
    const stats = cache.getStats();
    expect(stats.hitCount).toBe(1);
    expect(stats.missCount).toBe(2);
  });

  it('buildKey generates consistent cache keys', () => {
    const k1 = Cache.buildKey('https://api.com', '/v3/fixtures', { league: '39', season: '2024' });
    const k2 = Cache.buildKey('https://api.com', '/v3/fixtures', { season: '2024', league: '39' });
    expect(k1).toBe(k2);
    expect(k1).toContain('league=39');
    expect(k1).toContain('season=2024');
  });
});
