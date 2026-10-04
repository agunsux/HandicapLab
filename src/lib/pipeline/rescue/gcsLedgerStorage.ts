// ============================================================================
// GCS DURABLE LEDGER STORAGE SERVICE
// Namespace: src/lib/pipeline/rescue/gcsLedgerStorage.ts
// ============================================================================
// Provides durable cloud persistence for rescue predictions when running
// on Google Cloud Run without requiring third-party SDK dependencies.
// ============================================================================

import fs from 'fs';
import path from 'path';

export class GcsLedgerStorage {
  private static readonly BUCKET_NAME = process.env.GCS_LEDGER_BUCKET || 'handicap-salmo-ledger';
  private static readonly OBJECT_NAME = 'rescue/rescue_prediction_ledger.jsonl';

  private static async getGcpAccessToken(): Promise<string | null> {
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
   * Syncs the latest ledger from GCS down to the local filesystem if running in container.
   */
  public static async pullLatestLedger(targetLocalPath: string): Promise<boolean> {
    try {
      const token = await this.getGcpAccessToken();
      if (!token) return false;

      const url = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(this.OBJECT_NAME)}?alt=media`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return false;
      const text = await res.text();
      if (!text || text.trim().length === 0) return false;

      const dir = path.dirname(targetLocalPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

      fs.writeFileSync(targetLocalPath, text, 'utf8');
      console.log(`[GcsLedgerStorage] Successfully pulled latest ledger (${text.split('\n').filter(Boolean).length} rows) from GCS.`);
      return true;
    } catch (e: any) {
      console.warn('[GcsLedgerStorage] Failed to pull ledger from GCS:', e?.message);
      return false;
    }
  }

  /**
   * Appends or uploads the full updated ledger to GCS.
   */
  public static async persistLedgerToGcs(localPath: string): Promise<boolean> {
    try {
      const token = await this.getGcpAccessToken();
      if (!token) return false;

      if (!fs.existsSync(localPath)) return false;
      const content = fs.readFileSync(localPath, 'utf8');

      const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(this.OBJECT_NAME)}`;
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

      console.log(`[GcsLedgerStorage] Successfully persisted ledger to gs://${this.BUCKET_NAME}/${this.OBJECT_NAME}`);
      return true;
    } catch (e: any) {
      console.warn('[GcsLedgerStorage] Failed to persist ledger to GCS:', e?.message);
      return false;
    }
  }
}

