// ============================================================================
// DISTRIBUTED CRON LEASE & CONCURRENCY CONTROL (EPIC 81B HARDENED)
// ============================================================================
// Location: src/lib/crons/distributedCronLease.ts
//
// Prevents duplicate, concurrent, or overlapping cron executions across serverless
// workers and container instances.
//
// Dual-Tier Architecture:
// Tier 1 (Production Cloud Run):
//   Atomic, distributed compare-and-swap mutex via Google Cloud Storage (GCS)
//   preconditions (ifGenerationMatch=0 for creation, ifGenerationMatch=generation for recovery).
//   Shared across all independent Cloud Run container instances in asia-southeast2.
//
// Tier 2 (Local Development & Test Fallback):
//   Atomic filesystem-based mutex via temporary write-and-rename semantics in
//   data/cache/cron_leases or os.tmpdir().
// ============================================================================

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import crypto from 'crypto';

export interface CronLease {
  jobName: string;
  leaseId: string;
  acquiredAt: string;
  expiresAt: string;
  holderInstanceId: string;
  generation?: string;
  storageType?: 'gcs' | 'filesystem';
}

export interface LeaseAcquireResult {
  acquired: boolean;
  leaseId?: string;
  generation?: string;
  storageType?: 'gcs' | 'filesystem';
  reason?: string;
  existingLease?: CronLease;
}

export function isServerlessEnvironment(): boolean {
  return Boolean(
    process.env.VERCEL ||
    process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.LAMBDA_TASK_ROOT ||
    process.env.NETLIFY
  );
}

export function getLeaseDir(): string {
  const isServerless = isServerlessEnvironment();
  if (process.env.NODE_ENV === 'test') {
    if (process.env.FORCE_SERVERLESS_TEST === 'true' || process.env.VERCEL === '1' || process.env.VERCEL === 'true') {
      return path.join(os.tmpdir(), 'cron_leases');
    }
    return path.resolve('data/test_cache/cron_leases');
  }

  if (isServerless) {
    return path.join(os.tmpdir(), 'cron_leases');
  }

  return path.resolve('data/cache/cron_leases');
}

function getLeaseFilePath(jobName: string): string {
  const sanitized = jobName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(getLeaseDir(), `${sanitized}.lease.json`);
}

function getFallbackLeaseFilePath(jobName: string): string {
  const sanitized = jobName.replace(/[^a-zA-Z0-9_-]/g, '_');
  return path.join(os.tmpdir(), 'cron_leases', `${sanitized}.lease.json`);
}

export class DistributedCronLease {
  public static readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL
  private static readonly BUCKET_NAME = process.env.GCS_LEDGER_BUCKET || 'handicap-salmo-ledger';

  public static clearForTesting(): void {
    const dir = getLeaseDir();
    if (fs.existsSync(dir)) {
      try {
        fs.rmSync(dir, { recursive: true, force: true });
      } catch {}
    }
    const fallbackDir = path.join(os.tmpdir(), 'cron_leases');
    if (fs.existsSync(fallbackDir)) {
      try {
        fs.rmSync(fallbackDir, { recursive: true, force: true });
      } catch {}
    }
  }

  public static getLeaseDirectory(): string {
    return getLeaseDir();
  }

