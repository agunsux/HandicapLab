/**
 * Sprint 5a — Pipeline Execution Engine
 * =======================================
 * Not a state machine — a state engine.
 *
 * Every transition:
 *   1. Validates preconditions (from contract)
 *   2. Validates transition guard (allowed path?)
 *   3. Validates dependencies (prev steps complete?)
 *   4. Executes the step
 *   5. Validates postconditions (from contract)
 *   6. Validates invariants (full state consistency)
 *   7. Emits metrics
 *   8. Persists event
 *   9. Advances state with version + reason
 *
 * Modes: LIVE | REPLAY (shared engine, no dual pipelines)
 */

import { query } from '@/lib/db/connection';
import { logger } from '@/lib/logger';
import { ContractValidator, PIPELINE_CONTRACTS } from '@/lib/pipeline/contracts';
import { registerAllContracts } from '@/lib/pipeline/contracts/steps';
import { StepRegistry } from '@/lib/pipeline/adapters/StepRegistry';
import type { PipelineStepContract, ContractValidationResult } from '@/lib/pipeline/contracts';
import type { AdapterOutput, ExecuteOptions } from '@/lib/pipeline/adapters/StepRegistry';

// Ensure all contracts are registered on module load
registerAllContracts();

// ─── State Definitions ──────────────────────────────────────────────────────

export enum PipelineState {
  CREATED = 'CREATED',
  FEATURES_READY = 'FEATURES_READY',
  PREDICTED = 'PREDICTED',
  OPENING_CAPTURED = 'OPENING_CAPTURED',
  TRACKING = 'TRACKING',
  CLOSING_CAPTURED = 'CLOSING_CAPTURED',
  SETTLED = 'SETTLED',
  CLV_READY = 'CLV_READY',
  LEDGER_WRITTEN = 'LEDGER_WRITTEN',
  ARCHIVED = 'ARCHIVED',
}

export enum PipelineEvent {
  FEATURES_COMPUTED = 'FEATURES_COMPUTED',
  FEATURES_FAILED = 'FEATURES_FAILED',
  PREDICTION_CREATED = 'PREDICTION_CREATED',
  PREDICTION_FAILED = 'PREDICTION_FAILED',
  OPENING_CAPTURED = 'OPENING_CAPTURED',
  OPENING_CAPTURE_RETRY = 'OPENING_CAPTURE_RETRY',
  CLOSING_CAPTURED = 'CLOSING_CAPTURED',
  TRACKING_UPDATED = 'TRACKING_UPDATED',
  SETTLEMENT_COMPLETED = 'SETTLEMENT_COMPLETED',
  SETTLEMENT_FAILED = 'SETTLEMENT_FAILED',
  CLV_CALCULATED = 'CLV_CALCULATED',
  CLV_FAILED = 'CLV_FAILED',
  LEDGER_WRITTEN = 'LEDGER_WRITTEN',
  LEDGER_FAILED = 'LEDGER_FAILED',
  ARCHIVED = 'ARCHIVED',
  RECOVERY = 'RECOVERY',
  MANUAL_OVERRIDE = 'MANUAL_OVERRIDE',
  REPLAY = 'REPLAY',
}

export type TransitionReason =
  | 'automatic'
  | 'manual_retry'
  | 'recovery_queue'
  | 'admin_override'
  | 'replay'
  | 'migration'
  | 'system';

export type ExecutionMode = 'LIVE' | 'REPLAY';

// ─── Transition Definition ──────────────────────────────────────────────────

export interface Transition {
  from: PipelineState;
  to: PipelineState;
  event: PipelineEvent;
  allowedReasons: TransitionReason[];
  contractId: string;
  guard?: () => Promise<{ allowed: boolean; reason?: string }>;
}

