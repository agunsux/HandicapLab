// ============================================================================
// GCS DURABLE LEDGER STORAGE SERVICE
// Namespace: src/lib/pipeline/rescue/gcsLedgerStorage.ts
// ============================================================================
// Provides durable cloud persistence for rescue predictions when running
// on Google Cloud Run without requiring third-party SDK dependencies.
// ============================================================================

import fs from 'fs';
import path from 'path';
import os from 'os';

export interface CachedLedger {
  rows: any[];
  cachedAtMs: number;
  generation?: string;
  source: 'gcs' | 'local';
}

export interface LedgerValidationResult {
  valid: boolean;
  rows: any[];
  error?: string;
}

export class GcsLedgerStorage {
  private static readonly BUCKET_NAME = process.env.GCS_LEDGER_BUCKET || 'handicap-salmo-ledger';
  private static readonly OBJECT_NAME = 'rescue/rescue_prediction_ledger.jsonl';
  private static readonly CACHE_TTL_MS = 60 * 1000; // 60-second bounded TTL

  private static memoryCache: CachedLedger | null = null;

  public static clearMemoryCache(): void {
    this.memoryCache = null;
  }

  public static getCachedRows(): any[] | null {
    if (!this.memoryCache) return null;
    const now = Date.now();
    if (now - this.memoryCache.cachedAtMs > this.CACHE_TTL_MS) {
      this.memoryCache = null;
      return null;
    }
    return this.memoryCache.rows;
  }

  /**
   * Validates raw NDJSON ledger content against the canonical prediction schema.
   * Strict verification per Section 5: non-empty, parseable JSONL, required fields.
   */
  public static validateLedgerContent(rawText: string): LedgerValidationResult {
    if (!rawText || !rawText.trim()) {
      return { valid: false, rows: [], error: 'Ledger content is empty' };
    }

    const lines = rawText.trim().split('\n');
    const parsedRows: any[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      let row: any;
      try {
        row = JSON.parse(line);
      } catch (e: any) {
        return { valid: false, rows: [], error: `JSON parse error on line ${i + 1}: ${e?.message}` };
      }

      // Invariant: required prediction fields per Section 5
      if (!row.id || typeof row.id !== 'string') {
        return { valid: false, rows: [], error: `Record ${i + 1} missing valid 'id'` };
      }
      if (!row.model_version || typeof row.model_version !== 'string') {
        return { valid: false, rows: [], error: `Record ${i + 1} missing valid 'model_version'` };
      }
      if (!row.kickoff_utc || isNaN(new Date(row.kickoff_utc).getTime())) {
        return { valid: false, rows: [], error: `Record ${i + 1} missing valid 'kickoff_utc'` };
      }
      if (!row.market || typeof row.market !== 'string') {
        return { valid: false, rows: [], error: `Record ${i + 1} missing valid 'market'` };
      }
      if (row.confidence_tier === undefined) {
        return { valid: false, rows: [], error: `Record ${i + 1} missing 'confidence_tier'` };
      }
      if (!row.match && (!row.home_team || !row.away_team)) {
        return { valid: false, rows: [], error: `Record ${i + 1} missing match or team names` };
      }

      parsedRows.push(row);
    }

    if (parsedRows.length === 0) {
      return { valid: false, rows: [], error: 'Zero valid rows found in ledger' };
    }

    return { valid: true, rows: parsedRows };
  }

