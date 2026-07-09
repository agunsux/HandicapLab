// HTTP Layer — Centralized External API Infrastructure
// Location: src/lib/http/index.ts

export { HttpClient } from './HttpClient';
export type { HttpClientConfig } from './HttpClient';

export { RateLimiter } from './RateLimiter';
export { CircuitBreaker } from './CircuitBreaker';
export { Cache } from './Cache';

export type {
  HttpRequestOptions,
  HttpResponse,
  HttpError,
  HttpMethod,
  HealthStatus,
  RateLimiterConfig,
  CircuitBreakerConfig,
  CacheConfig,
} from './types';

export type { CircuitState, CircuitStatus } from './CircuitBreaker';

