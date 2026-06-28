import { checkActiveEntitlement } from '../payments/entitlement/check';

export interface UserAccessPolicy {
  isPremium: boolean;
  dailyLimit: number;
}

/**
 * Evaluates the user's access entitlement policy.
 */
export async function determineUserAccess(userId?: string): Promise<UserAccessPolicy> {
  if (!userId) {
    return { isPremium: false, dailyLimit: 3 };
  }

  const isPremium = await checkActiveEntitlement(userId, 'LIFETIME_PRO');
  return {
    isPremium,
    dailyLimit: isPremium ? Infinity : 3
  };
}

export function maskSignalData(signal: any, isPremium: boolean): any {
  // Deep copy/clone signal object
  const masked = JSON.parse(JSON.stringify(signal));

  if (isPremium) {
    // Premium shows all detailed data including probability and recommended stake
    return masked;
  }

  // Mask root level fields (for feed API)
  if (masked.current_odds !== undefined) masked.current_odds = null;
  if (masked.closing_odds !== undefined) masked.closing_odds = null;
  if (masked.edge_percentage !== undefined) masked.edge_percentage = null;
  if (masked.edge_pct !== undefined) masked.edge_pct = null;
  if (masked.clv !== undefined) masked.clv = null;
  if (masked.clv_percentage !== undefined) masked.clv_percentage = null;

  // Mask nested fields (for detail API)
  if (masked.prediction) {
    masked.prediction.selection = null;
    masked.prediction.odds = null;
    masked.prediction.probability = null;
    masked.prediction.recommended_stake = null;
    masked.prediction.explanation = null;
    
    // Maintain backward compatibility for existing tests
    masked.prediction.edge = null;
    masked.prediction.edge_pct = null;
  }
  if (masked.market_movement) {
    masked.market_movement.opening_odds = null;
    masked.market_movement.current_odds = null;
    masked.market_movement.clv = null;
  }

  // Hide internal calculation properties for free users
  delete masked.fair_odds;
  delete masked.probability;
  if (masked.prediction) {
    delete masked.prediction.fair_odds;
  }

  return masked;
}

/**
 * Enforces pagination limits and applies quality visibility rules on signals feed.
 */
export function enforceFeedPolicy(signals: any[], isPremium: boolean, limitVal: number): any[] {
  // Apply free user count limit
  const activeLimit = isPremium ? limitVal : Math.min(3, limitVal);
  const sliced = signals.slice(0, activeLimit);

  // Apply masking to each record
  return sliced.map(sig => maskSignalData(sig, isPremium));
}
