/**
 * HandicapLab Diagnostics Framework
 * ==================================
 * Diagnostic helpers for detecting system health issues.
 *
 * Supports:
 *   - Slow query detection
 *   - Slow prediction detection
 *   - Cache hit rate
 *   - External API latency
 *   - Database retry count
 *
 * NO runtime behaviour is changed. Diagnostics are purely informational.
 */

import { StructuredLogger } from './structuredLogger';

const SLOW_QUERY_THRESHOLD_MS = 1000;    // 1 second
const SLOW_PREDICTION_THRESHOLD_MS = 5000; // 5 seconds
const SLOW_API_THRESHOLD_MS = 3000;        // 3 seconds

export interface DiagnosticReport {
  timestamp: string;
  slowQueries: Array<{ query: string; durationMs: number; table?: string }>;
  slowPredictions: Array<{ matchId?: string; durationMs: number; market?: string }>;
  slowApis: Array<{ provider: string; durationMs: number; endpoint: string }>;
  databaseRetries: number;
  warnings: string[];
}

export class DiagnosticsCollector {
  private slowQueries: Array<{ query: string; durationMs: number; table?: string }> = [];
  private slowPredictions: Array<{ matchId?: string; durationMs: number; market?: string }> = [];
  private slowApis: Array<{ provider: string; durationMs: number; endpoint: string }> = [];
  private dbRetryCount = 0;

  private readonly logger = new StructuredLogger('diagnostics');

  recordQuery(query: string, durationMs: number, table?: string): void {
    if (durationMs > SLOW_QUERY_THRESHOLD_MS) {
      this.slowQueries.push({ query: query.substring(0, 100), durationMs, table });
      this.logger.warn('diagnostics.slow_query', `Slow query (${durationMs}ms): ${query.substring(0, 80)}`);
    }
  }

  recordPrediction(durationMs: number, matchId?: string, market?: string): void {
    if (durationMs > SLOW_PREDICTION_THRESHOLD_MS) {
      this.slowPredictions.push({ matchId, durationMs, market });
      this.logger.warn('diagnostics.slow_prediction', `Slow prediction (${durationMs}ms)`);
    }
  }

  recordApiCall(provider: string, endpoint: string, durationMs: number): void {
    if (durationMs > SLOW_API_THRESHOLD_MS) {
      this.slowApis.push({ provider, durationMs, endpoint });
      this.logger.warn('diagnostics.slow_api', `Slow API (${durationMs}ms): ${provider}/${endpoint}`);
    }
  }

  incrementDbRetry(): void {
    this.dbRetryCount++;
  }

  generateReport(): DiagnosticReport {
    return {
      timestamp: new Date().toISOString(),
      slowQueries: [...this.slowQueries],
      slowPredictions: [...this.slowPredictions],
      slowApis: [...this.slowApis],
      databaseRetries: this.dbRetryCount,
      warnings: this.buildWarnings(),
    };
  }

  private buildWarnings(): string[] {
    const warnings: string[] = [];
    if (this.slowQueries.length > 10) {
      warnings.push(`High number of slow queries: ${this.slowQueries.length}`);
    }
    if (this.slowPredictions.length > 5) {
      warnings.push(`High number of slow predictions: ${this.slowPredictions.length}`);
    }
    if (this.slowApis.length > 10) {
      warnings.push(`High number of slow API calls: ${this.slowApis.length}`);
    }
    if (this.dbRetryCount > 20) {
      warnings.push(`Excessive database retries: ${this.dbRetryCount}`);
    }
    return warnings;
  }

  reset(): void {
    this.slowQueries = [];
    this.slowPredictions = [];
    this.slowApis = [];
    this.dbRetryCount = 0;
  }
}

export const diagnostics = new DiagnosticsCollector();