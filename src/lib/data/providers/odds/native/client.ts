// Native OddsPAPI v4 HTTP Client
// Location: src/lib/data/providers/odds/native/client.ts
// Thin quota-aware wrapper around the existing HttpClient infrastructure.
// Every billable call is reserved/confirmed through the central Quota Manager;
// the API key is injected server-side via the provider config and is never
// logged or exposed.

import { z } from 'zod';
import { logger } from '@/lib/logger';
import { HttpClient, RateLimiter, CircuitBreaker, Cache } from '@/lib/http';
import { getProviderConfig } from '../../core/config';
import { reserveQuota, confirmQuota, rollbackQuota } from '@/lib/providers/quotaManagerV4';

const log = logger.child('oddsapi:native:client');

export type OddsPapiEndpoint =
  | 'sports'
  | 'tournaments'
  | 'bookmakers'
  | 'markets'
  | 'fixtures'
  | 'odds'
  | 'odds-by-tournaments'
  | 'account';

// Documented endpoint cooldowns (oddspapi.io/docs): rate limiter config
// per provider (30 req/min basic plan) plus endpoint cooldown respected via
// cache TTL where appropriate.
const ENDPOINT_COOLDOWN_MS: Record<OddsPapiEndpoint, number> = {
  sports: 1000,
  tournaments: 1000,
  bookmakers: 1000,
  markets: 1000,
  fixtures: 2000,
  odds: 500,
  'odds-by-tournaments': 1000,
  account: 0,
};

// Cache TTLs: static metadata is cached long, odds are cached very briefly.
const ENDPOINT_CACHE_TTL_MS: Record<OddsPapiEndpoint, number> = {
  sports: 24 * 60 * 60 * 1000,
  tournaments: 24 * 60 * 60 * 1000,
  bookmakers: 24 * 60 * 60 * 1000,
  markets: 24 * 60 * 60 * 1000,
  fixtures: 30_000,
  odds: 30_000,
  'odds-by-tournaments': 30_000,
  account: 60_000,
};

export interface NativeOddsResponse<T> {
  data: T;
  status: number;
  fromCache: boolean;
}

/**
 * Error classified for provider status diagnostics. The raw HTTP status and a
 * stable error code are preserved server-side; the API key is never included.
 */
export class OddsPapiError extends Error {
  public readonly kind:
    | 'INVALID_KEY'
    | 'RATE_LIMITED'
    | 'CONTRACT_ERROR'
    | 'PARSING_ERROR'
    | 'NETWORK'
    | 'QUOTA';
  public readonly httpStatus?: number;
  public readonly errorCode?: string;
  public readonly endpoint: string;

  constructor(
    kind: OddsPapiError['kind'],
    endpoint: string,
    message: string,
    httpStatus?: number,
    errorCode?: string
  ) {
    super(message);
    this.name = 'OddsPapiError';
    this.kind = kind;
    this.endpoint = endpoint;
    this.httpStatus = httpStatus;
    this.errorCode = errorCode;
  }
}

export class NativeOddsClient {
  private client: HttpClient;
  private cooldownMap = new Map<OddsPapiEndpoint, number>();
  private readonly baseUrl: string;

  constructor(client?: HttpClient) {
    const config = getProviderConfig().oddsPapi;
    // The HttpClient resolves `new URL(path, baseUrl)`; without a trailing
    // slash, `https://api.oddspapi.io/v4` is treated as a file path and a
    // relative path like `sports` would drop the `/v4` segment. We therefore
    // build the absolute URL ourselves.
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.client =
      client ??
      new HttpClient(
        {
          baseUrl: config.baseUrl,
          defaultTimeoutMs: 15_000,
          defaultRetries: 2,
          provider: 'oddspapi',
          defaultQueryParams: { apiKey: config.apiKey },
        },
        new RateLimiter({ maxRequests: 30, windowMs: 60_000, provider: 'oddspapi' }),
        new CircuitBreaker({ failureThreshold: 5, cooldownMs: 60_000, halfOpenSuccessThreshold: 2, provider: 'oddspapi' }),
        new Cache({ defaultTtlMs: 30_000, maxEntries: 200, provider: 'oddspapi' })
      );
  }

  /**
   * Build the absolute OddsPAPI URL so the /v4 base path is always preserved.
   * `new URL('sports', 'https://api.oddspapi.io/v4')` would yield
   * `https://api.oddspapi.io/sports` (404) — this must never happen.
   */
  private resolveUrl(path: string): string {
    return `${this.baseUrl}/${path.replace(/^\/+/, '')}`;
  }

