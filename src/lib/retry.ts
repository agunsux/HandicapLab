// Retry Utility — Exponential Backoff for External Services
// Location: src/lib/retry.ts
// Usage: const result = await retry(() => supabase.from('matches').select('*'), { maxRetries: 3 });

export interface RetryOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  retryable?: (error: any) => boolean;
  onRetry?: (attempt: number, error: any, delayMs: number) => void;
}

const defaultOptions: Required<RetryOptions> = {
  maxRetries: 3,
  baseDelayMs: 200,
  maxDelayMs: 10000,
  timeoutMs: 30000,
  retryable: (err: any) => {
    if (err?.code === 'ECONNRESET' || err?.code === 'ETIMEDOUT') return true;
    if (err?.status === 429 || err?.status === 503 || err?.status === 504) return true;
    if (err?.message?.includes('timeout') || err?.message?.includes('rate limit')) return true;
    return false;
  },
  onRetry: (_attempt: number, _error: any, _delayMs: number) => {},
};

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry an async operation with exponential backoff.
 * Only use for Supabase, network fetch, and external API calls.
 * Do NOT use for validation, benchmark, or statistical calculations.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...defaultOptions, ...options };
  let lastError: any;

  for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
    try {
      const result = await Promise.race([
        fn(),
        opts.timeoutMs > 0
          ? new Promise<never>((_, reject) =>
              setTimeout(() => reject(Object.assign(new Error('OPERATION_TIMEOUT'), { code: 'TIMEOUT' })), opts.timeoutMs)
            )
          : new Promise<never>(() => {}),
      ]);
      return result;
    } catch (error: any) {
      lastError = error;
      if (attempt < opts.maxRetries && opts.retryable(error)) {
        const delay = Math.min(opts.baseDelayMs * Math.pow(2, attempt), opts.maxDelayMs);
        const jitter = delay * (0.5 + Math.random() * 0.5);
        opts.onRetry(attempt + 1, error, jitter);
        await sleep(jitter);
      } else {
        throw error;
      }
    }
  }

  throw lastError;
}
