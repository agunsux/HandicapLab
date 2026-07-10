/**
 * HandicapLab Runtime Timing
 * ===========================
 * Automatic timing helpers for measuring operation duration.
 *
 * Usage:
 *   const timer = startTimer('prediction_generate', { matchId: '123' });
 *   // ... do work ...
 *   timer.end();
 *
 * NO runtime behaviour is changed. Timing is purely diagnostic.
 */

import { StructuredLogger } from './structuredLogger';

export interface TimerContext {
  component?: string;
  operation?: string;
  matchId?: string;
  fixtureId?: string;
  leagueId?: string;
  market?: string;
  predictionId?: string;
  [key: string]: unknown;
}

export interface TimerResult {
  operation: string;
  durationMs: number;
  context: TimerContext;
  startedAt: string;
}

export class Timer {
  private readonly startedAt: Date;
  private ended = false;

  constructor(
    private readonly operation: string,
    private readonly context: TimerContext = {},
    private readonly logger?: StructuredLogger
  ) {
    this.startedAt = new Date();
  }

  end(metadata?: Record<string, unknown>): TimerResult {
    if (this.ended) {
      return { operation: this.operation, durationMs: 0, context: this.context, startedAt: this.startedAt.toISOString() };
    }
    this.ended = true;
    const durationMs = Date.now() - this.startedAt.getTime();
    const result: TimerResult = {
      operation: this.operation,
      durationMs,
      context: this.context,
      startedAt: this.startedAt.toISOString(),
    };
    if (this.logger) {
      this.logger.info(`timer.${this.operation}`, `Completed in ${durationMs}ms`, metadata, durationMs);
    }
    return result;
  }

  get elapsedMs(): number {
    return Date.now() - this.startedAt.getTime();
  }
}

export function startTimer(operation: string, context?: TimerContext, logger?: StructuredLogger): Timer {
  return new Timer(operation, context, logger);
}

/**
 * Wraps an async function with automatic timing.
 */
export async function timed<T>(
  operation: string,
  fn: () => Promise<T>,
  context?: TimerContext,
  logger?: StructuredLogger
): Promise<{ result: T; durationMs: number }> {
  const timer = startTimer(operation, context, logger);
  try {
    const result = await fn();
    const timing = timer.end();
    return { result, durationMs: timing.durationMs };
  } catch (err) {
    timer.end({ error: err instanceof Error ? err.message : String(err) });
    throw err;
  }
}