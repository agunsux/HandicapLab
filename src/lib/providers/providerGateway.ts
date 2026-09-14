import { reserveQuota, confirmQuota, rollbackQuota, Provider } from './quotaManagerV4';
import { canonicalRequestKey, requestFingerprint } from './requestIdentity';
import { ProviderHealthMonitor } from './providerHealth';
import { providerAuditLog, classifyHttpStatus, type ResponseClassification } from './providerAuditLog';
import { RateLimiter } from '@/lib/http/RateLimiter';

export class QuotaExhaustionError extends Error {
  constructor(message: string, public context: any) {
    super(message);
    this.name = 'QuotaExhaustionError';
  }
}

export class ProviderUnavailableError extends Error {
  constructor(public provider: Provider, public state: string) {
    super(`Provider ${provider} is not accepting requests (state=${state}).`);
    this.name = 'ProviderUnavailableError';
  }
}

export class ProviderRateLimitedError extends Error {
  constructor(public provider: Provider, public reason: string) {
    super(`Provider ${provider} rate limited the request: ${reason}`);
    this.name = 'ProviderRateLimitedError';
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

// ---------------------------------------------------------------------------
// Centralized endpoint freshness policy (Phase 5). Callers may override via
// `cacheTtlMs`. Values are deliberately conservative to avoid refetching stable
// reference data while keeping match data reasonably fresh.
// ---------------------------------------------------------------------------
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const ENDPOINT_TTL_MS: Record<string, number> = {
  leagues: DAY,
  teams: DAY,
  'teams/statistics': 6 * HOUR,
  standings: 6 * HOUR,
  fixtures: MINUTE,
  'fixtures/historical': DAY,
  'fixtures/postmatch': 30 * MINUTE,
  'fixtures/statistics': 6 * HOUR,
  injuries: 15 * MINUTE,
  lineups: 15 * MINUTE,
  venues: 7 * DAY,
  odds: 5 * MINUTE,
  'odds/bookmakers': 7 * DAY,
  'odds/bets': 7 * DAY,
  'odds/live': 30 * 1000,
  health: 5 * MINUTE,
};

export function getEndpointTtlMs(endpoint: string): number {
  const normalized = endpoint.replace(/^\/+/, '');
  return ENDPOINT_TTL_MS[normalized] ?? MINUTE;
}

function envInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

interface ProviderRuntimeLimit {
  maxRequests: number;
  windowMs: number;
  maxConcurrency: number;
}

/** Per-provider request pacing. Conservative by default (anti-suspension). */
function getProviderRuntimeLimit(provider: Provider): ProviderRuntimeLimit {
  if (provider === 'apifootball') {
    return {
      maxRequests: envInt('APIFOOTBALL_RATE_LIMIT_PER_MIN', 10),
      windowMs: MINUTE,
      maxConcurrency: envInt('APIFOOTBALL_MAX_CONCURRENCY', 3),
    };
  }
  if (provider === 'oddspapi') {
    return {
      maxRequests: envInt('ODDSPAPI_RATE_LIMIT_PER_MIN', 30),
      windowMs: MINUTE,
      maxConcurrency: envInt('ODDSPAPI_MAX_CONCURRENCY', 3),
    };
  }
  return {
    maxRequests: envInt('THESTATSAPI_RATE_LIMIT_PER_MIN', 60),
    windowMs: MINUTE,
    maxConcurrency: 4,
  };
}

/** Minimal bounded semaphore for provider concurrency control. */
class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async acquire(timeoutMs: number): Promise<boolean> {
    if (this.active < this.max) {
      this.active++;
      return true;
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      const grant = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.active++;
        resolve(true);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        this.queue = this.queue.filter((q) => q !== grant);
        resolve(false);
      }, timeoutMs);
      this.queue.push(grant);
    });
  }

  release(): void {
    this.active = Math.max(0, this.active - 1);
    const next = this.queue.shift();
    if (next) next();
  }
}

