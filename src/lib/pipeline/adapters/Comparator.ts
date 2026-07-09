/**
 * Pipeline Comparator — Three-level comparison for Sprint 6.2 Parallel Run
 * =========================================================================
 * Compares old pipeline vs engine pipeline at three levels:
 *   Level 1: Business Output (predictions, probabilities, CLV values)
 *   Level 2: State Output (state transitions, version changes)
 *   Level 3: Persistence Output (DB writes, affected rows)
 */

import { logger } from '@/lib/logger';
import { 
  type ComparatorThresholds, 
  computeInputFingerprint, 
  computeOutputFingerprint,
  canonicalSerialize 
} from '@/lib/pipeline/PipelineRunContext';

// ─── Default Tolerances ─────────────────────────────────────────────────────

export const DEFAULT_THRESHOLDS: ComparatorThresholds = {
  probabilityTolerance: 0.001,
  evTolerance: 0.01,
  kellyTolerance: 0.01,
  clvTolerance: 0.0001,
  persistenceTolerance: 0,
  stateMatchRequired: true,
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ComparisonInput {
  /** Label for the comparison (e.g., "match-123 prediction") */
  label: string;

  /** Output from old pipeline */
  old: Record<string, unknown>;

  /** Output from engine pipeline */
  engine: Record<string, unknown>;

  /** Optional per-comparison thresholds (overrides defaults) */
  thresholds?: Partial<ComparatorThresholds>;
}

export interface BusinessComparison {
  field: string;
  oldValue: unknown;
  engineValue: unknown;
  match: boolean;
  tolerance?: number;
}

export interface StateComparison {
  field: string;
  oldState: unknown;
  engineState: unknown;
  match: boolean;
}

export interface PersistenceComparison {
  table: string;
  oldRowCount: number;
  engineRowCount: number;
  match: boolean;
  details?: string;
}

export interface ComparisonProvenance {
  engineVersion: string;
  adapterVersion: string;
  contractId: string;
  contractHash: string;
  manifestHash: string;
  inputFingerprint: string;
  outputFingerprintLegacy: string;
  outputFingerprintEngine: string;
}

export interface ComparisonStats {
  totalFieldsCompared: number;
  matchingFields: number;
  failedFields: number;
  maxDifference: number;
  confidence: number;
  meanDelta: number;
}

export interface ComparisonResult {
  label: string;
  passed: boolean;
  business: BusinessComparison[];
  state: StateComparison[];
  persistence: PersistenceComparison[];
  summary: string;
  provenance?: ComparisonProvenance;
  stats?: ComparisonStats;
}

// ─── Business Fields to Compare ─────────────────────────────────────────────

const BUSINESS_FIELDS: Record<string, string[]> = {
  prediction: ['homeProb', 'drawProb', 'awayProb', 'expectedGoals', 'confidence', 'modelVersion'],
  feature_engineering: ['featureVersion', 'featureCount'],
  capture: ['capturePhase', 'homeOdds', 'awayOdds', 'drawOdds'],
  settlement: ['hit1x2', 'hitAH', 'hitOU', 'actualHomeScore', 'actualAwayScore'],
  clv: ['clv', 'clvBps', 'edgeVsClosing'],
  ledger: ['entryId', 'chainHash', 'previousEntryId'],
};

const STATE_FIELDS = ['currentState', 'version', 'lastEvent', 'lastTransitionReason', 'previousState'];

const PERSISTENCE_TABLES = [
  'predictions',
  'prediction_results',
  'clv_results',
  'market_movements',
  'closing_odds',
  'pipeline_events',
  'capture_log',
];

// ─── Comparator ─────────────────────────────────────────────────────────────

export class Comparator {
  private log = logger.child('comparator');

  /**
   * Compare old pipeline vs engine pipeline outputs.
   */
  compare(input: ComparisonInput): ComparisonResult {
    const business = this.compareBusiness(input);
    const state = this.compareState(input);
    const persistence = this.comparePersistence(input);
    const businessMatch = business.every(b => b.match);
    const stateMatch = state.every(s => s.match);
    const persistenceMatch = persistence.every(p => p.match);
    const passed = businessMatch && stateMatch && persistenceMatch;
    const failures = [
      ...business.filter(b => !b.match).map(b => `Business: ${b.field}`),
      ...state.filter(s => !s.match).map(s => `State: ${s.field}`),
      ...persistence.filter(p => !p.match).map(p => `Persistence: ${p.table}`),
    ];

    // Compute output fingerprints using canonical serialization
    const outputFingerprintLegacy = computeOutputFingerprint(input.old);
    const outputFingerprintEngine = computeOutputFingerprint(input.engine);
    const fingerprintMatch = outputFingerprintLegacy === outputFingerprintEngine;

    // Compute stats
    const allFields: { old: unknown; engine: unknown }[] = [
      ...business.map(b => ({ old: b.oldValue, engine: b.engineValue })),
      ...state.map(s => ({ old: s.oldState, engine: s.engineState })),
    ];
    const deltas: number[] = [];
    for (const f of allFields) {
      if (typeof f.old === 'number' && typeof f.engine === 'number') {
        deltas.push(Math.abs(f.old - f.engine));
      }
    }
    const totalCompared = allFields.length;
    const matching = business.filter(b => b.match).length + state.filter(s => s.match).length;
    const maxDelta = deltas.length > 0 ? Math.max(...deltas) : 0;
    const meanDelta = deltas.length > 0 ? deltas.reduce((a, b) => a + b, 0) / deltas.length : 0;
    const confidence = totalCompared > 0 ? matching / totalCompared : 1;

    // Extract provenance from input data
    const provenance: ComparisonProvenance = {
      engineVersion: (input.old['_engineVersion'] as string) || 'unknown',
      adapterVersion: (input.old['_adapter'] as string) || 'unknown',
      contractId: (input.old['_contractId'] as string) || input.label,
      contractHash: (input.old['_contractHash'] as string) || '',
      manifestHash: (input.old['_adapter'] as string) || '',
      inputFingerprint: (input.old['_inputFingerprint'] as string) || '',
      outputFingerprintLegacy,
      outputFingerprintEngine,
    };

    // Quick path: if fingerprints match, outputs are 100% identical
    if (fingerprintMatch) {
      return {
        label: input.label,
        passed: true,
        business: business.map(b => ({ ...b, match: true })),
        state: state.map(s => ({ ...s, match: true })),
        persistence,
        summary: '✅ Outputs identical (fingerprint match)',
        provenance,
        stats: {
          totalFieldsCompared: totalCompared,
          matchingFields: totalCompared,
          failedFields: 0,
          maxDifference: 0,
          confidence: 1.0,
          meanDelta: 0,
        },
      };
    }

    return {
      label: input.label,
      passed,
      business,
      state,
      persistence,
      summary: failures.length === 0
        ? '✅ All levels match'
        : `❌ ${failures.length} mismatches: ${failures.join(', ')}`,
      provenance,
      stats: {
        totalFieldsCompared: totalCompared,
        matchingFields: matching,
        failedFields: failures.length,
        maxDifference: maxDelta,
        confidence: Math.round(confidence * 100000) / 100000,
        meanDelta: Math.round(meanDelta * 100000) / 100000,
      },
    };
  }

  /**
   * Compare all fields in a batch and return summary.
   */
  compareBatch(inputs: ComparisonInput[]): {
    total: number;
    passed: number;
    failed: number;
    results: ComparisonResult[];
  } {
    const results = inputs.map(i => this.compare(i));
    return {
      total: results.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
      results,
    };
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private compareBusiness(input: ComparisonInput): BusinessComparison[] {
    const comparisons: BusinessComparison[] = [];
    const fields = this.getFieldsForLabel(input.label);
    const thresholds: ComparatorThresholds = { ...DEFAULT_THRESHOLDS, ...input.thresholds };

    for (const field of fields) {
      const oldVal = input.old[field];
      const engineVal = input.engine[field];

      let match: boolean;
      if (typeof oldVal === 'number' && typeof engineVal === 'number') {
        // Determine tolerance based on field type
        let tolerance = 0.001;
        if (field.startsWith('clv') || field === 'clvBps') {
          tolerance = thresholds.clvTolerance;
        } else if (field.startsWith('prob') || field.endsWith('Prob')) {
          tolerance = thresholds.probabilityTolerance;
        } else if (field.startsWith('ev') || field.endsWith('Edge')) {
          tolerance = thresholds.evTolerance;
        } else {
          tolerance = thresholds.probabilityTolerance; // default
        }
        match = Math.abs(oldVal - engineVal) < tolerance;
      } else {
        match = oldVal === engineVal;
      }

      comparisons.push({ field, oldValue: oldVal, engineValue: engineVal, match });
    }

    return comparisons;
  }

  private compareState(input: ComparisonInput): StateComparison[] {
    const comparisons: StateComparison[] = [];

    for (const field of STATE_FIELDS) {
      const oldVal = input.old[field];
      const engineVal = input.engine[field];
      comparisons.push({
        field,
        oldState: oldVal,
        engineState: engineVal,
        match: oldVal === engineVal,
      });
    }

    return comparisons;
  }

  private comparePersistence(input: ComparisonInput): PersistenceComparison[] {
    const comparisons: PersistenceComparison[] = [];
    const oldWriteInfo = this.extractWriteInfo(input.old);
    const engineWriteInfo = this.extractWriteInfo(input.engine);

    for (const table of PERSISTENCE_TABLES) {
      const oldCount = oldWriteInfo[table] || 0;
      const engineCount = engineWriteInfo[table] || 0;
      comparisons.push({
        table,
        oldRowCount: oldCount,
        engineRowCount: engineCount,
        match: oldCount === engineCount,
      });
    }

    return comparisons;
  }

  private getFieldsForLabel(label: string): string[] {
    for (const [key, fields] of Object.entries(BUSINESS_FIELDS)) {
      if (label.includes(key)) return fields;
    }
    return [];
  }

  private extractWriteInfo(output: Record<string, unknown>): Record<string, number> {
    const writes: Record<string, number> = {};
    const meta = output['_writes'];
    if (meta && typeof meta === 'object') {
      for (const [table, count] of Object.entries(meta as Record<string, unknown>)) {
        writes[table] = typeof count === 'number' ? count : 0;
      }
    }
    return writes;
  }
}