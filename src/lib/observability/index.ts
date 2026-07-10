/**
 * HandicapLab Observability Module
 * =================================
 * Central barrel export for all observability infrastructure.
 *
 * Exports:
 *   - StructuredLogger    → production-grade JSON logging
 *   - Correlation IDs     → request tracing
 *   - Timing / Timer      → operation duration measurement
 *   - Error Taxonomy      → typed error hierarchy
 *   - Metrics Registry    → lightweight counter/histogram/gauge
 *   - Health Registry     → subsystem health checks
 *   - Pipeline Tracer     → pipeline stage tracing
 *   - Audit Log           → immutable audit trail
 *   - Diagnostics         → slow operation detection
 */

export { StructuredLogger, getLogger, resetLogger } from './structuredLogger';
export type { LogLevel, LogContext, LogEntry } from './structuredLogger';

export { createCorrelationIds, setCorrelationIds, getCorrelationIds, clearCorrelationIds, createChildCorrelationIds, createPipelineCorrelationIds, createCronCorrelationIds, generateId } from './correlation';
export type { CorrelationIds } from './correlation';

export { startTimer, timed } from './timing';
export type { TimerContext, TimerResult } from './timing';
export { Timer } from './timing';

export { AppError, ValidationError, PredictionError, SettlementError, DatabaseError, PipelineError, ExternalAPIError, ConfigurationError, TimeoutError, RateLimitError } from './errors';
export type { ErrorSeverity, ErrorContext } from './errors';

export { metrics, Metrics } from './metrics';
export type { MetricType, MetricDefinition, MetricValue } from './metrics';

export { healthRegistry } from './health';
export type { HealthStatus, HealthCheckResult, HealthCheckFn } from './health';

export { PipelineTracer } from './pipelineTrace';
export type { PipelineStage, PipelineEvent } from './pipelineTrace';

export { audit, Audit } from './auditLog';
export type { AuditAction, AuditEntry } from './auditLog';

export { diagnostics, DiagnosticsCollector } from './diagnostics';
export type { DiagnosticReport } from './diagnostics';