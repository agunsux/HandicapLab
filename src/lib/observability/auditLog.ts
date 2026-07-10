/**
 * HandicapLab Audit Logging
 * ==========================
 * Immutable audit trail for important system events.
 *
 * Tracks:
 *   - Manual admin actions
 *   - Validation queue operations
 *   - Replays
 *   - Settlements
 *   - Cron executions
 *   - Configuration changes
 *   - Health changes
 *
 * NO runtime behaviour is changed. Audit is purely diagnostic.
 */

import { StructuredLogger, LogContext } from './structuredLogger';

export type AuditAction =
  | 'admin.action'
  | 'validation.queue'
  | 'replay.started'
  | 'replay.completed'
  | 'settlement.batch'
  | 'cron.execution'
  | 'config.changed'
  | 'health.changed';

export interface AuditEntry {
  action: AuditAction;
  actor: string;
  target?: string;
  details: Record<string, unknown>;
  context?: LogContext;
  timestamp: string;
}

const logger = new StructuredLogger('audit');

export function audit(
  action: AuditAction,
  actor: string,
  details: Record<string, unknown>,
  target?: string,
  context?: LogContext
): void {
  const entry: AuditEntry = {
    action,
    actor,
    target,
    details,
    context,
    timestamp: new Date().toISOString(),
  };
  logger.info(`audit.${action.replace('.', '_')}`, `Audit: ${action} by ${actor}`, entry as unknown as Record<string, unknown>);
}

export const Audit = {
  adminAction(actor: string, action: string, details: Record<string, unknown>): void {
    audit('admin.action', actor, { ...details, adminAction: action });
  },

  cronExecution(cronName: string, status: string, durationMs: number, details?: Record<string, unknown>): void {
    audit('cron.execution', 'system', {
      cronName,
      status,
      durationMs,
      ...details,
    });
  },

  settlementBatch(count: number, status: string): void {
    audit('settlement.batch', 'system', { count, status });
  },
};