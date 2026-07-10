/**
 * HandicapLab Domain Events
 * =================================
 * Strongly-typed event system for all registry operations.
 *
 * Every state transition, creation, and mutation in the registry
 * produces a RegistryEvent that can be logged, streamed, or replayed.
 */

export type RegistryEventType =
  | 'ExperimentCreated' | 'ExperimentStarted' | 'ExperimentCompleted' | 'ExperimentFailed'
  | 'ModelRegistered' | 'ModelPromoted' | 'ChampionChanged'
  | 'FeatureRegistered' | 'FeatureDeprecated'
  | 'BenchmarkCompleted' | 'ValidationCompleted' | 'ReplayCompleted'
  | 'ExecutionStarted' | 'ExecutionCompleted' | 'ExecutionFailed';

export interface RegistryEvent {
  id: string;
  type: RegistryEventType;
  entityId: string;
  entityType: string;
  timestamp: string;
  metadata: Record<string, unknown>;
  previousStatus?: string;
  newStatus?: string;
}

/**
 * Create a new domain event with auto-generated ID and timestamp.
 */
export function createEvent(
  type: RegistryEventType,
  entityId: string,
  entityType: string,
  metadata: Record<string, unknown> = {}
): RegistryEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    type,
    entityId,
    entityType,
    timestamp: new Date().toISOString(),
    metadata,
  };
}

/**
 * Create a status transition event that records both the previous
 * and new status values.
 */
export function createStatusEvent(
  type: RegistryEventType,
  entityId: string,
  entityType: string,
  previousStatus: string,
  newStatus: string,
  metadata: Record<string, unknown> = {}
): RegistryEvent {
  return {
    ...createEvent(type, entityId, entityType, metadata),
    previousStatus,
    newStatus,
  };
}
