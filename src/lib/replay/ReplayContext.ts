/**
 * HandicapLab Replay Context
 * ============================
 * Execution context for a single replay run.
 * Every replay generates a unique context with tracing IDs.
 */

import crypto from 'crypto';
import { ReplayContext as IReplayContext } from './types';

export function createReplayContext(overrides?: Partial<IReplayContext>): IReplayContext {
  const executionId = crypto.randomUUID();
  return {
    executionId,
    correlationId: executionId,
    provider: overrides?.provider || 'unknown',
    leagueId: overrides?.leagueId,
    season: overrides?.season,
    startDate: overrides?.startDate,
    endDate: overrides?.endDate,
  };
}