// HandicapLab Live Data Platform - Retry & Circuit Breaker Engine
// Location: src/lib/data-platform/retryEngine.ts

export interface RetryPolicy {
  maxRetries: number;
  initialDelayMs: number;
  factor: number;
}

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export class CircuitBreaker {
  public state: CircuitState = 'CLOSED';
  private failureCount = 0;
  private nextAttemptTimestamp = 0;

  constructor(
    private threshold: number = 3,
    private cooldownMs: number = 5000
  ) {}

  public execute<T>(fn: () => T): T {
    if (this.state === 'OPEN') {
      if (Date.now() > this.nextAttemptTimestamp) {
        this.state = 'HALF_OPEN';
      } else {
        throw new Error('Circuit Breaker is OPEN. Request blocked.');
      }
    }

    try {
      const result = fn();
      // Reset on success
      this.failureCount = 0;
      this.state = 'CLOSED';
      return result;
    } catch (error) {
      this.failureCount++;
      if (this.failureCount >= this.threshold) {
        this.state = 'OPEN';
        this.nextAttemptTimestamp = Date.now() + this.cooldownMs;
      }
      throw error;
    }
  }
}

export class RetryEngine {
  private static deadLetterQueue: any[] = [];

  /**
   * Executes a task with exponential backoff.
   */
  public static async executeWithRetry<T>(
    fn: () => Promise<T>,
    policy: RetryPolicy = { maxRetries: 3, initialDelayMs: 50, factor: 2 }
  ): Promise<T> {
    let lastError: any;
    let delay = policy.initialDelayMs;

    for (let attempt = 0; attempt <= policy.maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        if (attempt === policy.maxRetries) {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= policy.factor;
      }
    }

    // Append to Dead Letter Queue (DLQ) if exhausted
    this.deadLetterQueue.push({
      timestamp: new Date().toISOString(),
      payload: String(lastError),
      error: lastError?.message || 'Exhausted retries'
    });

    throw lastError;
  }

  public static getDLQ(): any[] {
    return this.deadLetterQueue;
  }

  public static clearDLQ(): void {
    this.deadLetterQueue = [];
  }
}
