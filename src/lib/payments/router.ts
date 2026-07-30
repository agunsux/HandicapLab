// Payment Router implementation
import { headers } from 'next/headers';

type Gateway = 'stripe' | 'midtrans' | 'gcash' | 'razorpay';
type Tier = 'Tier 1' | 'Tier 2' | 'Tier 3' | 'Tier 4';

interface RoutingResult {
  gateway: Gateway;
  tier: Tier;
  countryCode: string;
}

export async function routePaymentGateway(reqCountryCode?: string): Promise<RoutingResult> {
  // If not provided, try to extract from Next.js headers (Vercel provides x-vercel-ip-country)
  const headerList = await headers();
  const countryCode = reqCountryCode || headerList.get('x-vercel-ip-country') || 'US';

  let tier: Tier = 'Tier 1';
  let gateway: Gateway = 'stripe';

  const tier1 = ['US', 'CA', 'GB', 'AU', 'SE', 'NO', 'DK', 'FI'];
  const tier2 = ['PL', 'CZ', 'HU', 'MX', 'AE'];
  const tier3 = ['BR', 'MY', 'TH', 'PE'];
  const tier4 = ['ID', 'IN', 'PK', 'VN', 'PH', 'NG', 'ZA'];

  if (tier1.includes(countryCode)) {
    tier = 'Tier 1';
    gateway = 'stripe';
  } else if (tier2.includes(countryCode)) {
    tier = 'Tier 2';
    gateway = 'stripe';
  } else if (tier3.includes(countryCode)) {
    tier = 'Tier 3';
    gateway = 'stripe';
  } else if (tier4.includes(countryCode)) {
    tier = 'Tier 4';
    
    // Gateway selection based on specific Tier 4 countries
    if (countryCode === 'ID') {
      gateway = 'midtrans';
    } else if (countryCode === 'PH') {
      gateway = 'gcash';
    } else if (countryCode === 'IN') {
      gateway = 'razorpay';
    } else {
      gateway = 'stripe'; // Fallback
    }
  }

  return { gateway, tier, countryCode };
}
