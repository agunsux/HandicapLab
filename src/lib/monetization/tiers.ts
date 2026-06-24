export type SubscriptionTier = 'FREE' | 'STARTER' | 'PRO' | 'QUANT' | 'ELITE' | 'LIFETIME';

export interface TierDetails {
  name: SubscriptionTier;
  displayName: string;
  allowedPicks: ('FREE' | 'PRO' | 'ELITE')[];
  priceMonthly?: number;
  description: string;
}

export const TIER_DEFINITIONS: Record<SubscriptionTier, TierDetails> = {
  FREE: {
    name: 'FREE',
    displayName: 'Free Tier',
    allowedPicks: ['FREE'],
    priceMonthly: 0,
    description: 'Access basic predictions and free-tier edge picks.'
  },
  STARTER: {
    name: 'STARTER',
    displayName: 'Starter Membership',
    allowedPicks: ['FREE'],
    priceMonthly: 9,
    description: 'Unlimited predictions, delayed data, basic filters, watchlist.'
  },
  PRO: {
    name: 'PRO',
    displayName: 'Pro Membership',
    allowedPicks: ['FREE', 'PRO'],
    priceMonthly: 29,
    description: 'Unlock professional predictions, value bets, and mid-tier EV edge picks.'
  },
  QUANT: {
    name: 'QUANT',
    displayName: 'Quant Membership',
    allowedPicks: ['FREE', 'PRO', 'ELITE'],
    priceMonthly: 99,
    description: 'Full Edge Scanner, CLV expectation, ledger, custom filters, advanced analytics, REST API keys.'
  },
  ELITE: {
    name: 'ELITE',
    displayName: 'Elite Syndicate',
    allowedPicks: ['FREE', 'PRO', 'ELITE'],
    priceMonthly: 79.99,
    description: 'Full syndicate access including high-EV picks, late market moves, and elite metrics.'
  },
  LIFETIME: {
    name: 'LIFETIME',
    displayName: 'Founder Lifetime',
    allowedPicks: ['FREE', 'PRO', 'ELITE'],
    priceMonthly: 199,
    description: 'Lifetime access to all current and future predictions with no recurring subscription fees.'
  }
};

/**
 * Checks whether a user's subscription tier is allowed to access a given pick's tier.
 */
export function hasTierAccess(
  userTier: SubscriptionTier,
  requiredPickTier: 'FREE' | 'PRO' | 'ELITE'
): boolean {
  const details = TIER_DEFINITIONS[userTier];
  if (!details) return false;
  return details.allowedPicks.includes(requiredPickTier);
}
