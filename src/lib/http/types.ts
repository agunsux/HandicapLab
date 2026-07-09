// HTTP Abstraction Types — Centralized HTTP Configuration & Response Types
// Location: src/lib/http/types.ts

import { z } from 'zod';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface HttpRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  queryParams?: Record<string, string | number | undefined>;
  body?: unknown;
  /** Override default timeout in ms */
  timeoutMs?: number;
  /** Skip cache for this request */
  skipCache?: boolean;
  /** Cache TTL in ms (overrides default) */
  cacheTtlMs?: number;
  /** Retry configuration override */
  maxRetries?: number;
  /** Optional Zod schema for response validation */
  schema?: z.ZodSchema<any>;
}

export interface HttpResponse<T = unknown> {
  data: T;
  status: number;
  headers: Headers;
  durationMs: number;
  fromCache: boolean;
}

export interface HttpError {
  message: string;
  status?: number;
  code?: string;
  body?: unknown;
}

export interface HealthStatus {
  healthy: boolean;
  provider: string;
  latencyMs?: number;
  error?: string;
  lastChecked: Date;
}

export interface RateLimiterConfig {
  /** Max requests per window */
  maxRequests: number;
  /** Window duration in ms */
  windowMs: number;
  /** Provider identifier for logging */
  provider: string;
}

export interface CircuitBreakerConfig {
  /** Failure threshold before opening */
  failureThreshold: number;
  /** Cooldown period in ms before half-open */
  cooldownMs: number;
  /** Success threshold in half-open to close */
  halfOpenSuccessThreshold: number;
  /** Provider identifier */
  provider: string;
}

export interface CacheConfig {
  /** Default TTL in ms */
  defaultTtlMs: number;
  /** Max entries in cache */
  maxEntries: number;
  /** Provider identifier */
  provider: string;
}
