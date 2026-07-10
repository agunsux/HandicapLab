# HandicapLab Health Monitoring

## Health Registry

Every subsystem exposes a health check function.

### Registered Health Checks

| Component | Check Function | Expected |
|---|---|---|
| `database` | Supabase connectivity | healthy |
| `prediction_engine` | Engine status | healthy |
| `settlement_engine` | Settlement status | healthy |
| `closing_odds` | Capture metrics | healthy |
| `paper_trading` | Paper trading status | healthy |
| `cron` | Cron execution health | healthy |

### Health Status Values

| Status | Meaning |
|---|---|
| `healthy` | Subsystem operating normally |
| `degraded` | Subsystem partially impaired |
| `critical` | Subsystem non-functional |
| `unknown` | No health check registered |

### Usage

```typescript
import { healthRegistry } from '@/lib/observability';

// Register a health check
healthRegistry.register('database', async () => {
  const { error } = await supabase.rpc('run_sql', { sql: 'SELECT 1;' });
  return {
    status: error ? 'critical' : 'healthy',
    component: 'database',
    message: error ? error.message : 'Connected',
    lastCheck: new Date().toISOString(),
    durationMs: 0
  };
});

// Run all checks
const results = await healthRegistry.runAll();

// Get overall status
const status = healthRegistry.getOverallStatus();
// => 'healthy' | 'degraded' | 'critical' | 'unknown'