  /**
   * Enforce the documented per-endpoint cooldown (min interval between calls).
   */
  private async respectCooldown(endpoint: OddsPapiEndpoint): Promise<void> {
    const cooldownMs = ENDPOINT_COOLDOWN_MS[endpoint] ?? 0;
    if (cooldownMs <= 0) return;
    const last = this.cooldownMap.get(endpoint) ?? 0;
    const wait = last + cooldownMs - Date.now();
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    this.cooldownMap.set(endpoint, Date.now());
  }

  /**
   * Execute a GET request against the OddsPAPI v4 API with quota accounting,
   * endpoint cooldown and response classification.
   */
  async get<T extends z.ZodTypeAny>(
    path: string,
    params: Record<string, string | number | undefined>,
    schema: T,
    endpoint: OddsPapiEndpoint = 'odds',
    priority = 80
  ): Promise<NativeOddsResponse<z.infer<T>>> {
    await this.respectCooldown(endpoint);

    // Quota reservation (idempotent per provider+period)
    const receipt = await reserveQuota('oddspapi', endpoint, priority);
    if (!receipt.ok) {
      log.warn('quota_blocked', { endpoint, reason: receipt.reason });
      throw new OddsPapiError('QUOTA', endpoint, `Quota blocked: ${receipt.reason}`);
    }
    const reservationId = receipt.reservationId;
    if (!reservationId) {
      throw new OddsPapiError('QUOTA', endpoint, 'Quota reservation id missing');
    }

    try {
      // Pass the absolute URL (baseUrl + path) so the /v4 segment is preserved.
      const res = await this.client.get<z.infer<T>>(this.resolveUrl(path), {
        queryParams: params,
        schema,
        cacheTtlMs: ENDPOINT_CACHE_TTL_MS[endpoint] ?? 0,
        maxRetries: 0, // OddsPAPI counts every request; do not auto-retry billable calls
      });

      await confirmQuota(reservationId, receipt.cost);
      return { data: res.data, status: res.status, fromCache: res.fromCache };
    } catch (err: any) {
      const httpStatus: number | undefined = err?.status;
      const code: string | undefined = err?.code;

      // HTTP errors are thrown by HttpClient as { status, code: 'HTTP_<status>', body }
      if (httpStatus === 401 || code === 'HTTP_401') {
        await rollbackQuota(reservationId);
        throw new OddsPapiError('INVALID_KEY', endpoint, 'OddsPAPI rejected the API key (401)', 401, 'INVALID_KEY');
      }
      if (httpStatus === 429 || code === 'HTTP_429') {
        await rollbackQuota(reservationId);
        throw new OddsPapiError('RATE_LIMITED', endpoint, 'OddsPAPI rate limited (429)', 429, 'RATE_LIMITED');
      }
      if (httpStatus !== undefined && httpStatus >= 400 && httpStatus < 500) {
        await rollbackQuota(reservationId);
        throw new OddsPapiError('CONTRACT_ERROR', endpoint, `OddsPAPI HTTP ${httpStatus}: ${err?.message ?? ''}`, httpStatus, code);
      }
      if (code === 'VALIDATION_FAILED') {
        await rollbackQuota(reservationId);
        throw new OddsPapiError('PARSING_ERROR', endpoint, `OddsPAPI response failed schema validation: ${err?.message ?? ''}`, httpStatus, code);
      }

      await rollbackQuota(reservationId);
      throw new OddsPapiError('NETWORK', endpoint, `OddsPAPI request failed: ${err?.message ?? ''}`, httpStatus, code);
    }
  }

  /**
   * GET /v4/account — free endpoint, never blocked. Used for quota checks.
   */
  async getAccountInfo(): Promise<{ requestLimit: number; requestCount: number } | null> {
    try {
      const res = await this.client.get<any>(this.resolveUrl('/account'), { skipCache: true } as any);
      const data = res.data;
      if (!data || typeof data !== 'object') return null;
      return {
        requestLimit: Number(data.request_limit ?? data.requestLimit ?? 0),
        requestCount: Number(data.request_count ?? data.requestCount ?? 0),
      };
    } catch {
      return null;
    }
  }
}

export function createNativeOddsClient(): NativeOddsClient {
  return new NativeOddsClient();
}
