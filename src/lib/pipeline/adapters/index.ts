/**
 * Pipeline Adapters — Barrel Exports
 * ====================================
 * Engine → StepRegistry → Adapter → Service
 * 
 * Import this file to auto-register all adapters.
 */

export { StepRegistry, BaseAdapter } from './StepRegistry';
export type { AdapterManifest, AdapterOutput, ExecuteOptions, IAdapter, AdapterCoverageEntry } from './StepRegistry';

export { FeatureAdapter } from './FeatureAdapter';
export { PredictionAdapter } from './PredictionAdapter';
export { CaptureAdapter } from './CaptureAdapter';
export { SettlementAdapter } from './SettlementAdapter';
export { CLVAdapter } from './CLVAdapter';
export { LedgerAdapter } from './LedgerAdapter';

export { Comparator } from './Comparator';
export type { ComparisonInput, ComparisonResult, BusinessComparison, StateComparison, PersistenceComparison } from './Comparator';

// Import all adapters to ensure registration
import './FeatureAdapter';
import './PredictionAdapter';
import './CaptureAdapter';
import './SettlementAdapter';
import './CLVAdapter';
import './LedgerAdapter';