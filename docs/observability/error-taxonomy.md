# HandicapLab Error Taxonomy

## Error Hierarchy

```
AppError (base)
├── ValidationError      — Invalid input (code: VALIDATION_ERROR)
├── PredictionError      — Prediction failure (code: PREDICTION_FAILED)
├── SettlementError      — Settlement failure (code: SETTLEMENT_FAILED)
├── DatabaseError        — Database operation failure (code: DATABASE_ERROR)
├── PipelineError        — Pipeline stage failure (code: PIPELINE_ERROR)
├── ExternalAPIError     — External API failure (code: EXTERNAL_API_ERROR)
├── ConfigurationError   — Configuration issue (code: CONFIGURATION_ERROR)
├── TimeoutError         — Operation timeout (code: TIMEOUT_ERROR)
└── RateLimitError       — Rate limit exceeded (code: RATE_LIMIT_ERROR)
```

## Common Properties

| Property | Type | Description |
|---|---|---|
| `code` | string | Machine-readable identifier |
| `severity` | 'low' \| 'medium' \| 'high' \| 'critical' | Impact level |
| `retryable` | boolean | Can the operation be retried? |
| `userSafeMessage` | string | End-user visible message |
| `internalMessage` | string | Debugging context |
| `context` | object | Structured metadata |
| `timestamp` | string | ISO 8601 |

## When to Use Each Type

| Error Type | When to Throw |
|---|---|
| `ValidationError` | User input validation fails |
| `PredictionError` | Engine cannot generate prediction |
| `SettlementError` | Settlement processing fails |
| `DatabaseError` | Supabase query fails |
| `PipelineError` | Pipeline stage crashes |
| `ExternalAPIError` | API-Football/Odds API returns error |
| `ConfigurationError` | Missing env var or invalid config |
| `TimeoutError` | Async operation exceeds timeout |
| `RateLimitError` | External API rate limit exceeded |