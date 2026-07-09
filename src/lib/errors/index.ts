// HandicapLab Error Hierarchy
// All domain errors inherit from HandicapError which extends Error.
// Every error carries: code, message, optional cause, optional metadata, retryable flag.

export class HandicapError extends Error {
  public readonly code: string;
  public readonly metadata?: Record<string, unknown>;
  public readonly retryable: boolean;
  public readonly cause?: Error;

  constructor(
    code: string,
    message: string,
    options?: {
      cause?: Error;
      metadata?: Record<string, unknown>;
      retryable?: boolean;
    }
  ) {
    super(message);
    this.name = 'HandicapError';
    this.code = code;
    this.metadata = options?.metadata;
    this.retryable = options?.retryable ?? false;
    this.cause = options?.cause;
  }
}

// ─── Generic Errors ──────────────────────────────────────────

export class ValidationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('VALIDATION_ERROR', message, { ...options });
    this.name = 'ValidationError';
  }
}

export class ProviderError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('PROVIDER_ERROR', message, { ...options, retryable: true });
    this.name = 'ProviderError';
  }
}

export class NetworkError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('NETWORK_ERROR', message, { ...options, retryable: true });
    this.name = 'NetworkError';
  }
}

export class ConfigurationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('CONFIGURATION_ERROR', message, { ...options });
    this.name = 'ConfigurationError';
  }
}

export class NotFoundError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('NOT_FOUND', message, { ...options });
    this.name = 'NotFoundError';
  }
}

export class ConflictError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('CONFLICT', message, { ...options });
    this.name = 'ConflictError';
  }
}

export class RateLimitError extends HandicapError {
  public readonly retryAfterMs?: number;

  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown>; retryAfterMs?: number }) {
    super('RATE_LIMIT', message, { ...options, retryable: true });
    this.name = 'RateLimitError';
    this.retryAfterMs = options?.retryAfterMs;
  }
}

export class InternalError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('INTERNAL_ERROR', message, { ...options });
    this.name = 'InternalError';
  }
}

// ─── Domain Errors ───────────────────────────────────────────

export class PredictionError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('PREDICTION_ERROR', message, { ...options });
    this.name = 'PredictionError';
  }
}

export class SettlementError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('SETTLEMENT_ERROR', message, { ...options });
    this.name = 'SettlementError';
  }
}

export class CalibrationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('CALIBRATION_ERROR', message, { ...options });
    this.name = 'CalibrationError';
  }
}

export class ResearchError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('RESEARCH_ERROR', message, { ...options });
    this.name = 'ResearchError';
  }
}

export class PaperTradeError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('PAPER_TRADE_ERROR', message, { ...options });
    this.name = 'PaperTradeError';
  }
}

export class WarehouseError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('WAREHOUSE_ERROR', message, { ...options, retryable: true });
    this.name = 'WarehouseError';
  }
}

export class ImportError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('IMPORT_ERROR', message, { ...options, retryable: true });
    this.name = 'ImportError';
  }
}

export class AuthenticationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('AUTHENTICATION_ERROR', message, { ...options });
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('AUTHORIZATION_ERROR', message, { ...options });
    this.name = 'AuthorizationError';
  }
}

export class ExternalServiceError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('EXTERNAL_SERVICE_ERROR', message, { ...options, retryable: true });
    this.name = 'ExternalServiceError';
  }
}

export class StorageError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('STORAGE_ERROR', message, { ...options, retryable: true });
    this.name = 'StorageError';
  }
}

export class OODValidationError extends HandicapError {
  constructor(message: string, options?: { cause?: Error; metadata?: Record<string, unknown> }) {
    super('OOD_VALIDATION_ERROR', message, { ...options });
    this.name = 'OODValidationError';
  }
}

// ─── Type Guard ──────────────────────────────────────────────

export function isHandicapError(error: unknown): error is HandicapError {
  return error instanceof HandicapError;
}

export function toHandicapError(error: unknown, fallbackCode = 'UNKNOWN'): HandicapError {
  if (isHandicapError(error)) return error;
  if (error instanceof Error) {
    return new InternalError(error.message, { cause: error, metadata: { code: fallbackCode } });
  }
  return new InternalError(String(error), { metadata: { code: fallbackCode } });
}