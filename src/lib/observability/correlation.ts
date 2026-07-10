/**
 * HandicapLab Request Correlation
 * ================================
 * Every request generates or propagates:
 *   - Request ID
 *   - Correlation ID
 *   - Execution ID
 * Nested services inherit IDs from parent contexts.
 *
 * NO runtime behaviour is changed. Correlation is purely diagnostic.
 */

import crypto from 'crypto';

export interface CorrelationIds {
  requestId: string;
  correlationId: string;
  executionId: string;
  pipelineRunId?: string;
  cronRunId?: string;
}

// Async local storage for correlation context
// Using a simple Map-based approach for compatibility
const correlationStorage = new Map<string, CorrelationIds>();
const STORAGE_KEY = 'current_correlation';

export function generateId(): string {
  return crypto.randomUUID();
}

export function createCorrelationIds(overrides?: Partial<CorrelationIds>): CorrelationIds {
  return {
    requestId: overrides?.requestId || generateId(),
    correlationId: overrides?.correlationId || generateId(),
    executionId: overrides?.executionId || generateId(),
    pipelineRunId: overrides?.pipelineRunId,
    cronRunId: overrides?.cronRunId,
  };
}

/**
 * Set the current correlation IDs for this execution context.
 */
export function setCorrelationIds(ids: CorrelationIds): void {
  correlationStorage.set(STORAGE_KEY, ids);
}

/**
 * Get the current correlation IDs.
 * Returns default generated IDs if none are set.
 */
export function getCorrelationIds(): CorrelationIds {
  const stored = correlationStorage.get(STORAGE_KEY);
  if (stored) return stored;
  const ids = createCorrelationIds();
  correlationStorage.set(STORAGE_KEY, ids);
  return ids;
}

/**
 * Clear the current correlation context (for testing).
 */
export function clearCorrelationIds(): void {
  correlationStorage.delete(STORAGE_KEY);
}

/**
 * Create a child correlation context.
 * Inherits parent IDs but generates a new executionId.
 */
export function createChildCorrelationIds(parent: CorrelationIds): CorrelationIds {
  return {
    requestId: parent.requestId,
    correlationId: parent.correlationId,
    executionId: generateId(),
    pipelineRunId: parent.pipelineRunId,
    cronRunId: parent.cronRunId,
  };
}

/**
 * Create a pipeline-run scoped correlation context.
 */
export function createPipelineCorrelationIds(parent: CorrelationIds, pipelineRunId: string): CorrelationIds {
  const ids = createChildCorrelationIds(parent);
  ids.pipelineRunId = pipelineRunId;
  return ids;
}

/**
 * Create a cron-run scoped correlation context.
 */
export function createCronCorrelationIds(cronName: string): CorrelationIds {
  const ids = createCorrelationIds();
  ids.cronRunId = `${cronName}_${Date.now()}`;
  return ids;
}