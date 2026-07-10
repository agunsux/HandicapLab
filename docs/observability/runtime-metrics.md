# HandicapLab Runtime Metrics

## Metrics Registry

Lightweight in-process counter, gauge, and histogram registry.

### API Metrics

| Metric | Type | Labels |
|---|---|---|
| `api_requests_total` | counter | endpoint, method, status |
| `api_requests_duration_ms` | histogram | endpoint, method |
| `api_errors_total` | counter | endpoint, error_code |

### Prediction Metrics

| Metric | Type | Labels |
|---|---|---|
| `predictions_total` | counter | market, league |
| `predictions_duration_ms` | histogram | market |
| `predictions_errors_total` | counter | market, error_code |

### Settlement Metrics

| Metric | Type | Labels |
|---|---|---|
| `settlements_total` | counter | status |
| `settlements_duration_ms` | histogram | — |
| `settlements_errors_total` | counter | error_code |

### Cron Metrics

| Metric | Type | Labels |
|---|---|---|
| `cron_executions_total` | counter | cron_name |
| `cron_executions_duration_ms` | histogram | cron_name |
| `cron_failures_total` | counter | cron_name, error_code |

### Database Metrics

| Metric | Type | Labels |
|---|---|---|
| `db_queries_total` | counter | table |
| `db_queries_duration_ms` | histogram | table |
| `db_errors_total` | counter | table, error_code |

### Pipeline Metrics

| Metric | Type | Labels |
|---|---|---|
| `pipeline_stages_total` | counter | stage |
| `pipeline_stage_duration_ms` | histogram | stage |
| `pipeline_errors_total` | counter | stage, error_code |

## Usage

```typescript
import { metrics, Metrics } from '@/lib/observability';

// Increment counter
metrics.increment(Metrics.API_REQUESTS_TOTAL, { endpoint: '/api/predictions', method: 'GET', status: '200' });

// Record histogram value
metrics.observe(Metrics.API_REQUESTS_DURATION, 142, { endpoint: '/api/predictions' });

// Set gauge
metrics.gauge('active_predictions', 42);

// Get stats
const hist = metrics.getHistogram(Metrics.PREDICTIONS_DURATION, { market: 'ML' });
// => { count, min, max, avg, p50, p95, p99 }

// Snapshot all
const snapshot = metrics.snapshot();