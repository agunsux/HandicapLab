// ============================================================================
// HIGH-CONFIDENCE PREDICTION LEDGER & SETTLEMENT CONSTANTS
// ============================================================================
// Location: src/lib/ledger/constants.ts
//
// Invariants:
// 1. High confidence threshold is strictly > 70 (70.0 is NOT qualified, 70.1+ IS).
// 2. Canonical stake is 1.0 virtual research unit (zero real money claims).
// 3. Supported markets strictly: AH, OU, BTTS (Zero Moneyline).
// ============================================================================

export const HIGH_CONFIDENCE_THRESHOLD = 70;

export const VIRTUAL_RESEARCH_STAKE_UNITS = 1.0;

export const BET_TYPE = 'VIRTUAL_RESEARCH' as const;

export const SOURCE_SYSTEM = 'HandicapLab' as const;

export const DESTINATION_SYSTEM = 'SALMO' as const;

export const PIPELINE_VERSION = 'v1.0.0-production' as const;

export const SUPPORTED_LEDGER_MARKETS = ['AH', 'OU', 'BTTS'] as const;

export const UNSUPPORTED_MARKETS = ['1X2', 'ML', 'MONEYLINE', 'MATCH_WINNER'] as const;

export const CONFIDENCE_BANDS = [
  { id: '70_75', label: '70.01 - 75.00%', min: 70.0001, max: 75.0 },
  { id: '75_80', label: '75.01 - 80.00%', min: 75.0001, max: 80.0 },
  { id: '80_85', label: '80.01 - 85.00%', min: 80.0001, max: 85.0 },
  { id: '85_90', label: '85.01 - 90.00%', min: 85.0001, max: 90.0 },
  { id: '90_plus', label: '90.01%+', min: 90.0001, max: 100.0 },
] as const;

export const CONFIDENCE_PRESENTATION_GROUPS = [
  { id: '70_79', label: '70 - 79%', min: 70.0001, max: 79.9999 },
  { id: '80_89', label: '80 - 89%', min: 80.0, max: 89.9999 },
  { id: '90_plus', label: '90%+', min: 90.0, max: 100.0 },
] as const;
