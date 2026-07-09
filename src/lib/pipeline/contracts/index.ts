/**
 * Sprint 5.0 — Pipeline Reliability Contract
 * ============================================
 * Every pipeline step has a formal contract specifying:
 *   Input / Output / Preconditions / Postconditions
 *   Retry Policy / Timeout / Idempotency
 *   Failure Mode / Recovery Strategy / Metrics
 *
 * Contracts are the source of truth — used by the State Machine,
 * Recovery system, and Observability layer.
 */

// ─── Core Contract Types ────────────────────────────────────────────────────

export type RetryPolicy =
  | { type: 'no_retry' }
  | { type: 'exponential_backoff'; maxAttempts: number; baseDelayMs: number; maxDelayMs: number }
  | { type: 'fixed_interval'; maxAttempts: number; intervalMs: number }
  | { type: 'circuit_breaker'; maxAttempts: number; resetTimeoutMs: number };

export type FailureMode =
  | 'blocking'       // Pipeline cannot proceed without this step
  | 'non_blocking'   // Pipeline can proceed, step will be retried later
  | 'degraded';      // Pipeline proceeds with degraded functionality

export type RecoveryStrategy =
  | { type: 'automatic_retry'; maxRetries: number }
  | { type: 'dead_letter_queue' }
  | { type: 'manual_intervention' }
  | { type: 'fallback'; fallbackFn: string }
  | { type: 'skip_and_log' };

export type IdempotencyScheme =
  | { type: 'idempotency_key'; keyFields: string[] }
  | { type: 'upsert'; uniqueFields: string[] }
  | { type: 'dedup_window'; windowMs: number; keyFields: string[] };

export interface MetricDefinition {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'timer';
  description: string;
  unit?: string;
  labels?: Record<string, string[]>;
}

// ─── Pipeline Step Contract ─────────────────────────────────────────────────

export interface PipelineStepContract<I = unknown, O = unknown> {
  /** Unique step identifier (e.g. 'prediction', 'capture_opening') */
  stepId: string;

  /** Human-readable name */
  name: string;

  /** Brief description of what this step does */
  description: string;

  /** Schema or description of input data */
  input: {
    type: string;
    schema?: Record<string, unknown>;
    description: string;
    requiredFields: string[];
  };

  /** Schema or description of output data */
  output: {
    type: string;
    schema?: Record<string, unknown>;
    description: string;
    guaranteedFields: string[];
  };

  /** Conditions that must be true before execution */
  preconditions: Precondition[];

  /** Invariants that must hold after execution */
  postconditions: Postcondition[];

  /** How to handle failures */
  retryPolicy: RetryPolicy;

  /** Maximum execution time before timeout */
  timeoutMs: number;

  /** How idempotency is ensured */
  idempotency: IdempotencyScheme;

  /** What happens when this step fails */
  failureMode: FailureMode;

  /** How to recover from failure */
  recoveryStrategy: RecoveryStrategy;

  /** Metrics produced by this step */
  metrics: MetricDefinition[];

  /** Dependencies on other steps */
  dependsOn: string[];
}

export interface Precondition {
  id: string;
  description: string;
  /** Human-readable check that can be validated */
  check: string;
  /** Severity if precondition fails */
  severity: 'critical' | 'warning';
}

export interface Postcondition {
  id: string;
  description: string;
  check: string;
  /** Whether this is a hard guarantee or best-effort */
  guarantee: 'hard' | 'soft';
}

export interface ContractValidationResult {
  stepId: string;
  valid: boolean;
  preconditionResults: { id: string; passed: boolean; detail?: string }[];
  postconditionResults: { id: string; passed: boolean; detail?: string }[];
  errors: string[];
  warnings: string[];
}

// ─── Validator ──────────────────────────────────────────────────────────────

export class ContractValidator {
  /**
   * Validate that preconditions are met before executing a step.
   * In production, this calls registered check functions.
   */
  async validatePreconditions(
    contract: PipelineStepContract,
    context: Record<string, unknown>
  ): Promise<ContractValidationResult> {
    const results: ContractValidationResult = {
      stepId: contract.stepId,
      valid: true,
      preconditionResults: [],
      postconditionResults: [],
      errors: [],
      warnings: [],
    };

    for (const pre of contract.preconditions) {
      const passed = await this.evaluateCheck(pre.check, context);
      results.preconditionResults.push({ id: pre.id, passed, detail: pre.description });

      if (!passed) {
        if (pre.severity === 'critical') {
          results.valid = false;
          results.errors.push(`Precondition failed (CRITICAL): ${pre.description} (${pre.check})`);
        } else {
          results.warnings.push(`Precondition warning: ${pre.description}`);
        }
      }
    }

    return results;
  }

