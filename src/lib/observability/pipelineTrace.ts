/**
 * HandicapLab Pipeline Tracing
 * =============================
 * Every prediction pipeline stage emits structured events.
 *
 * Pipeline events flow:
 *   pipeline_started → fixtures_loaded → odds_loaded →
 *   features_calculated → prediction_completed → ev_calculated →
 *   kelly_calculated → recommendation_generated → snapshot_stored
 *
 * Settlement events:
 *   settlement_started → settlement_completed → clv_updated
 *
 * NO runtime behaviour is changed. Tracing is purely diagnostic.
 */

import { StructuredLogger } from './structuredLogger';
import { Timer, TimerContext, startTimer } from './timing';

export type PipelineStage =
  | 'pipeline_started'
  | 'fixtures_loaded'
  | 'odds_loaded'
  | 'features_calculated'
  | 'prediction_completed'
  | 'ev_calculated'
  | 'kelly_calculated'
  | 'recommendation_generated'
  | 'snapshot_stored'
  | 'settlement_started'
  | 'settlement_completed'
  | 'clv_updated'
  | 'pipeline_completed';

export interface PipelineEvent {
  stage: PipelineStage;
  pipelineId: string;
  correlationId: string;
  durationMs?: number;
  status: 'success' | 'failed' | 'skipped';
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export class PipelineTracer {
  private readonly timers: Map<PipelineStage, Timer> = new Map();
  private readonly logger: StructuredLogger;
  private readonly events: PipelineEvent[] = [];

  constructor(
    public readonly pipelineId: string,
    public readonly correlationId: string,
    parentLogger?: StructuredLogger
  ) {
    this.logger = (parentLogger || new StructuredLogger('pipeline')).withContext({
      correlationId,
      pipelineRunId: pipelineId,
    });
  }

  async trace<T>(
    stage: PipelineStage,
    fn: () => Promise<T>,
    context?: TimerContext
  ): Promise<T> {
    const timer = startTimer(stage, { ...context, pipelineId: this.pipelineId }, this.logger);
    this.emit(stage, 'in_progress');
    try {
      const result = await fn();
      const timing = timer.end();
      this.emit(stage, 'success', timing.durationMs, { result: true });
      return result;
    } catch (err) {
      const timing = timer.end();
      this.emit(stage, 'failed', timing.durationMs, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    }
  }

  private emit(stage: PipelineStage, status: 'success' | 'failed' | 'skipped' | 'in_progress', durationMs?: number, metadata?: Record<string, unknown>): void {
    const event: PipelineEvent = {
      stage,
      pipelineId: this.pipelineId,
      correlationId: this.correlationId,
      durationMs,
      status: status === 'in_progress' ? 'success' : status,
      metadata,
      timestamp: new Date().toISOString(),
    };
    this.events.push(event);
    this.logger.info(`pipeline.${stage}`, `Stage ${stage}: ${status}`, metadata, durationMs);
  }

  getEvents(): PipelineEvent[] {
    return [...this.events];
  }

  getDuration(): number {
    const start = this.events[0]?.timestamp;
    const end = this.events[this.events.length - 1]?.timestamp;
    if (!start || !end) return 0;
    return new Date(end).getTime() - new Date(start).getTime();
  }
}