# HandicapLab Logging Standard

## Structured Logger Format

Every log entry is a JSON object:

```json
{
  "timestamp": "2026-07-10T08:30:00.000Z",
  "level": "info",
  "message": "Prediction completed in 142ms",
  "component": "prediction-engine",
  "event": "prediction_completed",
  "duration": 142,
  "environment": "production",
  "context": {
    "executionId": "uuid-...",
    "correlationId": "uuid-...",
    "pipelineRunId": "uuid-...",
    "matchId": "12345",
    "leagueId": "39"
  },
  "metadata": { "market": "ML", "probability": 0.65 }
}
```

## Log Levels

| Level | Usage |
|---|---|
| `debug` | Development-only diagnostics |
| `info` | Normal operation events |
| `warn` | Degraded state, non-critical failures |
| `error` | Operation failures requiring investigation |
| `fatal` | System-crippling failures |

## Correlation IDs

Every log entry includes correlation context:

- **executionId**: Unique per operation invocation
- **correlationId**: Shared across related operations
- **pipelineRunId**: Pipeline execution scope
- **cronRunId**: Cron job execution scope
- **matchId/fixtureId**: Domain-specific identifiers

## Error Format

Errors are structured with code, severity, and context:

```json
{
  "error": {
    "name": "PredictionError",
    "message": "Feature vector incomplete",
    "code": "PREDICTION_FAILED",
    "stack": "Error: ... (non-production only)"
  }
}