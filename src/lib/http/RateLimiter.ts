// Rate Limiter — Token Bucket per Provider
// Location: src/lib/http/RateLimiter.ts
// Usage: const limiter = new RateLimiter({ maxRequests: 10, windowMs: 60_000, provider: 'api-football' });
//        await limiter.acquire(); // blocks if over limit

import type { RateLimiterConfig } from './types';

interface BucketState {
  tokens: number;
  lastRefill: number;
}

export class RateLimiter {
  private readonly config: Required<RateLimiterConfig>;
  private bucket: BucketState;
  private waiting: Array<{ resolve: () => void; timer: ReturnType<typeof setTimeout> }> = [];
  private refillRate: number;

  constructor(config: RateLimiterConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      provider: config.provider,
    };
    this.bucket = {
      tokens: config.maxRequests,
      lastRefill: Date.now(),
    };
    this.refillRate = config.maxRequests / config.windowMs;
  }

  /**
   * Acquire a token. Resolves immediately if tokens available,
   * otherwise waits until a token is refilled.
   */
  async acquire(timeoutMs: number = 30_000): Promise<boolean> {
    this.refill();

    if (this.bucket.tokens >= 1) {
      this.bucket.tokens -= 1;
      return true;
    }

    // Wait for a token to become available
    return new Promise<boolean>((resolve) => {
      const waitUntil = Date.now() + timeoutMs;
      const check = () => {
        this.refill();
        if (this.bucket.tokens >= 1) {
          this.bucket.tokens -= 1;
          cleanup();
          resolve(true);
          return;
        }
        if (Date.now() >= waitUntil) {
          cleanup();
          resolve(false);
          return;
        }
        // Re-check after refill interval
        const timer = setTimeout(check, Math.min(100, this.config.windowMs / this.config.maxRequests));
        this.waiting.push({ resolve: () => { clearTimeout(timer); resolve(true); }, timer });
      };
      const cleanup = () => {
        this.waiting = this.waiting.filter(w => w.timer !== null);
      };
      check();
    });
  }

  /**
   * Returns tokens remaining without blocking.
   */
  getTokensRemaining(): number {
    this.refill();
    return Math.floor(this.bucket.tokens);
  }

  /**
   * Reset the bucket to full tokens.
   */
  reset(): void {
    this.bucket = {
      tokens: this.config.maxRequests,
      lastRefill: Date.now(),
    };
  }

  private refill(): void {
    const now = Date.now();
    const elapsed = now - this.bucket.lastRefill;
    if (elapsed <= 0) return;

    const newTokens = elapsed * this.refillRate;
    this.bucket.tokens = Math.min(this.config.maxRequests, this.bucket.tokens + newTokens);
    this.bucket.lastRefill = now;
  }
}
