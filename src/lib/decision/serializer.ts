import { Decision } from './types';

export interface SerializedDecision {
  decision: Record<string, unknown>;
  evidence: Record<string, unknown>;
  trust: Record<string, unknown>;
}

export class DecisionSerializer {
  static toJSON(decision: Decision): SerializedDecision {
    return {
      decision: {
        id: `dec_${Date.now()}`,
        recommendation: decision.recommendation,
        confidence: decision.confidence,
        trustScore: decision.trustScore,
        marketQuality: decision.marketQuality,
        riskLevel: decision.riskLevel,
        expectedValue: decision.expectedValue,
        story: decision.story,
        reason: decision.reason,
        whyNot: decision.whyNot,
        alternatives: decision.alternatives,
        timestamp: new Date().toISOString(),
      },
      evidence: {
        similarMatches: decision.evidence.similarMatches,
        bootstrapConfidence: decision.evidence.bootstrapConfidence,
        calibrationEce: decision.evidence.calibrationEce,
        walkForwardSeasons: decision.evidence.walkForwardSeasons,
        clvPositive: decision.evidence.clvPositive,
        researchGrade: decision.evidence.researchGrade,
        details: decision.evidence.details,
      },
      trust: {
        trustScore: decision.trust.trustScore,
        calibrationScore: decision.trust.calibrationScore,
        clvScore: decision.trust.clvScore,
        historicalAccuracy: decision.trust.historicalAccuracy,
        varianceScore: decision.trust.varianceScore,
        dataQualityScore: decision.trust.dataQualityScore,
      },
    };
  }

  static toMarkdown(decision: Decision): string {
    const lines: string[] = [];
    lines.push(`# Decision Report`);
    lines.push(``);
    lines.push(`## Summary`);
    lines.push(`| Field | Value |`);
    lines.push(`|-------|-------|`);
    lines.push(`| Recommendation | ${decision.recommendation} |`);
    lines.push(`| Confidence | ${decision.confidence}% |`);
    lines.push(`| Trust Score | ${decision.trustScore}/100 |`);
    lines.push(`| Market Quality | ${decision.marketQuality} |`);
    lines.push(`| Risk | ${decision.riskLevel} |`);
    lines.push(`| Expected Value | ${decision.expectedValue}% |`);
    lines.push(``);
    lines.push(`## Story`);
    lines.push(decision.story);
    lines.push(``);
    lines.push(`## Reason`);
    lines.push(decision.reason);
    lines.push(``);
    lines.push(`## Evidence`);
    lines.push(`| Metric | Value |`);
    lines.push(`|--------|-------|`);
    lines.push(`| Similar Matches | ${decision.evidence.similarMatches} |`);
    lines.push(`| Bootstrap Confidence | ${decision.evidence.bootstrapConfidence}% |`);
    lines.push(`| Calibration ECE | ${decision.evidence.calibrationEce} |`);
    lines.push(`| Research Grade | ${decision.evidence.researchGrade} |`);
    lines.push(`| CLV Positive | ${decision.evidence.clvPositive} |`);
    lines.push(``);
    lines.push(`## Trust Breakdown`);
    lines.push(`| Component | Score |`);
    lines.push(`|-----------|-------|`);
    lines.push(`| Calibration | ${decision.trust.calibrationScore}/100 |`);
    lines.push(`| CLV | ${decision.trust.clvScore}/100 |`);
    lines.push(`| Historical Accuracy | ${decision.trust.historicalAccuracy}/100 |`);
    lines.push(`| Variance | ${decision.trust.varianceScore}/100 |`);
    lines.push(`| Data Quality | ${decision.trust.dataQualityScore}/100 |`);
    lines.push(``);
    return lines.join('\n');
  }

  static toCSV(decision: Decision): string {
    return [
      'field,value',
      `recommendation,${decision.recommendation}`,
      `confidence,${decision.confidence}`,
      `trustScore,${decision.trustScore}`,
      `marketQuality,${decision.marketQuality}`,
      `riskLevel,${decision.riskLevel}`,
      `expectedValue,${decision.expectedValue}`,
      `similarMatches,${decision.evidence.similarMatches}`,
      `bootstrapConfidence,${decision.evidence.bootstrapConfidence}`,
      `calibrationEce,${decision.evidence.calibrationEce}`,
      `researchGrade,${decision.evidence.researchGrade}`,
      `calibrationScore,${decision.trust.calibrationScore}`,
      `clvScore,${decision.trust.clvScore}`,
      `historicalAccuracy,${decision.trust.historicalAccuracy}`,
      `varianceScore,${decision.trust.varianceScore}`,
      `dataQualityScore,${decision.trust.dataQualityScore}`,
    ].join('\n');
  }
}