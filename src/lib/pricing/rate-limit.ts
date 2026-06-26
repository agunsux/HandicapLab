import { supabase } from '../supabase.server';

/**
 * Checks if a request identifier exceeds the rate limit.
 * Enforces:
 * - limit: max number of requests allowed in window
 * - windowSeconds: time window in seconds
 */
export async function isRateLimited(
  identifier: string,
  limit: number,
  windowSeconds: number = 60
): Promise<boolean> {
  const cutoff = new Date(Date.now() - windowSeconds * 1000).toISOString();

  try {
    // 1. Delete events older than 1 day to keep table size clean (distributed-safe cleanup)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    supabase
      .from('rate_limit_events')
      .delete()
      .lt('created_at', oneDayAgo)
      .then(({ error }) => {
        if (error) console.error('[RateLimit] Cleanup failed:', error);
      });

    // 2. Count requests in the current window
    const { count, error } = await supabase
      .from('rate_limit_events')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .gte('created_at', cutoff);

    if (error) {
      console.error('[RateLimit] Database check failed:', error);
      // Fallback: allow request in case database is down to prevent blocking legit traffic
      return false;
    }

    if (count !== null && count >= limit) {
      return true;
    }

    // 3. Record this request event
    const { error: insertError } = await supabase
      .from('rate_limit_events')
      .insert({ identifier });

    if (insertError) {
      console.error('[RateLimit] Failed to record request event:', insertError);
    }
  } catch (err) {
    console.error('[RateLimit] Exception in rate limiter:', err);
  }

  return false;
}
