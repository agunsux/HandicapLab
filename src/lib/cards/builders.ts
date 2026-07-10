import { ModelCard, InsightCard, ConfidenceCard, ModelCardData, InsightCardData, ConfidenceCardData } from './types';
import type { ValidationMetrics } from '../validation/metrics';
import type { CalibrationReport } from '../validation/calibration';

export function buildModelCard(
  modelId: string, modelName: string, version: string, algo: string,
  status: string, sampleSize: number, metrics: ValidationMetrics,
  calibration: CalibrationReport, trainedAt: string, limitations: string[] = []
): ModelCard {
  return {
    type: 'model',
    data: {
      modelId, modelName, semanticVersion: version, algo, status, sampleSize,
      roi: metrics.roi, yield_: metrics.yield_,
      calibrationEce: calibration.ece, brierScore: metrics.brierScore, logLoss: metrics.logLoss,
      trainedAt, lastValidatedAt: new Date().toISOString(), knownLimitations: limitations,
    },
    generatedAt: new Date().toISOString(),
  };
}

export function buildInsightCard(
  fixtureId: string, matchLabel: string, confidence: number,
  ece: number, clv: number, historicalRoi: number, expectedValue: number,
  marketType?: string
): InsightCard {
  const marketQuality = confidence >= 80 && ece <= 0.02 && clv >= 0.03 ? 'excellent'
    : confidence >= 60 && ece <= 0.035 && clv >= 0.01 ? 'good'
    : ece <= 0.05 && clv >= 0 ? 'neutral' : 'avoid';
  const riskLevel = confidence >= 70 ? 'low' : confidence >= 40 ? 'medium' : 'high';
  const evidence: string[] = [];
  if (clv > 0.03) evidence.push('Positive CLV history');
  if (confidence > 70) evidence.push('High model agreement');
  if (ece < 0.02) evidence.push('Excellent calibration');

  return {
    type: 'insight',
    data: {
      fixtureId, matchLabel, marketType, confidence, marketQuality, expectedValue,
      reasonSummary: confidence >= 70 ? 'Strong alignment across all signals' : 'Mixed signals — exercise caution',
      topEvidence: evidence, riskLevel,
      recommendation: marketQuality === 'excellent' ? 'Consider' : marketQuality === 'avoid' ? 'Avoid' : 'Evaluate',
    },
    generatedAt: new Date().toISOString(),
  };
}

export function buildConfidenceCard(
  overall: number, modelAgreement: number, historicalAccuracy: number,
  calibration: number, dataQuality: number, marketStability: number
): ConfidenceCard {
  return {
    type: 'confidence',
    data: { overall, modelAgreement, historicalAccuracy, calibration, dataQuality, marketStability },
    generatedAt: new Date().toISOString(),
  };
}