  /**
   * Resolves Google Cloud access token when running on Cloud Run or in an authenticated GCP environment.
   */
  public static async getGcpAccessToken(): Promise<string | null> {
    if (process.env.GCS_AUTH_TOKEN) {
      return process.env.GCS_AUTH_TOKEN;
    }

    if (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) {
      return null;
    }

    // Do not attempt GCP metadata queries in test environment unless explicitly instructed
    if (process.env.NODE_ENV === 'test' && !process.env.FORCE_GCS_TEST) {
      return null;
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
   * Checks whether a given job has an active, unexpired lease.
   */
  public static async isJobActive(jobName: string): Promise<boolean> {
    const token = await this.getGcpAccessToken();
    if (token) {
      try {
        const sanitized = jobName.replace(/[^a-zA-Z0-9_-]/g, '_');
        const objectPath = `cron_leases/${sanitized}.lease.json`;
        const readUrl = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=media`;
        const res = await fetch(readUrl, {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) {
          const lease: CronLease = await res.json();
          if (Date.now() < new Date(lease.expiresAt).getTime()) {
            return true;
          }
        }
        return false;
      } catch {
        // Fall through to filesystem check in dev
      }
    }

    const filePath = getLeaseFilePath(jobName);
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const lease: CronLease = JSON.parse(raw);
        if (Date.now() < new Date(lease.expiresAt).getTime()) {
          return true;
        }
      } catch {}
    }
    return false;
  }

  /**
   * Attempts to acquire an exclusive distributed lease for the given job.
   * Prioritizes GCS-backed atomic distributed locking across Cloud Run instances.
   * In Cloud Run, fails closed if GCS coordination is unavailable.
   */
  public static async acquireLease(
    jobName: string,
    ttlMs: number = DistributedCronLease.DEFAULT_TTL_MS
  ): Promise<LeaseAcquireResult> {
    const isCloudRun = Boolean(process.env.K_REVISION || process.env.K_SERVICE);

    // 1. Mutual exclusion: check conflicting jobs
    const CONFLICT_GROUPS: Record<string, string[]> = {
      cron_pipeline: ['cron_rescue_pipeline', 'cron_daily', 'cron_full'],
      cron_daily: ['cron_rescue_pipeline', 'cron_pipeline', 'cron_full'],
      cron_full: ['cron_rescue_pipeline', 'cron_pipeline', 'cron_daily'],
      cron_rescue_pipeline: ['cron_pipeline', 'cron_daily', 'cron_full'],
    };

    const conflicts = CONFLICT_GROUPS[jobName] || [];
    for (const conflictJob of conflicts) {
      const active = await this.isJobActive(conflictJob);
      if (active) {
        return {
          acquired: false,
          reason: `CONFLICTING_JOB_ACTIVE: Job '${jobName}' blocked because conflicting job '${conflictJob}' is currently active`,
        };
      }
    }

    const token = await this.getGcpAccessToken();

    if (token) {
      try {
        const gcsResult = await this.acquireLeaseViaGcs(jobName, ttlMs, token);
        return gcsResult;
      } catch (gcsErr: any) {
        if (isCloudRun) {
          console.error(`[DistributedCronLease] GCS lease acquire error in Cloud Run: ${gcsErr?.message}`);
          return {
            acquired: false,
            reason: `DISTRIBUTED_LOCK_UNAVAILABLE: GCS coordination error in Cloud Run (${gcsErr?.message})`,
          };
        }
        console.warn(`[DistributedCronLease] GCS lease acquire failed, falling back to local filesystem: ${gcsErr?.message}`);
      }
    } else if (isCloudRun) {
      // In Cloud Run, container filesystems are strictly container-local and ephemeral.
      // Failing closed guarantees multi-instance execution safety.
      return {
        acquired: false,
        reason: 'DISTRIBUTED_LOCK_UNAVAILABLE: No GCS token available in Cloud Run container',
      };
    }

    return this.acquireLeaseViaFilesystem(jobName, ttlMs);
  }

  /**
   * Releases an acquired lease if the leaseId matches.
   */
  public static async releaseLease(
    jobName: string,
    leaseId: string,
    generation?: string
  ): Promise<boolean> {
    const isCloudRun = Boolean(process.env.K_REVISION || process.env.K_SERVICE);
    const token = await this.getGcpAccessToken();

    if (token) {
      try {
        const gcsReleased = await this.releaseLeaseViaGcs(jobName, leaseId, token, generation);
        return gcsReleased;
      } catch (gcsErr: any) {
        console.warn(`[DistributedCronLease] GCS release failed: ${gcsErr?.message}`);
        if (isCloudRun) return false;
      }
    } else if (isCloudRun) {
      return false;
    }

    return this.releaseLeaseViaFilesystem(jobName, leaseId);
  }

  /**
   * GCS-backed distributed lease acquisition utilizing generation preconditions.
   */
  private static async acquireLeaseViaGcs(
    jobName: string,
    ttlMs: number,
    token: string
  ): Promise<LeaseAcquireResult> {
    const sanitized = jobName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const objectPath = `cron_leases/${sanitized}.lease.json`;
    const readUrl = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=media`;
    const now = Date.now();

    const instanceId =
      process.env.K_REVISION ? `${process.env.K_REVISION}_${process.env.HOSTNAME || process.pid}` :
      process.env.VERCEL_INVOCATION_ID ||
      process.env.AWS_REQUEST_ID ||
      `instance_${process.pid}_${crypto.randomBytes(4).toString('hex')}`;

    const leaseId = `lease_${now}_${crypto.randomBytes(6).toString('hex')}`;

    // 1. Inspect existing GCS lease
    try {
      const getRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });

      if (getRes.ok) {
        const existingGen = getRes.headers.get('x-goog-generation') || undefined;
        const existing: CronLease = await getRes.json();
        const expiresAtMs = new Date(existing.expiresAt).getTime();

        if (now < expiresAtMs) {
          return {
            acquired: false,
            storageType: 'gcs',
            reason: `CONCURRENT_EXECUTION_HELD: Job '${jobName}' lease held by ${existing.holderInstanceId} until ${existing.expiresAt} (GCS generation ${existingGen})`,
            existingLease: existing,
          };
        }

        // Stale lease recovery using optimistic concurrency CAS: ifGenerationMatch = existingGen
        console.log(`[DistributedCronLease] Stale lease detected for '${jobName}' (expired at ${existing.expiresAt}). Attempting CAS recovery...`);
        const recoveredLease: CronLease = {
          jobName,
          leaseId,
          acquiredAt: new Date(now).toISOString(),
          expiresAt: new Date(now + ttlMs).toISOString(),
          holderInstanceId: instanceId,
          storageType: 'gcs',
        };

        const overwriteUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(objectPath)}&ifGenerationMatch=${encodeURIComponent(existingGen || '0')}`;
        const putRes = await fetch(overwriteUrl, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(recoveredLease, null, 2),
          signal: AbortSignal.timeout(5000),
        });

        if (putRes.ok) {
          const resJson = await putRes.json();
          return {
            acquired: true,
            leaseId,
            generation: String(resJson.generation || ''),
            storageType: 'gcs',
          };
        }

        if (putRes.status === 412) {
          return {
            acquired: false,
            storageType: 'gcs',
            reason: `CONCURRENT_EXECUTION_HELD: Stale lease recovery race condition lost to another instance for '${jobName}'`,
          };
        }
      }
    } catch (readErr: any) {
      console.warn(`[DistributedCronLease] GCS read warning: ${readErr?.message}`);
    }

    // 2. Object does not exist: create atomically with ifGenerationMatch=0
    const newLease: CronLease = {
      jobName,
      leaseId,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      holderInstanceId: instanceId,
      storageType: 'gcs',
    };

    const createUrl = `https://storage.googleapis.com/upload/storage/v1/b/${this.BUCKET_NAME}/o?uploadType=media&name=${encodeURIComponent(objectPath)}&ifGenerationMatch=0`;
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(newLease, null, 2),
      signal: AbortSignal.timeout(5000),
    });

    if (createRes.ok) {
      const resJson = await createRes.json();
      return {
        acquired: true,
        leaseId,
        generation: String(resJson.generation || ''),
        storageType: 'gcs',
      };
    }

    if (createRes.status === 412) {
      return {
        acquired: false,
        storageType: 'gcs',
        reason: `CONCURRENT_EXECUTION_HELD: Race condition lost to another Cloud Run instance for '${jobName}'`,
      };
    }

    throw new Error(`GCS upload returned unexpected HTTP ${createRes.status}: ${await createRes.text()}`);
  }

  /**
   * GCS-backed distributed lease release.
   */
  private static async releaseLeaseViaGcs(
    jobName: string,
    leaseId: string,
    token: string,
    generation?: string
  ): Promise<boolean> {
    const sanitized = jobName.replace(/[^a-zA-Z0-9_-]/g, '_');
    const objectPath = `cron_leases/${sanitized}.lease.json`;
    const readUrl = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}?alt=media`;

    try {
      const getRes = await fetch(readUrl, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(4000),
      });

      if (!getRes.ok) return true; // Already gone

      const currentGen = getRes.headers.get('x-goog-generation') || generation;
      const current: CronLease = await getRes.json();

      if (current.leaseId === leaseId) {
        let deleteUrl = `https://storage.googleapis.com/storage/v1/b/${this.BUCKET_NAME}/o/${encodeURIComponent(objectPath)}`;
        if (currentGen) {
          deleteUrl += `?ifGenerationMatch=${encodeURIComponent(currentGen)}`;
        }

        const delRes = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(5000),
        });

        return delRes.ok || delRes.status === 404 || delRes.status === 412;
      }

      console.warn(`[DistributedCronLease] Lease release ignored: held leaseId '${current.leaseId}' does not match releasing '${leaseId}'`);
      return false;
    } catch (e: any) {
      console.warn(`[DistributedCronLease] Error deleting GCS lease: ${e?.message}`);
      return false;
    }
  }

  /**
   * Filesystem-based atomic lease acquisition (Local & Test Fallback).
   */
  private static acquireLeaseViaFilesystem(
    jobName: string,
    ttlMs: number
  ): LeaseAcquireResult {
    let filePath = getLeaseFilePath(jobName);
    let dir = path.dirname(filePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      filePath = getFallbackLeaseFilePath(jobName);
      dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }

    const now = Date.now();

    // Check existing lease
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf8');
        const existing: CronLease = JSON.parse(raw);
        const expiresAtMs = new Date(existing.expiresAt).getTime();

        if (now < expiresAtMs) {
          return {
            acquired: false,
            storageType: 'filesystem',
            reason: `CONCURRENT_EXECUTION_HELD: Job '${jobName}' lease held by ${existing.holderInstanceId} until ${existing.expiresAt}`,
            existingLease: existing,
          };
        }
      } catch {
        // Stale or corrupted lease file, allow re-acquisition
      }
    }

    const leaseId = `lease_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    const instanceId =
      process.env.VERCEL_INVOCATION_ID ||
      process.env.AWS_REQUEST_ID ||
      `pid_${process.pid}_${crypto.randomBytes(3).toString('hex')}`;

    const newLease: CronLease = {
      jobName,
      leaseId,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      holderInstanceId: instanceId,
      storageType: 'filesystem',
    };

    // Atomic write
    const tempFile = `${filePath}.tmp.${Date.now()}`;
    try {
      fs.writeFileSync(tempFile, JSON.stringify(newLease, null, 2), 'utf8');
      fs.renameSync(tempFile, filePath);
    } catch (writeErr) {
      try {
        if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
      } catch {}
      return {
        acquired: false,
        storageType: 'filesystem',
        reason: `LEASE_WRITE_ERROR: Could not lock lease file (${(writeErr as Error).message})`,
      };
    }

    return {
      acquired: true,
      leaseId,
      storageType: 'filesystem',
    };
  }

  /**
   * Filesystem-based atomic lease release.
   */
  private static releaseLeaseViaFilesystem(jobName: string, leaseId: string): boolean {
    const primaryPath = getLeaseFilePath(jobName);
    const fallbackPath = getFallbackLeaseFilePath(jobName);
    const filePath = fs.existsSync(primaryPath) ? primaryPath : fs.existsSync(fallbackPath) ? fallbackPath : null;
    if (!filePath) return true;

    try {
      const raw = fs.readFileSync(filePath, 'utf8');
      const current: CronLease = JSON.parse(raw);

      if (current.leaseId === leaseId) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch {
      try {
        if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);
      } catch {}
      return true;
    }
  }

  /**
   * High-level wrapper executing the given action within a protected lease.
   */
  public static async withLease<T>(
    jobName: string,
    action: () => Promise<T>,
    ttlMs: number = DistributedCronLease.DEFAULT_TTL_MS
  ): Promise<{ executed: boolean; result?: T; reason?: string }> {
    const acquireResult = await this.acquireLease(jobName, ttlMs);
    if (!acquireResult.acquired) {
      return {
        executed: false,
        reason: acquireResult.reason,
      };
    }

    try {
      const result = await action();
      return {
        executed: true,
        result,
      };
    } finally {
      if (acquireResult.leaseId) {
        await this.releaseLease(jobName, acquireResult.leaseId, acquireResult.generation);
      }
    }
  }
}