  public static async getGcpAccessToken(): Promise<string | null> {
    if (process.env.GCS_AUTH_TOKEN) {
      return process.env.GCS_AUTH_TOKEN;
    }

    try {
      const res = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        {
          headers: { 'Metadata-Flavor': 'Google' },
          signal: AbortSignal.timeout(1500),
        }
      );
      if (!res.ok) return null;
      const data = await res.json();
      return data.access_token || null;
    } catch {
      return null;
    }
  }

  /**
   * Directly fetches raw ledger from GCS via HTTP JSON API.
   */
  public static async fetchFromGcs(): Promise<{ rawText: string; generation?: string } | null> {
    try {
      const token = await this.getGcpAccessToken();
      if (!token) return null;

      const url = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(this.OBJECT_NAME)}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) {
        console.warn(`[GcsLedgerStorage] GCS fetch failed with HTTP ${res.status}`);
        return null;
      }

      const rawText = await res.text();
      const generation = res.headers.get('x-goog-generation') || undefined;
      return { rawText, generation };
    } catch (e: any) {
      console.warn('[GcsLedgerStorage] Error fetching ledger from GCS:', e?.message);
      return null;
    }
  }

  /**
   * Retrieves durable rescue predictions from GCS with in-memory TTL caching
   * and structural validation.
   */
  public static async getValidatedRows(options?: { forceRefresh?: boolean }): Promise<any[] | null> {
    if (!options?.forceRefresh) {
      const cached = this.getCachedRows();
      if (cached) return cached;
    }

    const fetched = await this.fetchFromGcs();
    if (!fetched || !fetched.rawText) {
      return null;
    }

    const validation = this.validateLedgerContent(fetched.rawText);
    if (!validation.valid) {
      console.warn('[GcsLedgerStorage] GCS ledger validation failed:', validation.error);
      return null;
    }

    this.memoryCache = {
      rows: validation.rows,
      cachedAtMs: Date.now(),
      generation: fetched.generation,
      source: 'gcs',
    };

    // Mirror to /tmp to seed container disk on warm container
    try {
      const tmpPath = path.resolve(os.tmpdir(), 'rescue_prediction_ledger.jsonl');
      const dir = path.dirname(tmpPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(tmpPath, fetched.rawText, 'utf8');
    } catch {
      // Non-fatal if /tmp write fails
    }

    return validation.rows;
  }

  /**
   * Syncs the latest ledger from GCS down to the local filesystem if running in container.
   */
  public static async pullLatestLedger(targetLocalPath: string): Promise<boolean> {
    try {
      const fetched = await this.fetchFromGcs();
      if (!fetched || !fetched.rawText) return false;

      const validation = this.validateLedgerContent(fetched.rawText);
      if (!validation.valid) {
        console.warn('[GcsLedgerStorage] Pulled ledger validation failed:', validation.error);
        return false;
      }

      const dir = path.dirname(targetLocalPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(targetLocalPath, fetched.rawText, 'utf8');

      this.memoryCache = {
        rows: validation.rows,
        cachedAtMs: Date.now(),
        generation: fetched.generation,
        source: 'gcs',
      };

      console.log(`[GcsLedgerStorage] Successfully pulled latest ledger (${validation.rows.length} rows) from GCS.`);
      return true;
    } catch (e: any) {
      console.warn('[GcsLedgerStorage] Failed to pull ledger from GCS:', e?.message);
      return false;
    }
  }

  /**
   * Appends or uploads the full updated ledger to GCS.
   * Supports optional generation preconditions (ifGenerationMatch) for concurrency safety.
   */
  public static async persistLedgerToGcs(
    localPath: string,
    options?: { ifGenerationMatch?: string | number }
  ): Promise<boolean> {
    try {
      const token = await this.getGcpAccessToken();
      if (!token) return false;

      if (!fs.existsSync(localPath)) return false;
      const content = fs.readFileSync(localPath, 'utf8');

      const validation = this.validateLedgerContent(content);
      if (!validation.valid) {
        console.warn('[GcsLedgerStorage] Refusing to persist invalid ledger to GCS:', validation.error);
        return false;
      }

      let uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(this.OBJECT_NAME)}`;
      if (options?.ifGenerationMatch !== undefined) {
        uploadUrl += `&ifGenerationMatch=${encodeURIComponent(String(options.ifGenerationMatch))}`;
      }

      const res = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/x-ndjson',
        },
        body: content,
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.warn(`[GcsLedgerStorage] GCS upload returned HTTP ${res.status}: ${await res.text()}`);
        return false;
      }

      // Update in-memory cache upon successful upload
      this.memoryCache = {
        rows: validation.rows,
        cachedAtMs: Date.now(),
        source: 'local',
      };

      console.log(`[GcsLedgerStorage] Successfully persisted ledger to gs://${this.BUCKET_NAME}/${this.OBJECT_NAME}`);
      return true;
    } catch (e: any) {
      console.warn('[GcsLedgerStorage] Failed to persist ledger to GCS:', e?.message);
      return false;
    }
  }
}
