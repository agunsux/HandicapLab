import { supabase } from '../supabase.server';
import { SubscriptionTier, hasTierAccess } from './tiers';

// Self-contained memory cache mimicking Redis TTL operations
class InMemoryRedis {
  private store = new Map<string, { value: string; expiresAt: number }>();

  public async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  public async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    this.store.set(key, {
      value,
      expiresAt: Date.now() + ttlSeconds * 1000
    });
  }

  public async del(key: string): Promise<void> {
    this.store.delete(key);
  }

  public async clear(): Promise<void> {
    this.store.clear();
  }
}

export const redisMock = new InMemoryRedis();

/**
 * Checks if a user has entitlement for a specific pick's required subscription tier.
 * Caches results in a Redis-like memory cache with a 5-minute TTL.
 * 
 * @param userId Unique identifier of the authenticated user
 * @param requiredPickTier Access level required to view this prediction
 */
export async function checkEntitlement(
  userId: string,
  requiredPickTier: 'FREE' | 'PRO' | 'ELITE'
): Promise<boolean> {
  if (requiredPickTier === 'FREE') return true; // FREE picks are public

  const cacheKey = `user:${userId}:tier`;
  const cached = await redisMock.get(cacheKey);
  
  let userTier: SubscriptionTier = 'FREE';

  if (cached) {
    userTier = cached as SubscriptionTier;
  } else {
    try {
      // Lookup in Supabase database
      const { data, error } = await supabase
        .from('user_subscriptions')
        .select('tier, status, expires_at')
        .eq('user_id', userId)
        .maybeSingle();

      if (!error && data) {
        const isNotExpired = !data.expires_at || new Date(data.expires_at).getTime() > Date.now();
        const isActive = data.status === 'active' && isNotExpired;

        if (isActive) {
          userTier = data.tier as SubscriptionTier;
        }
      }
    } catch (e) {
      console.warn(`[Monetization] Database check failed for user ${userId}, falling back to FREE.`, e);
    }

    // Cache the resolved tier for 5 minutes (300 seconds)
    await redisMock.set(cacheKey, userTier, 300);
  }

  return hasTierAccess(userTier, requiredPickTier);
}

/**
 * Utility to override subscription cache for testing or active session adjustments.
 */
export async function setCachedUserTier(
  userId: string,
  tier: SubscriptionTier,
  ttlSeconds: number = 300
): Promise<void> {
  const cacheKey = `user:${userId}:tier`;
  await redisMock.set(cacheKey, tier, ttlSeconds);
}
