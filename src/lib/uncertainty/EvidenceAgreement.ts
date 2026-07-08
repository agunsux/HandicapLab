export interface EvidenceSource {
  name: string;
  signal: 'HIGH' | 'LOW' | 'UNKNOWN' | 'FRAUD' | 'SAFE' | 'BET' | 'NO_BET';
  confidence: number;
}

export class EvidenceAgreement {
  /**
   * Evaluates if there are severe conflicts among different evidence sources.
   * e.g., Community says HIGH, Government says LOW.
   * 
   * @param evidence Array of evidence inputs
   * @returns score (0-1) where 1 is perfect agreement, and a boolean indicating if it's inconclusive due to conflict.
   */
  static evaluate(evidence: EvidenceSource[]): { agreementScore: number; isConflicting: boolean; conflictingSources: string[] } {
    if (evidence.length === 0) return { agreementScore: 1.0, isConflicting: false, conflictingSources: [] };

    const signals = new Set(evidence.filter(e => e.signal !== 'UNKNOWN').map(e => e.signal));
    
    // If we have contradictory absolute signals (e.g., BET and NO_BET simultaneously with high confidence)
    let isConflicting = false;
    let conflictingSources: string[] = [];

    // Simple heuristic for conflicting signals
    if ((signals.has('HIGH') && signals.has('LOW')) || 
        (signals.has('FRAUD') && signals.has('SAFE')) ||
        (signals.has('BET') && signals.has('NO_BET'))) {
      isConflicting = true;
      conflictingSources = evidence.filter(e => e.signal !== 'UNKNOWN').map(e => e.name);
    }

    const agreementScore = isConflicting ? 0.2 : 1.0; // Heavily penalize score on conflict

    return { agreementScore, isConflicting, conflictingSources };
  }
}
