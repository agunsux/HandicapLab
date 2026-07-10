/**
 * HandicapLab Error Taxonomy
 * ===========================
 * Consistent error hierarchy for the entire application.
 *
 * Every error exposes:
 *   - code: machine-readable string (e.g. "PREDICTION_FAILED")
 *   - severity: 'low' | 'medium' | 'high' | 'critical'
 *   - retryable: boolean — can this operation be retried safely?
 *   - userSafeMessage: safe to show to end users
 *   - internalMessage: detailed context for debugging
 *   - context: structured metadata
 *
 * NO runtime behaviour is changed. Errors only provide better diagnosis.
 */

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorContext {
  component?: string;
  operation?: string;
  matchId?: string;
  fixtureId?: string;
  leagueId?: string;
  market?: string;
  predictionId?: string;
  executionId?: string;
  correlationId?: string;
  durationMs?: number;
  [key: string]: unknown;
}

export class AppError extends Error {
  public readonly code: string;
  public readonly severity: ErrorSeverity;
  public readonly retryable: boolean;
  public readonly userSafeMessage: string;
  public readonly internalMessage: string;
  public readonly context: ErrorContext;
  public readonly timestamp: string;

  constructor(
    code: string,
    severity: ErrorSeverity,
    retryable: boolean,
    userSafeMessage: string,
    internalMessage: string,
    context: ErrorContext = {},
    cause?: Error
  ) {
    super(internalMessage);
    this.name = this.constructor.name;
    this.code = code;
    this.severity = severity;
    this.retryable = retryable;
    this.userSafeMessage = userSafeMessage;
    this.internalMessage = internalMessage;
    this.context = context;
    this.timestamp = new Date().toISOString();
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      severity: this.severity,
      retryable: this.retryable,
      userSafeMessage: this.userSafeMessage,
      internalMessage: this.internalMessage,
      context: this.context,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }
}

// ─── Validation Errors ──────────────────────────────────────────────────────

export class ValidationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('VALIDATION_ERROR', 'low', false, 'Invalid input provided.', message, context);
  }
}

export class PredictionError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('PREDICTION_FAILED', 'high', true, 'Prediction could not be generated.', message, context);
  }
}

export class SettlementError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('SETTLEMENT_FAILED', 'high', true, 'Settlement could not be completed.', message, context);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('DATABASE_ERROR', 'high', false, 'A database error occurred.', message, context);
  }
}

export class PipelineError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('PIPELINE_ERROR', 'critical', true, 'A pipeline error occurred.', message, context);
  }
}

export class ExternalAPIError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('EXTERNAL_API_ERROR', 'medium', true, 'An external API error occurred.', message, context);
  }
}

export class ConfigurationError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('CONFIGURATION_ERROR', 'critical', false, 'A configuration error occurred.', message, context);
  }
}

export class TimeoutError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('TIMEOUT_ERROR', 'high', true, 'The operation timed out.', message, context);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, context: ErrorContext = {}) {
    super('RATE_LIMIT_ERROR', 'medium', true, 'Rate limit exceeded. Please retry later.', message, context);
  }
}