function addProvenance(
  response: Response,
  meta: { provider: string; endpoint: string; fingerprint: string; sourceStatus: string }
): Response {
  const headers = new Headers(response.headers);
  headers.set('x-hl-provider', meta.provider);
  headers.set('x-hl-endpoint', meta.endpoint);
  headers.set('x-hl-fetched-at', new Date().toISOString());
  headers.set('x-hl-source-status', meta.sourceStatus);
  headers.set('x-hl-request-fingerprint', meta.fingerprint);
  headers.set('x-hl-data-version', '1');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export class ProviderGateway {
  private cache: CacheStore;
  private rateLimiters = new Map<Provider, RateLimiter>();
  private semaphores = new Map<Provider, Semaphore>();
  private health = new Map<Provider, ProviderHealthMonitor>();

  constructor(cache?: CacheStore) {
    this.cache = cache || memoryCache;
  }

  private buildCacheKey(provider: Provider, endpoint: string, method: string, url: string, body?: string) {
    // Canonical identity: query-param order and volatile params cannot split the key.
    return `gwcache:${canonicalRequestKey({ provider, endpoint, method, url, body })}`;
  }

  private getRateLimiter(provider: Provider): RateLimiter {
    let limiter = this.rateLimiters.get(provider);
    if (!limiter) {
      const limit = getProviderRuntimeLimit(provider);
      limiter = new RateLimiter({ maxRequests: limit.maxRequests, windowMs: limit.windowMs, provider });
      this.rateLimiters.set(provider, limiter);
    }
    return limiter;
  }

  private getSemaphore(provider: Provider): Semaphore {
    let sem = this.semaphores.get(provider);
    if (!sem) {
      sem = new Semaphore(getProviderRuntimeLimit(provider).maxConcurrency);
      this.semaphores.set(provider, sem);
    }
    return sem;
  }

  /** Exposed for health/probe endpoints. */
  getHealthMonitor(provider: Provider): ProviderHealthMonitor {
    let monitor = this.health.get(provider);
    if (!monitor) {
      monitor = new ProviderHealthMonitor({ provider });
      this.health.set(provider, monitor);
    }
    return monitor;
  }

  async _fetchInternal(
    provider: Provider,
    endpoint: string,
    url: string,
    options: GatewayOptions,
    cacheKey: string
  ): Promise<Response> {
    const { quotaPriority = 50, cacheTtlMs, ...fetchOptions } = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const ttl = cacheTtlMs === undefined ? getEndpointTtlMs(endpoint) : cacheTtlMs;
    const fingerprint = requestFingerprint({ provider, endpoint, method, url, body: fetchOptions.body as string });
    const startedAt = Date.now();

    const record = (partial: {
      statusCode: number | null;
      classification: ResponseClassification;
      cacheHit?: boolean;
      deduplicated?: boolean;
      retryCount?: number;
      quotaReservationId?: string | null;
      errorClass?: string | null;
    }) => {
      providerAuditLog.record({
        timestamp: new Date().toISOString(),
        provider,
        endpoint,
        method,
        fingerprint,
        statusCode: partial.statusCode,
        latencyMs: Date.now() - startedAt,
        cacheHit: partial.cacheHit ?? false,
        deduplicated: partial.deduplicated ?? false,
        retryCount: partial.retryCount ?? 0,
        quotaReservationId: partial.quotaReservationId ?? null,
        responseClassification: partial.classification,
        errorClass: partial.errorClass ?? null,
      });
    };

    // 1. CACHE CHECK — never reserves quota or touches the network on a hit.
    if (ttl > 0 && method === 'GET') {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        record({ statusCode: cached.status, classification: 'CACHE_HIT', cacheHit: true });
        return addProvenance(
          new Response(cached.body, { status: cached.status, headers: new Headers(cached.headers) }),
          { provider, endpoint, fingerprint, sourceStatus: 'CACHE' }
        );
      }
    }

    // 2. PROVIDER HEALTH / CIRCUIT BREAKER
    const health = this.getHealthMonitor(provider);
    const allowed = await health.allowRequest();
    if (!allowed) {
      const state = health.getState();
      record({ statusCode: null, classification: 'CIRCUIT_OPEN', errorClass: `Provider ${state}` });
      throw new ProviderUnavailableError(provider, state);
    }

    // 3. ATOMIC QUOTA RESERVATION (Provider Manager stays authoritative)
    const reqId = crypto.randomUUID();
    const receipt = await reserveQuota(provider, endpoint, quotaPriority, reqId);
    if (!receipt.ok) {
      record({ statusCode: null, classification: 'QUOTA_BLOCKED', errorClass: receipt.reason });
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

    // 4. RATE LIMIT + CONCURRENCY (bounded; never an unbounded retry loop)
    const limiter = this.getRateLimiter(provider);
    const gotToken = await limiter.acquire(30_000);
    if (!gotToken) {
      await rollbackQuota(receipt.reservationId);
      record({ statusCode: null, classification: 'RATE_LIMITED', errorClass: 'LOCAL_RATE_LIMIT_TIMEOUT' });
      throw new ProviderRateLimitedError(provider, 'local rate limiter timeout');
    }

    const semaphore = this.getSemaphore(provider);
    const gotSlot = await semaphore.acquire(30_000);
    if (!gotSlot) {
      await rollbackQuota(receipt.reservationId);
      record({ statusCode: null, classification: 'RATE_LIMITED', errorClass: 'CONCURRENCY_LIMIT_TIMEOUT' });
      throw new ProviderRateLimitedError(provider, 'concurrency limit timeout');
    }

    let response: Response;
    try {
      // 5. EXTERNAL HTTP REQUEST
      response = await fetch(url, fetchOptions);
    } catch (error: any) {
      await rollbackQuota(receipt.reservationId);
      health.onFailure();
      record({ statusCode: null, classification: 'NETWORK_ERROR', errorClass: error?.name || 'Error', quotaReservationId: receipt.reservationId });
      throw error;
    } finally {
      semaphore.release();
    }

    // 6. HTTP FAILURE / QUOTA ACCOUNTING
    let limitRemaining: number | undefined;
    let limitTotal: number | undefined;
    if (provider === 'apifootball') {
      const hTotal = response.headers.get('x-ratelimit-requests-limit') || response.headers.get('x-ratelimit-limit');
      const hRem = response.headers.get('x-ratelimit-requests-remaining') || response.headers.get('x-ratelimit-remaining');
      if (hTotal) limitTotal = parseInt(hTotal, 10);
      if (hRem) limitRemaining = parseInt(hRem, 10);
    }

    const classification = classifyHttpStatus(response.status);

    // 429 must NOT be retried in a storm; the canonical client applies bounded
    // backoff. 5xx/network are provider failures for circuit purposes.
    if (response.status === 429) {
      health.onFailure();
    } else if (response.status >= 500) {
      health.onFailure();
    } else if (response.ok) {
      health.onSuccess();
    }

    // Conservative accounting: a completed HTTP cycle consumed quota.
    await confirmQuota(receipt.reservationId, receipt.cost, limitTotal, limitRemaining);
    record({
      statusCode: response.status,
      classification,
      quotaReservationId: receipt.reservationId,
      errorClass: response.ok ? null : `HTTP_${response.status}`,
    });

    // 7. CACHE RESPONSE (success only)
    let finalResponse = response;
    if (response.ok && ttl > 0 && method === 'GET') {
      const cloned = response.clone();
      const body = await cloned.text();
      const headersObj: Record<string, string> = {};
      cloned.headers.forEach((val, key) => (headersObj[key] = val));
      await this.cache.set(cacheKey, { body, status: cloned.status, headers: headersObj }, ttl);
      finalResponse = response;
    }

    return addProvenance(finalResponse, {
      provider,
      endpoint,
      fingerprint,
      sourceStatus: response.ok ? 'REAL_PROVIDER' : 'PROVIDER_ERROR',
    });
  }

  async fetch(
    provider: Provider,
    endpoint: string,
    url: string,
    options: GatewayOptions = {}
  ): Promise<Response> {
    const fetchOptions = options;
    const method = (fetchOptions.method || 'GET').toUpperCase();
    const cacheKey = this.buildCacheKey(provider, endpoint, method, url, fetchOptions.body as string);

    if (method === 'GET') {
      const inFlight = inFlightRequests.get(cacheKey);
      if (inFlight) {
        // Identical in-flight request: dedupe — zero additional provider calls.
        providerAuditLog.record({
          timestamp: new Date().toISOString(),
          provider,
          endpoint,
          method,
          fingerprint: requestFingerprint({ provider, endpoint, method, url, body: fetchOptions.body as string }),
          statusCode: null,
          latencyMs: 0,
          cacheHit: false,
          deduplicated: true,
          retryCount: 0,
          quotaReservationId: null,
          responseClassification: 'DEDUPLICATED',
          errorClass: null,
        });
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
    }

    return this._fetchInternal(provider, endpoint, url, options, cacheKey);
  }
}

export const globalGateway = new ProviderGateway();
