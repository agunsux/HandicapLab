export type EligibilityReason =
  | 'missing_core_features'
  | 'missing_odds'
  | 'invalid_probability'
  | 'prediction_not_before_kickoff'
  | 'calibration_inadequate'
  | 'invalid_model_version';

export interface EligibilityInput {
  market: 'ML' | 'OU25' | 'BTTS' | 'AH';
  hasCoreFeatures: boolean;
  hasOdds: boolean;
  probability: number | null;
  predictionTimestamp: string;
  kickoff: string;
  modelVersion: string;
  marketCalibrationAdequate: boolean;
}

export interface EligibilityVerdict {
  eligible: boolean;
  reasons: EligibilityReason[];
}

export const VALID_MODEL_VERSIONS = ['poisson-historical-v1', 'poisson-historical-v1-cal'];

export function evaluateEligibility(input: EligibilityInput): EligibilityVerdict {
  const reasons: EligibilityReason[] = [];

  if (!input.hasCoreFeatures) reasons.push('missing_core_features');
  if (input.market === 'ML' || input.market === 'OU25') {
    if (!input.hasOdds) reasons.push('missing_odds');
  }
  if (input.probability === null || input.probability <= 0.05 || input.probability >= 0.95) {
    reasons.push('invalid_probability');
  }
  if (new Date(input.predictionTimestamp).getTime() > new Date(input.kickoff).getTime()) {
    reasons.push('prediction_not_before_kickoff');
  }
  if (!VALID_MODEL_VERSIONS.includes(input.modelVersion)) reasons.push('invalid_model_version');
  if (!input.marketCalibrationAdequate) reasons.push('calibration_inadequate');

  return { eligible: reasons.length === 0, reasons };
}
