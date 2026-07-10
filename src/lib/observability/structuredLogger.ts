/**
 * HandicapLab Unified Structured Logger
 * =======================================
 * Production-grade structured logging.
 *
 * Every log entry is a JSON object with:
 *   - timestamp (ISO 8601)
 *   - level (severity)
 *   - correlation identifiers
 *   - component / event context
 *   - structured metadata
 *
 * NO runtime behaviour is changed by this module.
 * It ONLY provides logging infrastructure.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogContext {
  executionId?: string;
  correlationId?: string;
  pipelineRunId?: string;
  requestId?: string;
  cronRunId?: string;
  predictionId?: string;
  matchId?: string;
  fixtureId?: string;
  leagueId?: string;
  market?: string;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  component: string;
  event: string;
  duration?: number;
  environment: string;
  context: LogContext;
  metadata?: Record<string, unknown>;
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
}

const ENV = process.env.NODE_ENV || 'development';

function createLogEntry(
  level: LogLevel,
  component: string,
  event: string,
  message: string,
  context: LogContext,
  metadata?: Record<string, unknown>,
  error?: Error | null,
  duration?: number
): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level,
    message,
    component,
    event,
    duration,
    environment: ENV,
    context,
    metadata,
    ...(error ? {
      error: {
        name: error.name,
        message: error.message,
        stack: ENV !== 'production' ? error.stack : undefined,
        code: (error as any).code,
      },
    } : {}),
  };
}

function writeEntry(entry: LogEntry): void {
  const formatted = JSON.stringify(entry);
  switch (entry.level) {
    case 'error':
    case 'fatal':
      console.error(formatted);
      break;
    case 'warn':
      console.warn(formatted);
      break;
    default:
      console.log(formatted);
  }
}

export class StructuredLogger {
  constructor(
    private readonly component: string,
    private readonly defaultContext: LogContext = {}
  ) {}

  child(subComponent: string, extraContext?: LogContext): StructuredLogger {
    return new StructuredLogger(
      `${this.component}:${subComponent}`,
      { ...this.defaultContext, ...extraContext }
    );
  }

  debug(event: string, message: string, metadata?: Record<string, unknown>, duration?: number): void {
    writeEntry(createLogEntry('debug', this.component, event, message, this.defaultContext, metadata, null, duration));
  }

  info(event: string, message: string, metadata?: Record<string, unknown>, duration?: number): void {
    writeEntry(createLogEntry('info', this.component, event, message, this.defaultContext, metadata, null, duration));
  }

  warn(event: string, message: string, metadata?: Record<string, unknown>): void {
    writeEntry(createLogEntry('warn', this.component, event, message, this.defaultContext, metadata, null));
  }

  warnWithError(event: string, message: string, error: Error | null, metadata?: Record<string, unknown>): void {
    writeEntry(createLogEntry('warn', this.component, event, message, this.defaultContext, metadata, error));
  }

  error(event: string, message: string, error?: Error | null, metadata?: Record<string, unknown>): void {
    writeEntry(createLogEntry('error', this.component, event, message, this.defaultContext, metadata, error));
  }

  fatal(event: string, message: string, error?: Error | null, metadata?: Record<string, unknown>): void {
    writeEntry(createLogEntry('fatal', this.component, event, message, this.defaultContext, metadata, error));
  }

  withContext(extraContext: LogContext): StructuredLogger {
    return new StructuredLogger(this.component, { ...this.defaultContext, ...extraContext });
  }
}

let rootLogger: StructuredLogger;

export function getLogger(): StructuredLogger {
  if (!rootLogger) {
    rootLogger = new StructuredLogger('app');
  }
  return rootLogger;
}

export function resetLogger(): void {
  rootLogger = new StructuredLogger('app');
}