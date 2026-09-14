// Provider Request Audit Log
// Location: src/lib/providers/providerAuditLog.ts
//
// Structured, append-only, in-memory audit trail for provider requests. It must
// NEVER contain a credential, Authorization header, or raw response body.
// Cache/dedup decisions and quota reservations are recorded here so operators
// can answer: "how many API-Football requests did we make today, for which
// endpoint, and how many were cache hits?"
//
// Persistence to durable storage (Supabase `provider_logs`) is intentionally
// left to a sink callback so this module stays dependency-free and testable.

export type ResponseClassification =
  | 'SUCCESS'
  | 'CACHE_HIT'
  | 'DEDUPLICATED'
  | 'RATE_LIMITED'
  | 'AUTH_ERROR'
  | 'CLIENT_ERROR'
  | 'SERVER_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'QUOTA_BLOCKED'
  | 'CIRCUIT_OPEN'
  | 'UNKNOWN';

export interface ProviderAuditEntry {
  timestamp: string;
  provider: string;
  endpoint: string;
  method: string;
  /** Secret-free FNV-1a fingerprint of the canonical request. */
  fingerprint: string;
  statusCode: number | null;
  latencyMs: number;
  cacheHit: boolean;
  deduplicated: boolean;
  retryCount: number;
  quotaReservationId: string | null;
  responseClassification: ResponseClassification;
  errorClass: string | null;
}

export interface ProviderAuditSummary {
  total: number;
  cacheHits: number;
  deduplicated: number;
  providerRequests: number;
  errors: number;
  cacheHitRate: number;
  byEndpoint: Record<string, number>;
  byClassification: Record<string, number>;
}

export function classifyHttpStatus(status: number | null): ResponseClassification {
  if (status === null) return 'NETWORK_ERROR';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 401 || status === 403) return 'AUTH_ERROR';
  if (status >= 500) return 'SERVER_ERROR';
  if (status >= 400) return 'CLIENT_ERROR';
  return 'SUCCESS';
}

export class ProviderAuditLog {
  private readonly maxEntries: number;
  private entries: ProviderAuditEntry[] = [];
  private sinks: Array<(entry: ProviderAuditEntry) => void> = [];

  constructor(maxEntries = 2000) {
    this.maxEntries = maxEntries;
  }

  /** Register a durable sink (e.g. Supabase provider_logs writer). Best-effort. */
  addSink(sink: (entry: ProviderAuditEntry) => void): void {
    this.sinks.push(sink);
  }

  record(entry: ProviderAuditEntry): void {
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.splice(0, this.entries.length - this.maxEntries);
    }
    if (process.env.PROVIDER_AUDIT_STDOUT === '1') {
      // Structured single-line event. No secrets are present in this object.
      console.info('[provider-audit]', JSON.stringify(entry));
    }
    for (const sink of this.sinks) {
      try {
        sink(entry);
      } catch {
        // Audit sinks must never break the request path.
      }
    }
  }

  getEntries(since?: Date): ProviderAuditEntry[] {
    if (!since) return [...this.entries];
    return this.entries.filter((e) => new Date(e.timestamp).getTime() >= since.getTime());
  }

  getSummary(since?: Date): ProviderAuditSummary {
    const scoped = this.getEntries(since);
    const summary: ProviderAuditSummary = {
      total: scoped.length,
      cacheHits: 0,
      deduplicated: 0,
      providerRequests: 0,
      errors: 0,
      cacheHitRate: 0,
      byEndpoint: {},
      byClassification: {},
    };

    for (const e of scoped) {
      if (e.cacheHit) summary.cacheHits++;
      if (e.deduplicated) summary.deduplicated++;
      if (!e.cacheHit && !e.deduplicated) summary.providerRequests++;
      if (e.responseClassification !== 'SUCCESS' && e.responseClassification !== 'CACHE_HIT' && e.responseClassification !== 'DEDUPLICATED') {
        summary.errors++;
      }
      summary.byEndpoint[e.endpoint] = (summary.byEndpoint[e.endpoint] || 0) + 1;
      summary.byClassification[e.responseClassification] = (summary.byClassification[e.responseClassification] || 0) + 1;
    }

    summary.cacheHitRate = summary.total > 0 ? summary.cacheHits / summary.total : 0;
    return summary;
  }

  reset(): void {
    this.entries = [];
  }
}

export const providerAuditLog = new ProviderAuditLog();
