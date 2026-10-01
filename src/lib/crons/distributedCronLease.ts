// ============================================================================
// DISTRIBUTED CRON LEASE & CONCURRENCY CONTROL
// ============================================================================
// Location: src/lib/crons/distributedCronLease.ts
//
// Prevents duplicate, concurrent, or overlapping cron executions across serverless
// workers and container instances.
// Ensures that only one instance of a pipeline/reconcile job runs at any given time,
// protecting provider quotas from accidental duplicate consumption.
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
}

export interface LeaseAcquireResult {
  acquired: boolean;
  leaseId?: string;
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
  private static readonly DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes default TTL

  public static getLeaseDirectory(): string {
    return getLeaseDir();
  }

  /**
   * Attempts to acquire an exclusive distributed lease for the given job.
   * If an active (non-expired) lease exists, returns acquired: false.
   */
  public static async acquireLease(
    jobName: string,
    ttlMs: number = DistributedCronLease.DEFAULT_TTL_MS
  ): Promise<LeaseAcquireResult> {
    let filePath = getLeaseFilePath(jobName);
    let dir = path.dirname(filePath);
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    } catch {
      // Serverless read-only filesystem fallback
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
            reason: `CONCURRENT_EXECUTION_HELD: Job '${jobName}' lease held by ${existing.holderInstanceId} until ${existing.expiresAt}`,
            existingLease: existing,
          };
        }
      } catch (err) {
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
        reason: `LEASE_WRITE_ERROR: Could not lock lease file (${(writeErr as Error).message})`,
      };
    }

    return {
      acquired: true,
      leaseId,
    };
  }

  /**
   * Releases an acquired lease if the leaseId matches.
   */
  public static async releaseLease(jobName: string, leaseId: string): Promise<boolean> {
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
        await this.releaseLease(jobName, acquireResult.leaseId);
      }
    }
  }
}

