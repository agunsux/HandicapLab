/**
 * HandicapLab Domain-Driven Design — Domain Event Infrastructure
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly aggregateType: string;
  readonly timestamp: string;
  readonly version: number;
  readonly payload: Record<string, unknown>;
}

export const EVENT_TYPES = {
  FIXTURE_CREATED: 'fixture.created',
  FIXTURE_UPDATED: 'fixture.updated',
  ODDS_CAPTURED: 'odds.captured',
  PREDICTION_GENERATED: 'prediction.generated',
  CALIBRATION_COMPLETED: 'calibration.completed',
  DECISION_APPROVED: 'decision.approved',
  STAKE_CALCULATED: 'stake.calculated',
  RESULT_COLLECTED: 'result.collected',
  REPLAY_COMPLETED: 'replay.completed',
  RESEARCH_FINISHED: 'research.finished',
  DRIFT_DETECTED: 'drift.detected',
  CHAMPION_VALIDATED: 'champion.validated',
  REPORT_GENERATED: 'report.generated',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