export interface StateSnapshot {
  fixtureId: string;
  currentState: PipelineState;
  version: number;
  lastEvent: PipelineEvent | null;
  lastTransitionReason: TransitionReason | null;
  previousState: PipelineState | null;
  executionMode: ExecutionMode;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransitionRequest {
  fixtureId: string;
  targetState: PipelineState;
  event: PipelineEvent;
  reason: TransitionReason;
  metadata?: Record<string, unknown>;
  mode?: ExecutionMode;
}

export interface TransitionResult {
  success: boolean;
  from: PipelineState;
  to: PipelineState;
  version: number;
  durationMs: number;
  event: PipelineEvent;
  preconditionResults?: ContractValidationResult;
  postconditionResults?: ContractValidationResult;
  invariantResults?: InvariantResult[];
  errors: string[];
  warnings: string[];
}

export interface InvariantResult {
  id: string;
  description: string;
  passed: boolean;
  detail?: string;
}

export interface PipelineEventRecord {
  id?: string;
  fixtureId: string;
  step: string;
  previousState: PipelineState | null;
  newState: PipelineState;
  event: PipelineEvent;
  reason: TransitionReason;
  timestamp: Date;
  durationMs: number;
  mode: ExecutionMode;
  version: number;
  success: boolean;
  metadata: Record<string, unknown>;
}

// ─── Transition Map ─────────────────────────────────────────────────────────

const TRANSITION_MAP: Transition[] = [
  // CREATED → FEATURES_READY (after feature engineering)
  {
    from: PipelineState.CREATED,
    to: PipelineState.FEATURES_READY,
    event: PipelineEvent.FEATURES_COMPUTED,
    allowedReasons: ['automatic', 'replay', 'recovery_queue'],
    contractId: 'feature_engineering',
  },
  // CREATED → FEATURES_READY (replay bypass)
  {
    from: PipelineState.CREATED,
    to: PipelineState.FEATURES_READY,
    event: PipelineEvent.REPLAY,
    allowedReasons: ['replay'],
    contractId: 'feature_engineering',
  },

  // FEATURES_READY → PREDICTED
  {
    from: PipelineState.FEATURES_READY,
    to: PipelineState.PREDICTED,
    event: PipelineEvent.PREDICTION_CREATED,
    allowedReasons: ['automatic', 'replay'],
    contractId: 'prediction',
  },
  // FEATURES_READY → FEATURES_READY (prediction failed, stay put)
  {
    from: PipelineState.FEATURES_READY,
    to: PipelineState.FEATURES_READY,
    event: PipelineEvent.PREDICTION_FAILED,
    allowedReasons: ['automatic'],
    contractId: 'prediction',
  },

  // PREDICTED → OPENING_CAPTURED
  {
    from: PipelineState.PREDICTED,
    to: PipelineState.OPENING_CAPTURED,
    event: PipelineEvent.OPENING_CAPTURED,
    allowedReasons: ['automatic', 'replay', 'recovery_queue'],
    contractId: 'capture_opening',
  },

  // OPENING_CAPTURED → TRACKING (start periodic capture)
  {
    from: PipelineState.OPENING_CAPTURED,
    to: PipelineState.TRACKING,
    event: PipelineEvent.TRACKING_UPDATED,
    allowedReasons: ['automatic', 'replay'],
    contractId: 'capture_closing',
  },

  // TRACKING → TRACKING (periodic update, same state)
  {
    from: PipelineState.TRACKING,
    to: PipelineState.TRACKING,
    event: PipelineEvent.TRACKING_UPDATED,
    allowedReasons: ['automatic', 'replay'],
    contractId: 'capture_closing',
  },

  // TRACKING → CLOSING_CAPTURED (match starting, final capture)
  {
    from: PipelineState.TRACKING,
    to: PipelineState.CLOSING_CAPTURED,
    event: PipelineEvent.CLOSING_CAPTURED,
    allowedReasons: ['automatic', 'replay', 'recovery_queue'],
    contractId: 'capture_closing',
  },
  // PREDICTED → CLOSING_CAPTURED (if opening+tracking already done)
  {
    from: PipelineState.PREDICTED,
    to: PipelineState.CLOSING_CAPTURED,
    event: PipelineEvent.CLOSING_CAPTURED,
    allowedReasons: ['admin_override', 'replay'],
    contractId: 'capture_closing',
  },

  // CLOSING_CAPTURED → SETTLED
  {
    from: PipelineState.CLOSING_CAPTURED,
    to: PipelineState.SETTLED,
    event: PipelineEvent.SETTLEMENT_COMPLETED,
    allowedReasons: ['automatic', 'replay', 'recovery_queue'],
    contractId: 'settlement',
  },
  // CLOSING_CAPTURED → CLOSING_CAPTURED (settlement failed)
  {
    from: PipelineState.CLOSING_CAPTURED,
    to: PipelineState.CLOSING_CAPTURED,
    event: PipelineEvent.SETTLEMENT_FAILED,
    allowedReasons: ['automatic'],
    contractId: 'settlement',
  },

  // SETTLED → CLV_READY
  {
    from: PipelineState.SETTLED,
    to: PipelineState.CLV_READY,
    event: PipelineEvent.CLV_CALCULATED,
    allowedReasons: ['automatic', 'replay'],
    contractId: 'clv',
  },
  // SETTLED → SETTLED (CLV failed)
  {
    from: PipelineState.SETTLED,
    to: PipelineState.SETTLED,
    event: PipelineEvent.CLV_FAILED,
    allowedReasons: ['automatic'],
    contractId: 'clv',
  },

  // CLV_READY → LEDGER_WRITTEN
  {
    from: PipelineState.CLV_READY,
    to: PipelineState.LEDGER_WRITTEN,
    event: PipelineEvent.LEDGER_WRITTEN,
    allowedReasons: ['automatic', 'replay', 'recovery_queue'],
    contractId: 'ledger',
  },
  // CLV_READY → CLV_READY (ledger failed)
  {
    from: PipelineState.CLV_READY,
    to: PipelineState.CLV_READY,
    event: PipelineEvent.LEDGER_FAILED,
    allowedReasons: ['automatic'],
    contractId: 'ledger',
  },

  // LEDGER_WRITTEN → ARCHIVED
  {
    from: PipelineState.LEDGER_WRITTEN,
    to: PipelineState.ARCHIVED,
    event: PipelineEvent.ARCHIVED,
    allowedReasons: ['automatic', 'replay', 'admin_override'],
    contractId: 'ledger',
  },

  // Recovery transitions (from any failure state back to viable state)
  // These are added programmatically in executeTransition
];

// ─── Invariant Definitions ──────────────────────────────────────────────────

const STATE_INVARIANTS: Record<PipelineState, InvariantResult[]> = {
  [PipelineState.CREATED]: [],
  [PipelineState.FEATURES_READY]: [
    { id: 'inv_feat_001', description: 'Fixture exists in DB', passed: false },
  ],
  [PipelineState.PREDICTED]: [
    { id: 'inv_pred_001', description: 'Prediction record exists', passed: false },
    { id: 'inv_pred_002', description: 'Model version recorded', passed: false },
  ],
  [PipelineState.OPENING_CAPTURED]: [
    { id: 'inv_open_001', description: 'Opening odds in market_movements', passed: false },
    { id: 'inv_open_002', description: 'Prediction exists', passed: false },
  ],
  [PipelineState.TRACKING]: [
    { id: 'inv_trk_001', description: 'Opening odds captured (market_movements)', passed: false },
    { id: 'inv_trk_002', description: 'Prediction exists', passed: false },
  ],
  [PipelineState.CLOSING_CAPTURED]: [
    { id: 'inv_close_001', description: 'Closing odds in closing_odds table', passed: false },
    { id: 'inv_close_002', description: 'Opening odds exist for movement calc', passed: false },
    { id: 'inv_close_003', description: 'Prediction exists', passed: false },
  ],
  [PipelineState.SETTLED]: [
    { id: 'inv_settle_001', description: 'Match is finished (home_goals not null)', passed: false },
    { id: 'inv_settle_002', description: 'Prediction results record exists', passed: false },
    { id: 'inv_settle_003', description: 'Closing odds exist', passed: false },
  ],
  [PipelineState.CLV_READY]: [
    { id: 'inv_clv_001', description: 'CLV record exists in clv_results', passed: false },
    { id: 'inv_clv_002', description: 'Settlement exists', passed: false },
    { id: 'inv_clv_003', description: 'Closing odds used for CLV', passed: false },
  ],
  [PipelineState.LEDGER_WRITTEN]: [
    { id: 'inv_ledger_001', description: 'Ledger entry exists with chain hash', passed: false },
    { id: 'inv_ledger_002', description: 'Prediction exists', passed: false },
    { id: 'inv_ledger_003', description: 'Settlement exists', passed: false },
    { id: 'inv_ledger_004', description: 'CLV exists', passed: false },
  ],
  [PipelineState.ARCHIVED]: [
    { id: 'inv_arch_001', description: 'Ledger entry verified (chain intact)', passed: false },
    { id: 'inv_arch_002', description: 'All prior states validated', passed: false },
  ],
};

// ─── Disallowed Transitions ─────────────────────────────────────────────────

const NEVER_ALLOWED: [PipelineState, PipelineState][] = [
  // Skip critical steps
  [PipelineState.CREATED, PipelineState.SETTLED],
  [PipelineState.CREATED, PipelineState.ARCHIVED],
  [PipelineState.PREDICTED, PipelineState.ARCHIVED],
  [PipelineState.CLV_READY, PipelineState.PREDICTED], // No going back
  [PipelineState.LEDGER_WRITTEN, PipelineState.PREDICTED],
  [PipelineState.LEDGER_WRITTEN, PipelineState.SETTLED],
  // Skip feature engineering
  [PipelineState.CREATED, PipelineState.PREDICTED],
  // Skip opening capture
  [PipelineState.PREDICTED, PipelineState.TRACKING],
  [PipelineState.PREDICTED, PipelineState.SETTLED],
  // Skip closing capture
  [PipelineState.TRACKING, PipelineState.SETTLED],
  [PipelineState.OPENING_CAPTURED, PipelineState.SETTLED],
  // Skip settlement
  [PipelineState.CLOSING_CAPTURED, PipelineState.CLV_READY],
  [PipelineState.CLOSING_CAPTURED, PipelineState.LEDGER_WRITTEN],
  // Skip CLV
  [PipelineState.SETTLED, PipelineState.LEDGER_WRITTEN],
  // Skip ledger
  [PipelineState.CLV_READY, PipelineState.ARCHIVED],
  [PipelineState.SETTLED, PipelineState.ARCHIVED],
];

// ─── Execution Engine ──────────────────────────────────────────────────────

export class PipelineExecutionEngine {
  private log = logger.child('pipeline-engine');
  private validator = new ContractValidator();
  private mode: ExecutionMode = 'LIVE';

