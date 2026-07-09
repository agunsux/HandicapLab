/**
 * PipelineRunContext — Execution identity for all pipeline operations.
 * 
 * Every adapter, comparator, and log entry shares the same context,
 * enabling forensic tracing across legacy ↔ engine parallel runs.
 * 
 * No global variables. Every function receives context explicitly.
 * 
 * Includes:
 *  - executionId / pipelineRunId / correlationId for tracing
 *  - engineVersion / adapterVersions for provenance
 *  - inputFingerprint / outputFingerprint for deterministic comparison
 *  - comparatorOptions for configurable thresholds
 */

import crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ComparatorThresholds {
  probabilityTolerance: number;
  evTolerance: number;
  kellyTolerance: number;
  clvTolerance: number;
  persistenceTolerance: number;
  stateMatchRequired: boolean;
}

export interface PipelineRunContext {
  /** Unique ID for this execution (one transition = one execution) */
  executionId: string;

  /** Unique ID for the entire pipeline run (spans all steps) */
  pipelineRunId: string;

  /** Correlation ID linking legacy + engine runs for comparison */
  correlationId: string;

  /** Pipeline mode */
  mode: 'LEGACY' | 'ENGINE' | 'PARALLEL' | 'REPLAY' | 'DRY_RUN';

  /** Engine version */
  engineVersion: string;

  /** Adapter versions at time of execution */
  adapterVersions: Record<string, string>;

  /** Contract hashes at time of execution */
  contractHashes: Record<string, string>;

  /** SHA-256 fingerprint of all input data (deterministic) */
  inputFingerprint: string;

  /** SHA-256 fingerprint of canonical output (set after execution) */
  outputFingerprint?: string;

  /** When this run started */
  startedAt: Date;

  /** Fixture being processed */
  fixtureId: string;

  /** Comparator configuration */
  comparatorOptions: ComparatorThresholds;

  /** Custom metadata */
  metadata?: Record<string, unknown>;
}

// ─── Canonical Serializer ───────────────────────────────────────────────────

/**
 * Serialize an object to canonical JSON:
 *  - Keys sorted alphabetically
 *  - Stable number formatting (no scientific notation)
 *  - Stable boolean/null
 *  - No undefined values
 * 
 * This ensures identical objects always produce identical strings,
 * which is critical for fingerprinting and deterministic comparison.
 */
export function canonicalSerialize(obj: unknown): string {
  if (obj === null) return 'null';
  if (obj === undefined) return '';
  if (typeof obj === 'boolean') return obj ? 'true' : 'false';
  if (typeof obj === 'number') {
    // Stable number formatting — avoid scientific notation
    if (Number.isInteger(obj)) return obj.toString();
    return obj.toFixed(10).replace(/\.?0+$/, '');
  }
  if (typeof obj === 'string') return JSON.stringify(obj);
  if (Array.isArray(obj)) {
    const items = obj.map(canonicalSerialize);
    return '[' + items.join(',') + ']';
  }
  if (typeof obj === 'object') {
    const keys = Object.keys(obj as Record<string, unknown>).sort();
    const pairs = keys
      .filter(k => (obj as Record<string, unknown>)[k] !== undefined)
      .map(k => canonicalSerialize(k) + ':' + canonicalSerialize((obj as Record<string, unknown>)[k]));
    return '{' + pairs.join(',') + '}';
  }
  return String(obj);
}

/**
 * Compute a deterministic SHA-256 fingerprint from input data.
 * Uses canonical serialization to ensure identical inputs produce identical hashes.
 */
export function computeInputFingerprint(input: Record<string, unknown>): string {
  const canonical = canonicalSerialize(input);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute a deterministic SHA-256 fingerprint from output data.
 */
export function computeOutputFingerprint(output: Record<string, unknown>): string {
  const canonical = canonicalSerialize(output);
  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Compute a shorter deterministic hash (12 chars) for use in version strings,
 * mock IDs, and display purposes. Derived from SHA-256 of canonical input.
 */
export function computeInputHash(input: Record<string, unknown>): string {
  return computeInputFingerprint(input).slice(0, 12);
}

// ─── Factory ────────────────────────────────────────────────────────────────

const ENGINE_VERSION = '6.2.0';

/**
 * Thread-safe counter using UUID for disambiguation.
 * In practice, Node.js single-threaded event loop makes this safe,
 * but we add a random suffix to eliminate any theoretical collision risk.
 */
function generateRunId(prefix: string, fixtureId: string): string {
  const ts = Date.now();
  const suffix = crypto.randomUUID().slice(0, 8);
  return `${prefix}_${ts}_${suffix}_${fixtureId.slice(0, 8)}`;
}

/**
 * Create a new PipelineRunContext.
 * All IDs are unique per call. Context is immutable after creation.
 * Output fingerprint is writable (set after execution completes).
 */
export function createPipelineRunContext(params: {
  fixtureId: string;
  mode: PipelineRunContext['mode'];
  inputData?: Record<string, unknown>;
  contractHashes?: Record<string, string>;
  adapterVersions?: Record<string, string>;
  comparatorOptions?: Partial<ComparatorThresholds>;
  metadata?: Record<string, unknown>;
}): PipelineRunContext {
  const now = new Date();

  const pipelineRunId = generateRunId('pr', params.fixtureId);
  const executionId = generateRunId('ex', params.fixtureId);
  const correlationId = `corr_${pipelineRunId.slice(3, 19)}_${executionId.slice(-6)}`;

  // Compute input fingerprint from input data
  const inputFingerprint = params.inputData
    ? computeInputFingerprint(params.inputData)
    : `no_input_${executionId.slice(0, 8)}`;

  return {
    executionId,
    pipelineRunId,
    correlationId,
    mode: params.mode,
    engineVersion: ENGINE_VERSION,
    adapterVersions: params.adapterVersions || {},
    contractHashes: params.contractHashes || {},
    inputFingerprint,
    startedAt: now,
    fixtureId: params.fixtureId,
    comparatorOptions: {
      probabilityTolerance: params.comparatorOptions?.probabilityTolerance ?? 0.001,
      evTolerance: params.comparatorOptions?.evTolerance ?? 0.01,
      kellyTolerance: params.comparatorOptions?.kellyTolerance ?? 0.01,
      clvTolerance: params.comparatorOptions?.clvTolerance ?? 0.0001,
      persistenceTolerance: params.comparatorOptions?.persistenceTolerance ?? 0,
      stateMatchRequired: params.comparatorOptions?.stateMatchRequired ?? true,
    },
    metadata: params.metadata,
  };
}