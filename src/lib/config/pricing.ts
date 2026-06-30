export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  billing_cycle: 'monthly' | 'one-time';
  features: string[];
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'free',
    name: 'Free Pass',
    price: 0,
    billing_cycle: 'monthly',
    features: [
      '3 Daily limited signals',
      '30-minute delayed alerts',
      'Basic matches feed'
    ]
  },
  {
    id: 'starter',
    name: 'Starter',
    price: 9,
    billing_cycle: 'monthly',
    features: [
      'Unlimited standard signals',
      'Standard leagues coverage',
      'Basic settlement history'
    ]
  },
  {
    id: 'pro',
    name: 'Pro Member',
    price: 29,
    billing_cycle: 'monthly',
    features: [
      'Real-time premium signal feed',
      'Detailed CLV price analytics',
      'Interactive backtest dashboard tabs',
      'All major and qualification leagues'
    ]
  },
  {
    id: 'quant',
    name: 'Quant Operator',
    price: 99,
    billing_cycle: 'monthly',
    features: [
      'API access to signal feed',
      'Confidence calibration curve datasets',
      'Timing edge decay raw reports',
      'Priority support and custom bookmakers'
    ]
  },
  {
    id: 'beta_one_time',
    name: 'Beta Lifetime Pass',
    price: 149,
    billing_cycle: 'one-time',
    features: [
      'Lifetime access to Pro features',
      'Historical performance analytics export',
      'Direct user feedback channel access'
    ]
  }
];

export function getPlan(planId: string): SubscriptionPlan | null {
  return SUBSCRIPTION_PLANS.find(p => p.id.toLowerCase() === planId.toLowerCase()) ?? null;
}
