// ============================================================================
// CANONICAL CONFIDENCE-TO-STRENGTH MAPPING (PRESENTATION LAYER ONLY)
// ============================================================================
// Location: src/lib/publishing/confidenceMapping.ts
//
// Invariant:
// Confidence is a multi-factor signal robustness score (0 - 100) from ValueEngine,
// NOT a win probability.
// It determines visual presentation tier only. It is NEVER an eligibility gate.
// Low confidence (<40% or 40-49%) predictions that are production-valid
// remain visible on SALMO.DEV.
// ============================================================================

import { SignalStrengthLevel, SignalColor } from './types';

export interface ConfidencePresentation {
  confidence: number;
  strengthLevel: SignalStrengthLevel;
  signalColor: SignalColor;
  label: string;
  badgeText: string;
  disclaimer: string;
}

export const CONFIDENCE_DISCLAIMER =
  'Confidence represents multi-factor model robustness and sample sufficiency, separate from win probability.';

/**
 * Maps ValueEngine multi-factor confidence (0 - 100) to visual UI tier.
 * Thresholds:
 *   >= 60%  -> STRONG (Green)
 *   50-59%  -> MODERATE (Yellow)
 *   40-49%  -> WEAK (Orange)
 *   < 40%   -> VERY_WEAK (Red)
 */
export function mapConfidenceToStrength(rawConfidence: number): ConfidencePresentation {
  const confidence = Math.max(0, Math.min(100, Math.round(rawConfidence)));

  let strengthLevel: SignalStrengthLevel;
  let signalColor: SignalColor;
  let label: string;
  let badgeText: string;

  if (confidence >= 60) {
    strengthLevel = 'STRONG';
    signalColor = 'green';
    label = 'Strong Signal';
    badgeText = `${confidence}% · STRONG`;
  } else if (confidence >= 50) {
    strengthLevel = 'MODERATE';
    signalColor = 'yellow';
    label = 'Moderate Signal';
    badgeText = `${confidence}% · MODERATE`;
  } else if (confidence >= 40) {
    strengthLevel = 'WEAK';
    signalColor = 'orange';
    label = 'Weak Signal';
    badgeText = `${confidence}% · WEAK`;
  } else {
    strengthLevel = 'VERY_WEAK';
    signalColor = 'red';
    label = 'Very Weak Signal';
    badgeText = `${confidence}% · VERY WEAK`;
  }

  return {
    confidence,
    strengthLevel,
    signalColor,
    label,
    badgeText,
    disclaimer: CONFIDENCE_DISCLAIMER,
  };
}
