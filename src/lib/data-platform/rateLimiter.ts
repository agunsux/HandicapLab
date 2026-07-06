// HandicapLab Live Data Platform - Rate Limiter
// Location: src/lib/data-platform/rateLimiter.ts

export interface RateLimitConfig {
  requestsPerSec: number;
  requestsPerMin: number;
}

export class RateLimiter {
  private static timestamps: number[] = [];

  /**
   * Evaluates if rate limit permits another call.
   */
  public static isAllowed(
    config: RateLimitConfig = { requestsPerSec: 10, requestsPerMin: 100 }
  ): boolean {
    const now = Date.now();
    
    // Clear elements older than 1 minute
    this.timestamps = this.timestamps.filter((t) => now - t < 60 * 1000);

    const oneSecCount = this.timestamps.filter((t) => now - t < 1000).length;
    const oneMinCount = this.timestamps.length;

    if (oneSecCount >= config.requestsPerSec || oneMinCount >= config.requestsPerMin) {
      return false;
    }

    this.timestamps.push(now);
    return true;
  }

  /**
   * Reset rate limiter (primarily for testing purposes).
   */
  public static reset(): void {
    this.timestamps = [];
  }
}
