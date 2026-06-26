import { supabase } from '../supabase.server';
import { PLANS, SubscriptionTier, PlanDetails } from './plans';

// Ensure this module is only imported/run on the server side
if (typeof window !== 'undefined') {
  throw new Error('Entitlements module can only be used on the server side.');
}

export interface UserEntitlements {
  tier: SubscriptionTier;
  maxSignalsPerDay: number;
  hasScanner: boolean;
  hasFullEdgeData: boolean;
  hasApiAccess: boolean;
}

/**
 * Retrieves feature entitlements and subscription details for a user.
 * Queries the active subscriptions table, falling back to the FREE tier.
 */
export async function getUserEntitlements(userId?: string): Promise<UserEntitlements> {
  if (!userId) {
    return getTierEntitlements('free');
  }

  try {
    // Fetch user's subscription record
    const { data: sub, error } = await supabase
      .from('subscriptions')
      .select('tier, status')
      .eq('user_id', userId)
      .maybeSingle();

    if (!error && sub) {
      // If active or trialing, grant features matching their tier
      if (sub.status === 'active' || sub.status === 'trialing') {
        const tierKey = (sub.tier || 'free').toLowerCase() as SubscriptionTier;
        return getTierEntitlements(tierKey);
      }
    }
  } catch (err) {
    console.error('[Entitlements] Error resolving user subscription entitlements:', err);
  }

  return getTierEntitlements('free');
}

/**
 * Helper to fetch static entitlements for a tier
 */
export function getTierEntitlements(tier: SubscriptionTier): UserEntitlements {
  const plan: PlanDetails = PLANS[tier] || PLANS.free;
  return {
    tier: plan.tier,
    maxSignalsPerDay: plan.maxSignalsPerDay,
    hasScanner: plan.hasScanner,
    hasFullEdgeData: plan.hasFullEdgeData,
    hasApiAccess: plan.hasApiAccess,
  };
}