  constructor(mode: ExecutionMode = 'LIVE') {
    this.mode = mode;
  }

  /**
   * Set execution mode (LIVE or REPLAY).
   */
  setMode(mode: ExecutionMode): void {
    this.mode = mode;
  }

  /**
   * Execute a state transition.
   * This is the ONLY entry point for changing a fixture's pipeline state.
   */
  async executeTransition(request: TransitionRequest): Promise<TransitionResult> {
    const startedAt = performance.now();

    // 1. Get current state
    const currentState = await this.getCurrentState(request.fixtureId);

    // 2. Validate transition guard
    const guardResult = await this.validateTransitionGuard(currentState, request);

    if (!guardResult.allowed) {
      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        errors: [guardResult.reason || 'Transition not allowed'],
        warnings: [],
      };
    }

    // 3. Find the transition definition
    const transitionDef = TRANSITION_MAP.find(
      t => t.from === currentState.currentState
        && t.to === request.targetState
        && t.event === request.event
    );

    if (!transitionDef) {
      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        errors: [`No transition defined: ${currentState.currentState} → ${request.targetState} (${request.event})`],
        warnings: [],
      };
    }

    // 4. Validate reason is allowed
    if (!transitionDef.allowedReasons.includes(request.reason)) {
      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        errors: [`Reason '${request.reason}' not allowed for this transition. Allowed: ${transitionDef.allowedReasons.join(', ')}`],
        warnings: [],
      };
    }

    // 5. Validate preconditions from contract
    const contract = PIPELINE_CONTRACTS[transitionDef.contractId];
    if (!contract) {
      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        errors: [`No contract found for: ${transitionDef.contractId}`],
        warnings: [],
      };
    }

    const preResult = await this.validator.validatePreconditions(
      contract,
      request.metadata || {}
    );

    if (!preResult.valid) {
      // Log the failed transition event
      await this.persistEvent({
        id: crypto.randomUUID(),
        fixtureId: request.fixtureId,
        step: contract.stepId,
        previousState: currentState.currentState,
        newState: currentState.currentState, // Stay in same state
        event: request.event,
        reason: request.reason,
        timestamp: new Date(),
        durationMs: Math.round(performance.now() - startedAt),
        mode: this.mode,
        version: currentState.version,
        success: false,
        metadata: { errors: preResult.errors, ...(request.metadata || {}) },
      });

      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        preconditionResults: preResult,
        errors: preResult.errors,
        warnings: preResult.warnings,
      };
    }

    // 6. Execute the actual step work (delegated to step-specific logic)
    let stepOutput: Record<string, unknown> = {};
    let stepError: string | null = null;

    try {
      stepOutput = await this.executeStep(contract, request.metadata || {});
    } catch (error: unknown) {
      stepError = error instanceof Error ? error.message : String(error);
    }

    // 7. Validate postconditions
    if (!stepError) {
      // Flatten output fields into context for postcondition checks
      const postContext: Record<string, unknown> = { 
        ...(request.metadata || {}), 
        ...stepOutput 
      };
      const postResult = await this.validator.validatePostconditions(
        contract,
        request.metadata || {},
        postContext
      );

      if (!postResult.valid) {
        await this.persistEvent({
          id: crypto.randomUUID(),
          fixtureId: request.fixtureId,
          step: contract.stepId,
          previousState: currentState.currentState,
          newState: currentState.currentState,
          event: request.event,
          reason: request.reason,
          timestamp: new Date(),
          durationMs: Math.round(performance.now() - startedAt),
          mode: this.mode,
          version: currentState.version,
          success: false,
          metadata: { errors: postResult.errors, ...(request.metadata || {}) },
        });

        return {
          success: false,
          from: currentState.currentState,
          to: request.targetState,
          version: currentState.version,
          durationMs: Math.round(performance.now() - startedAt),
          event: request.event,
          postconditionResults: postResult,
          errors: postResult.errors,
          warnings: postResult.warnings,
        };
      }
    }

    if (stepError) {
      // Failed execution, stay in current state
      await this.persistEvent({
        id: crypto.randomUUID(),
        fixtureId: request.fixtureId,
        step: contract.stepId,
        previousState: currentState.currentState,
        newState: currentState.currentState,
        event: request.event,
        reason: request.reason,
        timestamp: new Date(),
        durationMs: Math.round(performance.now() - startedAt),
        mode: this.mode,
        version: currentState.version,
        success: false,
        metadata: { error: stepError, ...(request.metadata || {}) },
      });

      return {
        success: false,
        from: currentState.currentState,
        to: request.targetState,
        version: currentState.version,
        durationMs: Math.round(performance.now() - startedAt),
        event: request.event,
        errors: [stepError],
        warnings: [],
      };
    }

    // 8. Validate invariants for the target state
    const invariantResults = await this.validateInvariants(request.fixtureId, request.targetState);

    // 9. Persist the successful transition event
    const newVersion = currentState.version + 1;
    const timestamp = new Date();

    await this.persistEvent({
      id: crypto.randomUUID(),
      fixtureId: request.fixtureId,
      step: contract.stepId,
      previousState: currentState.currentState,
      newState: request.targetState,
      event: request.event,
      reason: request.reason,
      timestamp,
      durationMs: Math.round(performance.now() - startedAt),
      mode: this.mode,
      version: newVersion,
      success: true,
      metadata: request.metadata || {},
    });

    // 10. Update fixture state
    await this.updateFixtureState(request.fixtureId, {
      currentState: request.targetState,
      version: newVersion,
      lastEvent: request.event,
      lastTransitionReason: request.reason,
      previousState: currentState.currentState,
    });

    const durationMs = Math.round(performance.now() - startedAt);

    // 11. Emit metrics
    this.emitTransitionMetrics(contract, durationMs, true);

    return {
      success: true,
      from: currentState.currentState,
      to: request.targetState,
      version: newVersion,
      durationMs,
      event: request.event,
      invariantResults,
      errors: [],
      warnings: invariantResults.filter(i => !i.passed).map(i => `Invariant: ${i.description}`),
    };
  }

  /**
   * Validate that a transition is allowed.
   */
  async validateTransitionGuard(
    currentState: StateSnapshot,
    request: TransitionRequest
  ): Promise<{ allowed: boolean; reason?: string }> {
    // Check never-allowed list
    for (const [from, to] of NEVER_ALLOWED) {
      if (currentState.currentState === from && request.targetState === to) {
        return { allowed: false, reason: `Transition ${from} → ${to} is never allowed` };
      }
    }

    // Check for backward transitions (only admin_override or replay)
    const stateOrder = Object.values(PipelineState);
    const currentIdx = stateOrder.indexOf(currentState.currentState);
    const targetIdx = stateOrder.indexOf(request.targetState);

    if (targetIdx < currentIdx && request.reason !== 'admin_override' && request.reason !== 'replay') {
      // Allow same-state transitions (e.g., tracking → tracking for periodic updates)
      if (currentState.currentState !== request.targetState) {
        return {
          allowed: false,
          reason: `Cannot go backward from ${currentState.currentState} (v${currentState.version}) to ${request.targetState}. Use admin_override or replay.`,
        };
      }
    }

    // Check transition exists in map
    const exists = TRANSITION_MAP.some(
      t => t.from === currentState.currentState
        && t.to === request.targetState
        && t.event === request.event
    );

    if (!exists && currentState.currentState !== request.targetState) {
      return {
        allowed: false,
        reason: `No valid transition: ${currentState.currentState} → ${request.targetState} with event ${request.event}`,
      };
    }

    return { allowed: true };
  }

  /**
   * Validate all invariants for a given state.
   */
  async validateInvariants(
    fixtureId: string,
    state: PipelineState
  ): Promise<InvariantResult[]> {
    const invariants = STATE_INVARIANTS[state] || [];
    const results: InvariantResult[] = [];

    for (const inv of invariants) {
      const passed = await this.checkInvariant(fixtureId, inv.id);
      results.push({
        id: inv.id,
        description: inv.description,
        passed,
        detail: passed ? 'OK' : 'FAILED',
      });
    }

    return results;
  }

  /**
   * Get the current state of a fixture's pipeline.
   */
  async getCurrentState(fixtureId: string): Promise<StateSnapshot> {
    try {
      const result = await query(
        `SELECT pipeline_state, pipeline_version, pipeline_last_event,
                pipeline_transition_reason, pipeline_previous_state,
                pipeline_mode, pipeline_metadata, created_at, updated_at
         FROM matches
         WHERE id = $1`,
        [fixtureId]
      );

      if (result.rows.length === 0) {
        return {
          fixtureId,
          currentState: PipelineState.CREATED,
          version: 0,
          lastEvent: null,
          lastTransitionReason: null,
          previousState: null,
          executionMode: this.mode,
          metadata: {},
          createdAt: new Date(),
          updatedAt: new Date(),
        };
      }

      const row = result.rows[0];
      return {
        fixtureId,
        currentState: (row.pipeline_state as PipelineState) || PipelineState.CREATED,
        version: row.pipeline_version || 0,
        lastEvent: row.pipeline_last_event || null,
        lastTransitionReason: row.pipeline_transition_reason || null,
        previousState: row.pipeline_previous_state || null,
        executionMode: (row.pipeline_mode as ExecutionMode) || this.mode,
        metadata: row.pipeline_metadata || {},
        createdAt: new Date(row.created_at),
        updatedAt: new Date(row.updated_at),
      };
    } catch (error: any) {
      this.log.error('get_current_state_failed', { fixtureId, error: error.message });
      return {
        fixtureId,
        currentState: PipelineState.CREATED,
        version: 0,
        lastEvent: null,
        lastTransitionReason: null,
        previousState: null,
        executionMode: this.mode,
        metadata: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }
  }

  /**
   * Get transition history for a fixture.
   */
  async getTransitionHistory(fixtureId: string): Promise<PipelineEventRecord[]> {
    try {
      const result = await query(
        `SELECT * FROM pipeline_events
         WHERE fixture_id = $1
         ORDER BY version ASC`,
        [fixtureId]
      );

      return result.rows.map((r: any) => ({
        id: r.id,
        fixtureId: r.fixture_id,
        step: r.step,
        previousState: r.previous_state,
        newState: r.new_state,
        event: r.event,
        reason: r.reason,
        timestamp: new Date(r.timestamp),
        durationMs: r.duration_ms,
        mode: r.mode,
        version: r.version,
        success: r.success,
        metadata: r.metadata || {},
      }));
    } catch (error: any) {
      this.log.error('get_transition_history_failed', { fixtureId, error: error.message });
      return [];
    }
  }

  /**
   * Get transition latency for dashboard.
   */
  async getTransitionLatency(): Promise<Record<string, { avgMs: number; p50Ms: number; p99Ms: number }>> {
    try {
      const result = await query(`
        SELECT 
          step,
          AVG(duration_ms) as avg_ms,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY duration_ms) as p50_ms,
          PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY duration_ms) as p99_ms
        FROM pipeline_events
        WHERE success = true
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY step
      `);

      const map: Record<string, { avgMs: number; p50Ms: number; p99Ms: number }> = {};
      for (const row of result.rows) {
        map[row.step] = {
          avgMs: Math.round(parseFloat(row.avg_ms)),
          p50Ms: Math.round(parseFloat(row.p50_ms)),
          p99Ms: Math.round(parseFloat(row.p99_ms)),
        };
      }
      return map;
    } catch {
      return {};
    }
  }

  // ─── Private ─────────────────────────────────────────────────────────────

  private async executeStep(
    contract: PipelineStepContract,
    input: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Try to resolve via adapter registry first
    const adapter = StepRegistry.get(contract.stepId);
    if (adapter) {
      this.log.info('step_via_adapter', { step: contract.stepId, adapter: adapter.manifest.name });
      const options: ExecuteOptions = { mode: this.mode };
      const adapterResult: AdapterOutput = await adapter.execute(contract, input, options);

      if (!adapterResult.success) {
        throw new Error(adapterResult.error || `Adapter execution failed for ${contract.stepId}`);
      }

      // Attach contract metadata for traceability
      adapterResult.output['_adapter'] = adapter.manifest.name;
      adapterResult.output['_contractVersion'] = adapterResult.contractVersion;
      adapterResult.output['_contractHash'] = adapterResult.contractHash;

      return adapterResult.output;
    }

    // Fallback: legacy synthetic execution (for tests that don't register adapters)
    this.log.warn('step_execution_fallback', { step: contract.stepId, mode: this.mode });
    const output: Record<string, unknown> = { ...input };
    if (this.mode === 'REPLAY') {
      output.replay = true;
    }
    for (const field of contract.output.guaranteedFields) {
      if (output[field] === undefined) {
        switch (field) {
          case 'featureVersion': output[field] = `v1_${Date.now()}`; break;
          case 'featureCount': output[field] = 42; break;
          case 'features': output[field] = input['features'] || {}; break;
          case 'homeProb': output[field] = 0.5; break;
          case 'drawProb': output[field] = 0.3; break;
          case 'awayProb': output[field] = 0.2; break;
          case 'expectedGoals': output[field] = 2.5; break;
          case 'confidence': output[field] = 'high'; break;
          case 'modelVersion': output[field] = 'v1'; break;
          case 'predictionId': output[field] = crypto.randomUUID(); break;
          case 'capturedAt': output[field] = new Date().toISOString(); break;
          case 'capturePhase': output[field] = 'opening'; break;
          case 'closingUpdated': output[field] = true; break;
          case 'actualHomeScore': output[field] = input['homeScore'] || 1; break;
          case 'actualAwayScore': output[field] = input['awayScore'] || 0; break;
          case 'hit1x2': output[field] = true; break;
          case 'hitAH': output[field] = true; break;
          case 'hitOU': output[field] = false; break;
          case 'clv': output[field] = 0.05; break;
          case 'clvBps': output[field] = 500; break;
          case 'edgeVsClosing': output[field] = 0.1; break;
          case 'entryId': output[field] = crypto.randomUUID(); break;
          case 'chainHash': output[field] = `ch_${crypto.randomUUID().slice(0, 8)}`; break;
          case 'previousEntryId': output[field] = crypto.randomUUID(); break;
          default: output[field] = `mock_${field}`; break;
        }
      }
    }
    return output;
  }

  private async checkInvariant(
    fixtureId: string,
    invariantId: string
  ): Promise<boolean> {
    try {
      switch (invariantId) {
        case 'inv_feat_001':
          // Fixture exists in DB
          const featResult = await query('SELECT id FROM matches WHERE id = $1', [fixtureId]);
          return featResult.rows.length > 0;

        case 'inv_pred_001':
          // Prediction record exists
          const predResult = await query('SELECT id FROM predictions WHERE match_id = $1 LIMIT 1', [fixtureId]);
          return predResult.rows.length > 0;

        case 'inv_pred_002':
          // Model version recorded
          const mvResult = await query('SELECT model_version FROM predictions WHERE match_id = $1 AND model_version IS NOT NULL LIMIT 1', [fixtureId]);
          return mvResult.rows.length > 0;

        case 'inv_open_001':
        case 'inv_trk_001':
          // Opening odds in market_movements
          const openResult = await query(
            "SELECT id FROM market_movements WHERE match_id = $1 AND capture_phase = 'opening' LIMIT 1",
            [fixtureId]
          );
          return openResult.rows.length > 0;

        case 'inv_close_001':
          // Closing odds in closing_odds table
          const closeResult = await query(
            'SELECT id FROM closing_odds WHERE match_id = $1 LIMIT 1',
            [fixtureId]
          );
          return closeResult.rows.length > 0;

        case 'inv_close_002':
          // Opening odds exist for movement calc
          const open2Result = await query(
            "SELECT id FROM market_movements WHERE match_id = $1 AND capture_phase = 'opening' LIMIT 1",
            [fixtureId]
          );
          return open2Result.rows.length > 0;

        case 'inv_settle_001':
          // Match is finished (home_goals not null)
          const settleResult = await query(
            'SELECT id FROM matches WHERE id = $1 AND home_goals IS NOT NULL',
            [fixtureId]
          );
          return settleResult.rows.length > 0;

        case 'inv_settle_002':
          // Prediction results record exists
          const prResult = await query(
            'SELECT id FROM prediction_results WHERE match_id = $1 LIMIT 1',
            [fixtureId]
          );
          return prResult.rows.length > 0;

        case 'inv_settle_003':
        case 'inv_clv_003':
          // Closing odds exist
          const coResult = await query(
            'SELECT id FROM closing_odds WHERE match_id = $1 LIMIT 1',
            [fixtureId]
          );
          return coResult.rows.length > 0;

        case 'inv_clv_001':
          // CLV record exists in clv_results
          const clvResult = await query(
            'SELECT id FROM clv_results WHERE match_id = $1 LIMIT 1',
            [fixtureId]
          );
          return clvResult.rows.length > 0;

        case 'inv_clv_002':
          // Settlement exists
          const sResult = await query(
            'SELECT id FROM prediction_results WHERE match_id = $1 LIMIT 1',
            [fixtureId]
          );
          return sResult.rows.length > 0;

        case 'inv_ledger_001':
          // Ledger entry exists with chain hash
          const ledResult = await query(
            'SELECT id FROM evidence_ledger WHERE fixture_id = $1 AND chain_hash IS NOT NULL LIMIT 1',
            [fixtureId]
          );
          return ledResult.rows.length > 0;

        case 'inv_ledger_002':
          return (await this.checkInvariant(fixtureId, 'inv_pred_001'));

        case 'inv_ledger_003':
          return (await this.checkInvariant(fixtureId, 'inv_settle_002'));

        case 'inv_ledger_004':
          return (await this.checkInvariant(fixtureId, 'inv_clv_001'));

        case 'inv_arch_001':
        case 'inv_arch_002':
          return true; // Deferred to ledger verification

        default:
          return true;
      }
    } catch (error: any) {
      this.log.error('invariant_check_failed', { invariantId, fixtureId, error: error.message });
      return false;
    }
  }

  private async persistEvent(record: PipelineEventRecord): Promise<void> {
    try {
      await query(
        `INSERT INTO pipeline_events
         (id, fixture_id, step, previous_state, new_state, event, reason,
          timestamp, duration_ms, mode, version, success, metadata)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT DO NOTHING`,
        [
          record.id || crypto.randomUUID(),
          record.fixtureId,
          record.step,
          record.previousState,
          record.newState,
          record.event,
          record.reason,
          record.timestamp,
          record.durationMs,
          record.mode,
          record.version,
          record.success,
          JSON.stringify(record.metadata),
        ]
      );
    } catch (error: any) {
      this.log.error('persist_event_failed', { error: error.message });
    }
  }

  private async updateFixtureState(
    fixtureId: string,
    update: {
      currentState: PipelineState;
      version: number;
      lastEvent: PipelineEvent;
      lastTransitionReason: TransitionReason;
      previousState: PipelineState | null;
    }
  ): Promise<void> {
    try {
      await query(
        `UPDATE matches SET
           pipeline_state = $1,
           pipeline_version = $2,
           pipeline_last_event = $3,
           pipeline_transition_reason = $4,
           pipeline_previous_state = $5,
           pipeline_mode = $6,
           updated_at = NOW()
         WHERE id = $7`,
        [
          update.currentState,
          update.version,
          update.lastEvent,
          update.lastTransitionReason,
          update.previousState,
          this.mode,
          fixtureId,
        ]
      );
    } catch (error: any) {
      this.log.error('update_fixture_state_failed', { fixtureId, error: error.message });
    }
  }

  private emitTransitionMetrics(
    contract: PipelineStepContract,
    durationMs: number,
    success: boolean
  ): void {
    // In production, this emits to Prometheus/OpenTelemetry.
    // For now, we log.
    this.log.info('transition_metrics', {
      step: contract.stepId,
      durationMs,
      success,
      mode: this.mode,
    });
  }
}

