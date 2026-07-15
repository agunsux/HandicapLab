/**
 * SUPER EPIC 31B.5 — Feature Domain Types
 */

export interface FeatureMetadata {
  featureId: string;
  featureName: string;
  featureFamily: string; // e.g. "fatigue", "elo", "regime", "form"
  description: string;
  dependencies: string[];
  owner: string; // e.g. "handicaplab-core"
  version: string; // e.g. "v1.0.0"
  status: 'active' | 'deprecated' | 'experimental';
  createdAt: string;
  deprecatedAt?: string;
  validationStatus: 'Verified' | 'Unverified';
}
