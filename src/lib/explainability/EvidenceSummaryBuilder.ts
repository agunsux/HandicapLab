import { EvidenceAgreementSummary, EvidenceSourceSummary, AgreementLevel } from './types';

export class EvidenceSummaryBuilder {
  /**
   * Translates the structured EvidenceAgreementSummary into a plain-language narrative.
   */
  static build(evidence: EvidenceAgreementSummary): string {
    if (evidence.sourceCount === 0 || !evidence.sources) {
      return 'No independent evidence sources were evaluated for this decision.';
    }

    let narrative = `Evidence Agreement: ${evidence.agreementLevel.replace(/_/g, ' ')} (score: ${(evidence.agreementScore * 100).toFixed(0)}%)\n`;
    narrative += `Sources evaluated: ${evidence.sourceCount}\n`;

    for (const source of evidence.sources) {
      narrative += `  • ${source.engineName}: ${source.signal} (confidence ${(source.confidence * 100).toFixed(0)}%)\n`;
    }

    if (evidence.conflictingModules.length > 0) {
      narrative += `Conflicting signals detected from: ${evidence.conflictingModules.join(', ')}.\n`;
    } else {
      narrative += 'No conflicting signals detected.\n';
    }

    if (evidence.disagreementReason) {
      narrative += `Disagreement reason: ${evidence.disagreementReason}`;
    }

    return narrative.trim();
  }

  /**
   * Helper to derive the structured EvidenceAgreementSummary from raw sources.
   */
  static buildSummary(sources: EvidenceSourceSummary[] = []): EvidenceAgreementSummary {
    if (sources.length === 0) {
      return {
        agreementScore: 1.0,
        agreementLevel: 'VERY_HIGH',
        conflictingModules: [],
        sourceCount: 0,
        sources: []
      };
    }

    const signals = new Set(sources.map(s => s.signal).filter(s => s !== 'UNKNOWN'));
    const isConflicting = (signals.has('BET') && signals.has('NO_BET')) || 
                          (signals.has('HIGH') && signals.has('LOW')) ||
                          (signals.has('SAFE') && signals.has('FRAUD'));
    
    let agreementScore = 1.0;
    let agreementLevel: AgreementLevel = 'VERY_HIGH';
    let conflictingModules: string[] = [];

    if (isConflicting) {
      agreementScore = 0.2;
      agreementLevel = 'CONFLICTING';
      conflictingModules = sources.map(s => s.engineName);
    } else if (signals.size > 1) {
      // Mixed but not strictly opposite (e.g. BET and WAIT)
      agreementScore = 0.6;
      agreementLevel = 'MEDIUM';
    } else {
      // Perfect alignment
      agreementScore = 1.0;
      agreementLevel = 'VERY_HIGH';
    }

    return {
      agreementScore,
      agreementLevel,
      conflictingModules,
      sourceCount: sources.length,
      sources
    };
  }
}
