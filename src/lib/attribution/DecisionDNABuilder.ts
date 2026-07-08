import { DecisionDNA, Contribution, InteractionEffect } from './types';
import { DecisionObject } from '../decision/DecisionObject';
import crypto from 'crypto';

export class DecisionDNABuilder {
  /**
   * Generates a structural fingerprint ("Decision DNA") for clustering.
   */
  static build(
    decision: DecisionObject, 
    contributions: Contribution[], 
    interactions: InteractionEffect[]
  ): DecisionDNA {
    const topDrivers: Record<string, number> = {};
    
    // Take top 5 positive drivers
    contributions
      .filter(c => c.direction === 'POSITIVE')
      .sort((a, b) => b.normalizedContribution - a.normalizedContribution)
      .slice(0, 5)
      .forEach(c => topDrivers[c.name] = parseFloat(c.normalizedContribution.toFixed(3)));

    const topRisks = decision.blocking_flags || [];
    const interactionIds = interactions.map(i => i.ruleId).sort();
    
    const confidence = decision.confidence ? parseFloat(decision.confidence.toFixed(3)) : 0;

    // Create a deterministic hash string to serve as the fingerprint
    const rawString = JSON.stringify({
      drivers: Object.keys(topDrivers).sort(),
      risks: topRisks.slice().sort(),
      interactions: interactionIds,
      // Group confidence into buckets so minor variations don't break the cluster
      confidenceBucket: Math.round(confidence * 10) 
    });

    const fingerprint = crypto.createHash('sha256').update(rawString).digest('hex').substring(0, 12);

    return {
      fingerprint,
      topDrivers,
      topRisks,
      interactions: interactionIds,
      confidence
    };
  }
}
