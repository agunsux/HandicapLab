export class IngestionError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ProviderUnavailableError extends IngestionError {
  constructor(provider: string, originalError?: string) {
    super(
      `Provider "${provider}" is currently unavailable. Details: ${originalError || 'None'}`,
      'PROVIDER_UNAVAILABLE'
    );
  }
}

export class RateLimitError extends IngestionError {
  constructor(provider: string, retryAfterSeconds?: number) {
    super(
      `Rate limit exceeded for provider "${provider}". Retry after ${retryAfterSeconds || 'unknown'} seconds.`,
      'RATE_LIMIT_EXCEEDED'
    );
  }
}

export class AuthenticationError extends IngestionError {
  constructor(provider: string) {
    super(`Authentication failed for provider "${provider}". Check API key configurations.`, 'AUTH_FAILED');
  }
}

export class InvalidResponseError extends IngestionError {
  constructor(provider: string, details: string) {
    super(`Invalid response structure from provider "${provider}". Details: ${details}`, 'INVALID_RESPONSE');
  }
}

export class ValidationError extends IngestionError {
  constructor(entity: string, errors: string[]) {
    super(`Validation failed for ${entity}. Errors: ${errors.join(', ')}`, 'VALIDATION_FAILED');
  }
}

export class ParsingError extends IngestionError {
  constructor(provider: string, entity: string, details: string) {
    super(`Failed to parse ${entity} from provider "${provider}". Details: ${details}`, 'PARSING_ERROR');
  }
}
