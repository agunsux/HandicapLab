import { reserveQuota, confirmQuota, rollbackQuota, Provider } from './quotaManagerV4';

export class QuotaExhaustionError extends Error {
  constructor(message: string, public context: any) {
    super(message);
    this.name = 'QuotaExhaustionError';
  }
}

interface CacheStore {
  get(key: string): Promise<any | null>;
  set(key: string, value: any, ttlMs: number): Promise<void>;
}

// In-memory naive cache for now, can be swapped with Redis/Supabase
export const globalMemoryCache = new Map<string, { value: any; expiry: number }>();
export const memoryCache: CacheStore = {
  async get(key: string) {
    const entry = globalMemoryCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      globalMemoryCache.delete(key);
      return null;
    }
    return entry.value;
  },
  async set(key: string, value: any, ttlMs: number) {
    globalMemoryCache.set(key, { value, expiry: Date.now() + ttlMs });
  }
};

export interface GatewayOptions extends RequestInit {
  quotaPriority?: number; // 0-100
  cacheTtlMs?: number; // 0 disables cache
}

// In-flight request deduplication registry
export const inFlightRequests = new Map<string, Promise<Response>>();

export class ProviderGateway {
  private cache: CacheStore;

  constructor(cache?: CacheStore) {
    this.cache = cache || memoryCache;
  }

  private buildCacheKey(provider: Provider, endpoint: string, method: string, url: string, body?: string) {
    return `gwcache:${provider}:${endpoint}:${method}:${url}:${body || ''}`;
  }

  async _fetchInternal(
    provider: Provider,
    endpoint: string,
    url: string,
    options: GatewayOptions,
    cacheKey: string
  ): Promise<Response> {
    const { quotaPriority = 50, cacheTtlMs = 0, ...fetchOptions } = options;
    const method = fetchOptions.method || 'GET';

    // 1. CACHE CHECK
    if (cacheTtlMs > 0 && method === 'GET') {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return new Response(cached.body, {
          status: cached.status,
          headers: new Headers(cached.headers),
        });
      }
    }

    // 2. ATOMIC QUOTA RESERVATION
    const reqId = crypto.randomUUID();
    const receipt = await reserveQuota(provider, endpoint, quotaPriority, reqId);
    if (!receipt.ok) {
      throw new QuotaExhaustionError(`Quota exhausted or blocked for ${provider}`, {
        provider,
        endpoint,
        reason: receipt.reason,
        mode: receipt.mode,
      });
    }

    if (!receipt.reservationId) {
      throw new Error(`Reservation ID missing for ${provider}`);
    }

    let response: Response;
    try {
      // 3. EXTERNAL HTTP REQUEST
      response = await fetch(url, fetchOptions);
    } catch (error) {
      // Network failure before request transmission or timeout
      await rollbackQuota(receipt.reservationId);
      throw error;
    }

    // 4. HTTP FAILURE / QUOTA ACCOUNTING
    // API-Football header parsing
    let limitRemaining: number | undefined;
    let limitTotal: number | undefined;

    if (provider === 'apifootball') {
      const hTotal = response.headers.get('x-ratelimit-requests-limit') || response.headers.get('x-ratelimit-limit');
      const hRem = response.headers.get('x-ratelimit-requests-remaining') || response.headers.get('x-ratelimit-remaining');
      if (hTotal) limitTotal = parseInt(hTotal, 10);
      if (hRem) limitRemaining = parseInt(hRem, 10);
    }

    // If 429 rate limit or 403 (unauthorized/invalid key), provider might not charge us, or they might.
    // For API-Football and OddsPapi, 4xx usually counts against quota if it hits the API layer (except 401 sometimes).
    // To fail safely, we confirm the quota (meaning we assume it was consumed) to avoid under-accounting,
    // unless it's a 50x error which we might rollback if the provider doesn't charge for 50x.
    // Let's be conservative: if HTTP completed, we consume it.
    await confirmQuota(receipt.reservationId, receipt.cost, limitTotal, limitRemaining);

    // 5. CACHE RESPONSE
    if (response.ok && cacheTtlMs > 0 && method === 'GET') {
      const cloned = response.clone();
      const body = await cloned.text();
      const headersObj: Record<string, string> = {};
      cloned.headers.forEach((val, key) => (headersObj[key] = val));

      await this.cache.set(cacheKey, {
        body,
        status: cloned.status,
        headers: headersObj,
      }, cacheTtlMs);
    }

    return response;
  }

  async fetch(
    provider: Provider,
    endpoint: string,
    url: string,
    options: GatewayOptions = {}
  ): Promise<Response> {
    const { quotaPriority = 50, cacheTtlMs = 0, ...fetchOptions } = options;
    const method = fetchOptions.method || 'GET';
    const cacheKey = this.buildCacheKey(provider, endpoint, method, url, fetchOptions.body as string);

    if (method === 'GET') {
      // Defer to the shared promise or create a new one
      const inFlight = inFlightRequests.get(cacheKey);
      if (inFlight) {
        // Fallback catch if somehow it reached here instead of the check inside _fetchInternal,
        // though normally it is handled above.
        return (await inFlight).clone();
      }

      const promise = this._fetchInternal(provider, endpoint, url, options, cacheKey);
      inFlightRequests.set(cacheKey, promise);
      try {
        const res = await promise;
        return res.clone();
      } finally {
        inFlightRequests.delete(cacheKey);
      }
    } else {
      return this._fetchInternal(provider, endpoint, url, options, cacheKey);
    }
  }
}

export const globalGateway = new ProviderGateway();