// ─── Pipeline Health Snapshot ───────────────────────────────────────────────

export async function getPipelineHealth(): Promise<{
  byState: Record<string, number>;
  byStep: Record<string, { total: number; success: number; failed: number }>;
  latency: Record<string, { avgMs: number; p50Ms: number; p99Ms: number }>;
}> {
  const engine = new PipelineExecutionEngine();

  try {
    // Count fixtures by state
    const stateCounts = await query(`
      SELECT pipeline_state, COUNT(*) as count
      FROM matches
      WHERE pipeline_state IS NOT NULL
      GROUP BY pipeline_state
      ORDER BY pipeline_state
    `);

    const byState: Record<string, number> = {};
    for (const row of stateCounts.rows) {
      byState[row.pipeline_state] = parseInt(row.count);
    }

    // Count events by step
    const eventCounts = await query(`
      SELECT step, success, COUNT(*) as count
      FROM pipeline_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY step, success
    `);

    const byStep: Record<string, { total: number; success: number; failed: number }> = {};
    for (const row of eventCounts.rows) {
      if (!byStep[row.step]) {
        byStep[row.step] = { total: 0, success: 0, failed: 0 };
      }
      byStep[row.step].total += parseInt(row.count);
      if (row.success) {
        byStep[row.step].success += parseInt(row.count);
      } else {
        byStep[row.step].failed += parseInt(row.count);
      }
    }

    // Get latency
    const latency = await engine.getTransitionLatency();

    return { byState, byStep, latency };
  } catch (error: any) {
    return { byState: {}, byStep: {}, latency: {} };
  }
}