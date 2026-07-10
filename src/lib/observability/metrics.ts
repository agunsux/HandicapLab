/**
 * HandicapLab Runtime Metrics Registry
 * =====================================
 * Lightweight in-process metrics counter.
 *
 * Tracks:
 *   - API requests (total, by endpoint, by status)
 *   - Predictions (total, by market, by league)
 *   - Settlements (total, by status)
 *   - Cron executions (total, by name, by status)
 *   - Latency (min, max, avg, p50, p95, p99)
 *   - Database queries (total, by table, errors)
 *   - External API calls (total, by provider, errors)
 *
 * NO runtime behaviour is changed. Metrics are purely diagnostic.
 */

export type MetricType = 'counter' | 'gauge' | 'histogram';

export interface MetricDefinition {
  name: string;
  type: MetricType;
  description: string;
  labels?: string[];
}

export interface MetricValue {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

class MetricsRegistry {
  private counters: Map<string, number> = new Map();
  private histograms: Map<string, number[]> = new Map();
  private gauges: Map<string, number> = new Map();

  private key(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  increment(name: string, labels: Record<string, string> = {}, value: number = 1): void {
    const k = this.key(name, labels);
    this.counters.set(k, (this.counters.get(k) || 0) + value);
  }

  gauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const k = this.key(name, labels);
    this.gauges.set(k, value);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const k = this.key(name, labels);
    if (!this.histograms.has(k)) {
      this.histograms.set(k, []);
    }
    this.histograms.get(k)!.push(value);
  }

  getCounter(name: string, labels: Record<string, string> = {}): number {
    return this.counters.get(this.key(name, labels)) || 0;
  }

  getGauge(name: string, labels: Record<string, string> = {}): number | undefined {
    return this.gauges.get(this.key(name, labels));
  }

  getHistogram(name: string, labels: Record<string, string> = {}): { count: number; min: number; max: number; avg: number; p50: number; p95: number; p99: number } | null {
    const values = this.histograms.get(this.key(name, labels));
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }

  reset(): void {
    this.counters.clear();
    this.histograms.clear();
    this.gauges.clear();
  }

  snapshot(): {
    counters: Array<{ name: string; value: number }>;
    gauges: Array<{ name: string; value: number }>;
    histograms: Array<{ name: string; stats: ReturnType<MetricsRegistry['getHistogram']> }>;
  } {
    return {
      counters: Array.from(this.counters.entries()).map(([name, value]) => ({ name, value })),
      gauges: Array.from(this.gauges.entries()).map(([name, value]) => ({ name, value })),
      histograms: Array.from(this.histograms.keys()).map((name) => ({
        name,
        stats: this.getHistogramFromKey(name),
      })),
    };
  }

  private getHistogramFromKey(key: string): ReturnType<MetricsRegistry['getHistogram']> {
    const values = this.histograms.get(key);
    if (!values || values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const sum = sorted.reduce((a, b) => a + b, 0);
    return {
      count: sorted.length,
      min: sorted[0],
      max: sorted[sorted.length - 1],
      avg: sum / sorted.length,
      p50: sorted[Math.floor(sorted.length * 0.5)],
      p95: sorted[Math.floor(sorted.length * 0.95)],
      p99: sorted[Math.floor(sorted.length * 0.99)],
    };
  }
}

export const metrics = new MetricsRegistry();

// ─── Standard Metric Names ─────────────────────────────────────────────────

export const Metrics = {
  // API
  API_REQUESTS_TOTAL: 'api_requests_total',
  API_REQUESTS_DURATION: 'api_requests_duration_ms',
  API_ERRORS_TOTAL: 'api_errors_total',

  // Predictions
  PREDICTIONS_TOTAL: 'predictions_total',
  PREDICTIONS_DURATION: 'predictions_duration_ms',
  PREDICTIONS_ERRORS: 'predictions_errors_total',

  // Settlements
  SETTLEMENTS_TOTAL: 'settlements_total',
  SETTLEMENTS_DURATION: 'settlements_duration_ms',
  SETTLEMENTS_ERRORS: 'settlements_errors_total',

  // Cron
  CRON_EXECUTIONS_TOTAL: 'cron_executions_total',
  CRON_EXECUTIONS_DURATION: 'cron_executions_duration_ms',
  CRON_FAILURES_TOTAL: 'cron_failures_total',

  // Database
  DB_QUERIES_TOTAL: 'db_queries_total',
  DB_QUERIES_DURATION: 'db_queries_duration_ms',
  DB_ERRORS_TOTAL: 'db_errors_total',

  // External APIs
  EXTERNAL_API_CALLS_TOTAL: 'external_api_calls_total',
  EXTERNAL_API_DURATION: 'external_api_duration_ms',
  EXTERNAL_API_ERRORS: 'external_api_errors_total',

  // Pipeline
  PIPELINE_STAGES_TOTAL: 'pipeline_stages_total',
  PIPELINE_STAGE_DURATION: 'pipeline_stage_duration_ms',
  PIPELINE_ERRORS: 'pipeline_errors_total',

  // CLV
  CLV_PROCESSED_TOTAL: 'clv_processed_total',
  CLV_DURATION: 'clv_duration_ms',
  CLV_ERRORS: 'clv_errors_total',
} as const;