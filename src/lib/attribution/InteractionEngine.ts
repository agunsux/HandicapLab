import { Contribution, InteractionEffect, InteractionRule, CounteractingFactorGroup } from './types';

export class InteractionEngine {
  // Phase 1 Deterministic Rules
  private static RULES: InteractionRule[] = [
    {
      id: 'rule_momentum_fatigue_synergy',
      name: 'Momentum + Travel Fatigue Synergy',
      participatingFactors: ['home_attacking_pressure', 'travel_fatigue'],
      interactionType: 'POSITIVE',
      multiplier: 1.2
    },
    {
      id: 'rule_market_uncertainty_dampener',
      name: 'Market Overreaction + High Uncertainty',
      participatingFactors: ['market_underreaction', 'epistemic_uncertainty'],
      interactionType: 'NEGATIVE',
      multiplier: 0.8 // Dampens confidence
    }
  ];

  /**
   * Detects interaction effects based on the presence of specific drivers in the decision.
   */
  static detectInteractions(contributions: Contribution[]): InteractionEffect[] {
    const effects: InteractionEffect[] = [];
    const driverNames = new Set(contributions.map(c => c.name));

    for (const rule of this.RULES) {
      const allPresent = rule.participatingFactors.every(f => driverNames.has(f));
      if (allPresent) {
        effects.push({
          ruleId: rule.id,
          effectName: rule.name,
          participatingFactors: rule.participatingFactors,
          multiplier: rule.multiplier,
          impactDirection: rule.interactionType
        });
      }
    }

    return effects;
  }

  /**
   * Detects counteracting factors (e.g. strong POSITIVE driver fighting a strong NEGATIVE driver).
   */
  static detectCounteracting(contributions: Contribution[]): CounteractingFactorGroup[] {
    const groups: CounteractingFactorGroup[] = [];
    
    // Simplistic heuristic for Phase 1: Group top positive and top negative if both are strong
    const pos = contributions.filter(c => c.direction === 'POSITIVE' && c.normalizedContribution >= 0.3);
    const neg = contributions.filter(c => c.direction === 'NEGATIVE' && c.normalizedContribution >= 0.3);

    if (pos.length > 0 && neg.length > 0) {
      const pDrivers = pos.map(c => c.name);
      const nDrivers = neg.map(c => c.name);
      const pSum = pos.reduce((s, c) => s + c.normalizedContribution, 0);
      const nSum = neg.reduce((s, c) => s + c.normalizedContribution, 0);
      
      const net = pSum - nSum;
      const netDirection = net > 0.1 ? 'POSITIVE' : net < -0.1 ? 'NEGATIVE' : 'NEUTRAL';
      
      groups.push({
        groupName: 'Primary Drivers vs Suppressors',
        positiveDrivers: pDrivers,
        negativeDrivers: nDrivers,
        netImpact: Math.abs(net),
        netDirection
      });
    }

    return groups;
  }
}
