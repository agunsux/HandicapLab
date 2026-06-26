export type SubscriptionTier = 'free' | 'starter' | 'pro' | 'quant' | 'founder';

export interface PlanDetails {
  tier: SubscriptionTier;
  name: string;
  priceUSD: number;
  features: string[];
  maxSignalsPerDay: number;
  hasScanner: boolean;
  hasFullEdgeData: boolean;
  hasApiAccess: boolean;
}

export const PLANS: Record<SubscriptionTier, PlanDetails> = {
  free: {
    tier: 'free',
    name: 'Free',
    priceUSD: 0,
    features: ['3 signals/day', 'Limited scanner', 'Basic statistics'],
    maxSignalsPerDay: 3,
    hasScanner: true,
    hasFullEdgeData: false,
    hasApiAccess: false
  },
  starter: {
    // Included to support existing starter tiers in schema check constraints
    tier: 'starter',
    name: 'Starter',
    priceUSD: 9,
    features: ['10 signals/day', 'Limited scanner', 'Basic statistics'],
    maxSignalsPerDay: 10,
    hasScanner: true,
    hasFullEdgeData: false,
    hasApiAccess: false
  },
  pro: {
    tier: 'pro',
    name: 'Pro',
    priceUSD: 29,
    features: ['Unlimited signals', 'Full edge data', 'Unlimited scanner', 'CLV tracking'],
    maxSignalsPerDay: Infinity,
    hasScanner: true,
    hasFullEdgeData: true,
    hasApiAccess: false
  },
  quant: {
    tier: 'quant',
    name: 'Quant',
    priceUSD: 99,
    features: ['Unlimited signals', 'Full edge data', 'Unlimited scanner', 'API access', 'Raw odds exports'],
    maxSignalsPerDay: Infinity,
    hasScanner: true,
    hasFullEdgeData: true,
    hasApiAccess: true
  },
  founder: {
    tier: 'founder',
    name: 'Founder',
    priceUSD: 199,
    features: ['Lifetime access', 'Unlimited signals', 'Full edge data', 'Unlimited scanner', 'API access'],
    maxSignalsPerDay: Infinity,
    hasScanner: true,
    hasFullEdgeData: true,
    hasApiAccess: true
  }
};

