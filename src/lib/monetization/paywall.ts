import { EdgePick } from '../engines/edge-scanner/types';

export interface PaywalledEdgePick {
  matchId: string;
  marketType: 'ML' | 'AH' | 'OU';
  line: string;
  outcome: string;
  modelProbability: number | null;
  marketOdds: number;
  expectedValue: number | null;
  kellyStake: number | null;
  clv: number | null;
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  tier: 'FREE' | 'PRO' | 'ELITE';
  isLocked: boolean;
}

export class Paywall {
  /**
   * Obfuscates sensitive analytics stats if the user does not have active entitlement.
   * 
   * @param pick The raw EdgePick produced by the EdgeScanner
   * @param hasEntitlement Boolean indicating if user tier grants permission
   */
  public static gateEdgePick(pick: EdgePick, hasEntitlement: boolean): PaywalledEdgePick {
    if (hasEntitlement) {
      return {
        ...pick,
        isLocked: false
      };
    }

    // Obfuscate / blur details for paywalled picks
    return {
      matchId: pick.matchId,
      marketType: pick.marketType,
      line: 'Locked',
      outcome: 'locked',
      modelProbability: null,
      marketOdds: pick.marketOdds, // Odds are public
      expectedValue: null,
      kellyStake: null,
      clv: null,
      confidence: pick.confidence, // Public metadata
      tier: pick.tier,
      isLocked: true
    };
  }

  /**
   * Filters and gates a list of edge picks using a callback evaluator.
   * 
   * @param picks List of raw edge picks
   * @param evaluator Callback function to evaluate entitlement for a pick tier
   */
  public static gateEdgePicks(
    picks: EdgePick[],
    evaluator: (tier: 'FREE' | 'PRO' | 'ELITE') => boolean
  ): PaywalledEdgePick[] {
    return picks.map(pick => {
      const hasAccess = evaluator(pick.tier);
      return this.gateEdgePick(pick, hasAccess);
    });
  }
}
