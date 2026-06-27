import { supabase } from '../supabase.server';

export interface PPPTierConfig {
  tierName: string;
  lifetimePrice: string;
  founderPrice: string;
  creditsPrice: string;
}

export const PPP_TIERS: Record<string, PPPTierConfig> = {
  TIER_1: { tierName: 'Standard Tier (US/EU)', lifetimePrice: '$99', founderPrice: '$79', creditsPrice: '$3.00' },
  TIER_2: { tierName: 'Tier 2 (ES/PL)', lifetimePrice: '$59', founderPrice: '$49', creditsPrice: '$2.00' },
  TIER_3: { tierName: 'Tier 3 (BR/MX)', lifetimePrice: '$29', founderPrice: '$19', creditsPrice: '$1.00' },
  TIER_4: { tierName: 'Tier 4 (ID/IN)', lifetimePrice: '$19', founderPrice: '$9', creditsPrice: '$0.50' }
};

export async function getFounderSlotsInfo(): Promise<{ count: number; slotsAvailable: boolean }> {
  try {
    const { count, error } = await supabase
      .from('founders')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('[Monetization] Failed to get founder count:', error);
      return { count: 0, slotsAvailable: true };
    }

    const currentCount = count || 0;
    return {
      count: currentCount,
      slotsAvailable: currentCount < 500
    };
  } catch (err) {
    console.error('[Monetization] Error checking founder slots:', err);
    return { count: 0, slotsAvailable: true };
  }
}

export async function getUserProfileAndPPPTier(userId: string | null): Promise<{ pppTier: string; geoCountry: string }> {
  if (!userId) {
    return { pppTier: 'TIER_1', geoCountry: 'US' };
  }

  try {
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) {
      // Fallback or auto-create profile
      return { pppTier: 'TIER_1', geoCountry: 'US' };
    }

    return {
      pppTier: profile.ppp_tier || 'TIER_1',
      geoCountry: profile.geo_country || 'US'
    };
  } catch (err) {
    return { pppTier: 'TIER_1', geoCountry: 'US' };
  }
}

export async function checkEntitlement(
  userId: string | null,
  feature: 'FORENSIC_POPOVER' | 'FULL_LEDGER' | 'CSV_EXPORT'
): Promise<boolean> {
  if (!userId) return false;

  try {
    // 1. Fetch user entitlements
    const { data: entitlements, error } = await supabase
      .from('user_entitlements')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'ACTIVE');

    if (error || !entitlements) {
      console.error('[Gating Engine] Failed to fetch entitlements:', error);
      return false;
    }

    // Filter by active calculation: status = ACTIVE and (expires_at is null or expires_at > now())
    const now = new Date();
    const activeEntitlements = entitlements.filter(e => {
      return !e.expires_at || new Date(e.expires_at) > now;
    });

    // 2. Lifetime Pro access bypasses all gating
    const hasLifetime = activeEntitlements.some(e => e.access_type === 'LIFETIME_PRO');
    if (hasLifetime) {
      return true;
    }

    // 3. Deduct credit if feature is FORENSIC_POPOVER and credits exist
    if (feature === 'FORENSIC_POPOVER') {
      const creditsEnt = activeEntitlements.find(e => e.access_type === 'CREDITS' && (e.credits_balance || 0) > 0);
      if (creditsEnt) {
        const newBalance = (creditsEnt.credits_balance || 0) - 1;

        const { error: deductErr } = await supabase
          .from('user_entitlements')
          .update({ credits_balance: newBalance })
          .eq('id', creditsEnt.id);

        if (deductErr) {
          console.error('[Gating Engine] Failed to deduct credit:', deductErr);
          return false;
        }

        // Log credit audit trail
        await supabase.from('credit_deductions').insert({
          user_id: userId,
          credits_used: 1,
          action_type: 'UNLOCK_FORENSIC_MODAL',
          reference_id: creditsEnt.id
        });

        return true;
      }
    }
  } catch (err) {
    console.error('[Gating Engine] Error in checkEntitlement:', err);
  }

  return false;
}

