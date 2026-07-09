// HTTP Cache — TTL-Based Deduplication with LRU Eviction
// Location: src/lib/http/Cache.ts
// Usage: const cache = new Cache({ defaultTtlMs: 30_000, maxEntries: 100, provider: 'api-football' });
//        const cached = cache.get('fixtures-2025-01-01');

import type { CacheConfig } from './types';

interface CacheEntry<T = unknown> {
  data: T;
  expiresAt: number;
  createdAt: number;
  accessCount: number;
}

export class Cache {
  private readonly config: Required<CacheConfig>;
  private store: Map<string, CacheEntry> = new Map();
  private hitCount = 0;
  private missCount = 0;

  constructor(config: CacheConfig) {
    this.config = {
      defaultTtlMs: config.defaultTtlMs,
      maxEntries: config.maxEntries,
      provider: config.provider,
    };
  }

  /**
   * Get a cached value. Returns null if not found or expired.
   */
  get<T>(key: string): T | null {
    const entry = this.store.get(key);
    if (!entry) {
      this.missCount++;
      return null;
    }

    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      this.missCount++;
      return null;
    }

    entry.accessCount++;
    this.hitCount++;
    return entry.data as T;
  }

  /**
   * Set a value in cache with optional TTL override.
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    // Evict if at capacity
    if (this.store.size >= this.config.maxEntries) {
      this.evictLRU();
    }

    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttlMs ?? this.config.defaultTtlMs),
      createdAt: Date.now(),
      accessCount: 0,
    });
  }

  /**
   * Check if a key exists and is not expired.
   */
  has(key: string): boolean {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete a specific key.
   */
  delete(key: string): void {
    this.store.delete(key);
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.store.clear();
  }

  /**
   * Get cache statistics.
   */
  getStats() {
    return {
      size: this.store.size,
      maxEntries: this.config.maxEntries,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount + this.missCount > 0
        ? this.hitCount / (this.hitCount + this.missCount)
        : 0,
      provider: this.config.provider,
    };
  }

  /**
   * Build a cache key from URL parts.
   */
  static buildKey(baseUrl: string, path: string, queryParams?: Record<string, string | number | undefined>): string {
    const query = queryParams
      ? '?' + Object.entries(queryParams)
          .filter(([_, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : '';
    return `${baseUrl}${path}${query}`;
  }

  /**
   * Evict least recently accessed entry.
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.accessCount < oldestAccess) {
        oldestAccess = entry.accessCount;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}
