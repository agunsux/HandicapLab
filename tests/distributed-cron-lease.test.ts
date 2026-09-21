import { describe, it, expect, beforeEach } from 'vitest';
import { DistributedCronLease } from '@/lib/crons/distributedCronLease';
import * as fs from 'fs';
import * as path from 'path';

describe('DistributedCronLease Concurrency Protection', () => {
  const jobName = 'test_cron_job';

  beforeEach(() => {
    const testDir = path.resolve('data/test_cache/cron_leases');
    if (fs.existsSync(testDir)) {
      const files = fs.readdirSync(testDir);
      for (const f of files) {
        try {
          fs.unlinkSync(path.join(testDir, f));
        } catch {}
      }
    }
  });

  it('acquires lease when no prior lease exists', async () => {
    const res = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(res.acquired).toBe(true);
    expect(res.leaseId).toBeDefined();

    // Clean up
    await DistributedCronLease.releaseLease(jobName, res.leaseId!);
  });

  it('rejects concurrent lease acquisition while active lease is held', async () => {
    const first = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(first.acquired).toBe(true);

    const second = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(second.acquired).toBe(false);
    expect(second.reason).toContain('CONCURRENT_EXECUTION_HELD');

    // Clean up
    await DistributedCronLease.releaseLease(jobName, first.leaseId!);

    // Can acquire again after release
    const third = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(third.acquired).toBe(true);
    await DistributedCronLease.releaseLease(jobName, third.leaseId!);
  });

  it('automatically acquires lease if existing lease is expired', async () => {
    // Acquire with 1ms TTL
    const first = await DistributedCronLease.acquireLease(jobName, 1);
    expect(first.acquired).toBe(true);

    // Wait 20ms for expiration
    await new Promise((r) => setTimeout(r, 20));

    const second = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(second.acquired).toBe(true);
    await DistributedCronLease.releaseLease(jobName, second.leaseId!);
  });

  it('withLease executes action and releases lease automatically', async () => {
    let executed = false;
    const res = await DistributedCronLease.withLease(jobName, async () => {
      executed = true;
      return 42;
    });

    expect(res.executed).toBe(true);
    expect(res.result).toBe(42);
    expect(executed).toBe(true);

    // Lease should be released
    const after = await DistributedCronLease.acquireLease(jobName, 60000);
    expect(after.acquired).toBe(true);
    await DistributedCronLease.releaseLease(jobName, after.leaseId!);
  });
});

