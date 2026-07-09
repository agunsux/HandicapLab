// HTTP Client — Centralized Abstraction for External API Calls
// Location: src/lib/http/HttpClient.ts
// All external HTTP requests MUST go through this client.
// Reuses: retry.ts (exponential backoff), logger.ts (structured logging)

import { retry } from '@/lib/retry';
import { logger, IChildLogger } from '@/lib/logger';

import { RateLimiter } from './RateLimiter';
import { CircuitBreaker } from './CircuitBreaker';
import { Cache } from './Cache';
import type { HttpRequestOptions, HttpResponse, HttpMethod } from './types';

export interface HttpClientConfig {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  provider: string;
}

export class HttpClient {
  private readonly config: Required<HttpClientConfig>;
  private rateLimiter?: RateLimiter;
  private circuitBreaker?: CircuitBreaker;
  private cache?: Cache;
  private log!: IChildLogger;



  constructor(
    config: HttpClientConfig,
    rateLimiter?: RateLimiter,
    circuitBreaker?: CircuitBreaker,
    cache?: Cache
  ) {
    this.config = {
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
      defaultHeaders: config.defaultHeaders ?? {},
      defaultTimeoutMs: config.defaultTimeoutMs ?? 30_000,
      defaultRetries: config.defaultRetries ?? 2,
      provider: config.provider,
    };
    this.rateLimiter = rateLimiter;
    this.circuitBreaker = circuitBreaker;
    this.cache = cache;
    this.log = logger.child(`http:${this.config.provider}`);
  }

  async get<T>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('GET', path, undefined, options);
  }

  async post<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('POST', path, body, options);
  }

  async put<T>(path: string, body?: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('PUT', path, body, options);
  }

  async delete<T>(path: string, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    return this.request<T>('DELETE', path, undefined, options);
  }

  getComponents() {
    return { rateLimiter: this.rateLimiter, circuitBreaker: this.circuitBreaker, cache: this.cache };
  }

  async ping(path: string = '/'): Promise<boolean> {
    try {
      const res = await fetch(new URL(path, this.config.baseUrl).toString(), {
        method: 'HEAD', signal: AbortSignal.timeout(5_000),
      });
      return res.ok;
    } catch { return false; }
  }

  private async request<T>(method: HttpMethod, path: string, body: unknown, options?: HttpRequestOptions): Promise<HttpResponse<T>> {
    const startTime = performance.now();
    const cacheKey = Cache.buildKey(this.config.baseUrl, path, options?.queryParams);

    if (method === 'GET' && !options?.skipCache && this.cache) {
      const cached = this.cache.get<T>(cacheKey);
      if (cached !== null) {
        this.log.debug('cache_hit', { path, cacheKey });
        return { data: cached, status: 200, headers: new Headers(), durationMs: 0, fromCache: true };
      }
    }

    if (this.circuitBreaker) {
      const allowed = await this.circuitBreaker.allowRequest();
      if (!allowed) {
        const s = this.circuitBreaker.getStatus();
        this.log.warn('circuit_open', { path, state: s.state });
        throw Object.assign(new Error(`Circuit OPEN for ${this.config.provider}`), { code: 'CIRCUIT_OPEN', status: s });
      }
    }

    if (this.rateLimiter) {
      const acquired = await this.rateLimiter.acquire();
      if (!acquired) {
        this.log.warn('rate_limited', { path });
        throw Object.assign(new Error(`Rate limit exceeded for ${this.config.provider}`), { code: 'RATE_LIMITED', status: 429 });
      }
    }

    return this.executeRequest<T>(method, path, body, options, cacheKey, startTime);
  }

  private async executeRequest<T>(
    method: HttpMethod, path: string, body: unknown,
    options: HttpRequestOptions | undefined, cacheKey: string, startTime: number
  ): Promise<HttpResponse<T>> {
    const url = new URL(path, this.config.baseUrl);
    if (options?.queryParams) {
      for (const [k, v] of Object.entries(options.queryParams)) {
        if (v !== undefined) url.searchParams.set(k, String(v));
      }
    }

    const headers = new Headers(this.config.defaultHeaders);
    if (options?.headers) {
      for (const [k, v] of Object.entries(options.headers)) headers.set(k, v);
    }

    const fetchOptions: RequestInit = {
      method, headers,
      signal: AbortSignal.timeout(options?.timeoutMs ?? this.config.defaultTimeoutMs),
    };
    if (body !== undefined && method !== 'GET') {
      fetchOptions.body = JSON.stringify(body);
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json');
    }

    try {
      const response = await retry(async () => {
        const res = await fetch(url.toString(), fetchOptions);
         if (!res.ok) {
          const errorBody = typeof res.text === 'function' ? await res.text().catch(() => '') : '';
          throw Object.assign(new Error(`HTTP ${res.status}: ${errorBody || res.statusText || 'Response error'}`), {
            status: res.status, body: errorBody, code: `HTTP_${res.status}`,
          });
        }
        return res;
      }, {
        maxRetries: options?.maxRetries ?? this.config.defaultRetries,
        retryable: (err: any) => {
          if (err?.code === 'CIRCUIT_OPEN' || err?.code === 'RATE_LIMITED') return false;
          if (err?.status === 429 || err?.status === 503 || err?.status === 504) return true;
          if (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT' || err?.code === 'TIMEOUT') return true;
          if (err?.name === 'AbortError') return true;
          return false;
        },
        onRetry: (attempt, error, delay) => {
          this.log.warn('retry', { path, attempt, error: error?.message, delayMs: Math.round(delay) });
        },
      });

      const responseData: unknown = await response.json();
      let data: T;

      if (options?.schema) {
        const validationResult = options.schema.safeParse(responseData);
        if (!validationResult.success) {
          this.log.error('schema_validation_failed', {
            path,
            errors: validationResult.error.format(),
          });
          throw Object.assign(
            new Error(`Response validation failed for provider ${this.config.provider} on path ${path}: ${validationResult.error.message}`),
            { code: 'VALIDATION_FAILED', status: response.status, details: validationResult.error.format() }
          );
        }
        data = validationResult.data as T;
      } else {
        data = responseData as T;
      }

      const durationMs = Math.round(performance.now() - startTime);

      if (method === 'GET' && this.cache) {
        this.cache.set(cacheKey, data, options?.cacheTtlMs);
      }
      this.circuitBreaker?.onSuccess();
      this.log.debug('request_ok', { path, status: response.status, durationMs });

      return { data, status: response.status, headers: response.headers, durationMs, fromCache: false };
    } catch (error: any) {
      const durationMs = Math.round(performance.now() - startTime);
      this.circuitBreaker?.onFailure();
      this.log.error('request_failed', { path, error: error?.message, code: error?.code, status: error?.status, durationMs });
      throw error;
    }
  }
}