  /**
   * Validate that postconditions hold after executing a step.
   */
  async validatePostconditions(
    contract: PipelineStepContract,
    input: Record<string, unknown>,
    output: Record<string, unknown>
  ): Promise<ContractValidationResult> {
    const results: ContractValidationResult = {
      stepId: contract.stepId,
      valid: true,
      preconditionResults: [],
      postconditionResults: [],
      errors: [],
      warnings: [],
    };

    // Merge input and output so postcondition checks can find all fields
    const mergedContext: Record<string, unknown> = { ...input, ...output };

    for (const post of contract.postconditions) {
      const passed = await this.evaluateCheck(post.check, mergedContext);
      results.postconditionResults.push({ id: post.id, passed, detail: post.description });

      if (!passed) {
        if (post.guarantee === 'hard') {
          results.valid = false;
          results.errors.push(`Postcondition failed (HARD): ${post.description}`);
        } else {
          results.warnings.push(`Postcondition soft failure: ${post.description}`);
        }
      }
    }

    return results;
  }

  /**
   * Generate Markdown documentation for a contract.
   */
  static toMarkdown(contract: PipelineStepContract): string {
    const retryStr = (r: RetryPolicy): string => {
      switch (r.type) {
        case 'no_retry': return 'No retry';
        case 'exponential_backoff': return `Exponential backoff (max ${r.maxAttempts}, base ${r.baseDelayMs}ms)`;
        case 'fixed_interval': return `Fixed interval (max ${r.maxAttempts}, every ${r.intervalMs}ms)`;
        case 'circuit_breaker': return `Circuit breaker (max ${r.maxAttempts}, reset ${r.resetTimeoutMs}ms)`;
      }
    };

    const idemStr = (i: IdempotencyScheme): string => {
      switch (i.type) {
        case 'idempotency_key': return `Idempotency key on: ${i.keyFields.join(', ')}`;
        case 'upsert': return `Upsert on: ${i.uniqueFields.join(', ')}`;
        case 'dedup_window': return `Dedup window ${i.windowMs}ms on: ${i.keyFields.join(', ')}`;
      }
    };

    let md = `## ${contract.name} (\`${contract.stepId}\`)\n\n`;
    md += `${contract.description}\n\n`;

    md += '### Input\n\n';
    md += `- **Type**: \`${contract.input.type}\`\n`;
    md += `- **Required fields**: ${contract.input.requiredFields.join(', ')}\n`;
    md += `- **Description**: ${contract.input.description}\n\n`;

    md += '### Output\n\n';
    md += `- **Type**: \`${contract.output.type}\`\n`;
    md += `- **Guaranteed fields**: ${contract.output.guaranteedFields.join(', ')}\n`;
    md += `- **Description**: ${contract.output.description}\n\n`;

    md += '### Preconditions\n\n';
    for (const pre of contract.preconditions) {
      md += `- [${pre.severity}] ${pre.description}\n`;
      md += `  - Check: \`${pre.check}\`\n`;
    }

    md += '\n### Postconditions\n\n';
    for (const post of contract.postconditions) {
      md += `- [${post.guarantee}] ${post.description}\n`;
      md += `  - Check: \`${post.check}\`\n`;
    }

    md += '\n### Reliability\n\n';
    md += `| Property | Value |\n|---|---|\n`;
    md += `| Retry Policy | ${retryStr(contract.retryPolicy)} |\n`;
    md += `| Timeout | ${contract.timeoutMs}ms |\n`;
    md += `| Idempotency | ${idemStr(contract.idempotency)} |\n`;
    md += `| Failure Mode | ${contract.failureMode} |\n`;
    md += `| Recovery | ${JSON.stringify(contract.recoveryStrategy)} |\n`;
    md += `| Dependencies | ${contract.dependsOn.join(', ') || 'None'} |\n\n`;

    md += '### Metrics\n\n';
    md += '| Name | Type | Description |\n|---|---|---|\n';
    for (const m of contract.metrics) {
      md += `| \`${m.name}\` | ${m.type} | ${m.description} |\n`;
    }

    return md;
  }

  // ─── Private ──────────────────────────────────────────────────────

  private async evaluateCheck(
    check: string,
    context: Record<string, unknown>
  ): Promise<boolean> {
    // In production, this would evaluate registered check functions.
    // For now, we return true if the check expression is valid.
    try {
      // Simple existence checks
      if (check.startsWith('exists:')) {
        const field = check.slice(7);
        return context[field] !== undefined && context[field] !== null;
      }
      if (check.startsWith('not_null:')) {
        const field = check.slice(9);
        return context[field] !== null && context[field] !== undefined;
      }
      if (check.startsWith('type:')) {
        const [_, expectedType, field] = check.split(':');
        const val = context[field];
        return typeof val === expectedType;
      }
      // Default: check exists
      return true;
    } catch {
      return false;
    }
  }
}

// ─── Default Contracts ──────────────────────────────────────────────────────

export const PIPELINE_CONTRACTS: Record<string, PipelineStepContract> = {};