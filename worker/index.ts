// Controlled API-Football Egress Worker
// Location: worker/index.ts
//
// Single long-lived process that consumes `apifootball_job` events from the
// existing Supabase `event_queue` and executes them through the EXISTING
// canonical ProviderGateway (quota -> rate limit -> cache/dedup -> API-Football).
//
// It never calls API-Football directly, never creates a second gateway/quota
// manager/rate limiter, and never runs more than the configured concurrency
// (default 1, hard maximum 2).
//
// Run with:  npx tsx worker/index.ts   (see package.json "worker:start")

import { getEgressMode } from '@/lib/crons/egressMode';
import { globalGateway } from '@/lib/providers/providerGateway';
import { getQuotaSnapshot } from '@/lib/providers/quotaManagerV4';
import {
  claimNextEgressEvent,
  completeEgressEvent,
  failEgressEvent,
  getEgressQueueDepth,
  recoverExpiredEgressLeases,
  type EgressEventRecord,
} from '@/lib/crons/egressQueue';
import { executeEgressJob, isKnownEgressJob } from '@/lib/crons/egressJobs';
import { loadWorkerConfig, type WorkerConfig } from './config';
import { resolveObservedEgressIp, writeHeartbeat } from './health';

const WORKER_VERSION = process.env.WORKER_VERSION || 'p0.3';

interface WorkerState {
  draining: boolean;
  paused: boolean;
  pauseReason: string | null;
  startedAt: string;
  observedEgressIp: string | null;
  lastJobId: string | null;
  lastJobType: string | null;
  lastJobStatus: string | null;
  lastError: string | null;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function computePaused(
  config: WorkerConfig,
  state: WorkerState
): Promise<boolean> {
  state.observedEgressIp = await resolveObservedEgressIp(config.egressIpCheckUrl);
  if (!config.expectedEgressIp) return false;

  if (state.observedEgressIp && state.observedEgressIp !== config.expectedEgressIp) {
    state.pauseReason = `egress IP drift: expected ${config.expectedEgressIp}, observed ${state.observedEgressIp}`;
    return true;
  }
  if (state.paused && state.pauseReason?.startsWith('egress IP drift')) {
    state.pauseReason = null;
  }
  return false;
}

async function buildHeartbeatPayload(config: WorkerConfig, state: WorkerState) {
  let depth = { pending: 0, processing: 0, failed: 0, completed: 0 };
  try {
    depth = await getEgressQueueDepth();
  } catch {
    // best-effort
  }

  let providerState: string | null = null;
  try {
    providerState = globalGateway.getHealthMonitor('apifootball').getState();
  } catch {
    // best-effort
  }

  let quotaMode: string | null = null;
  try {
    quotaMode = (await getQuotaSnapshot('apifootball'))?.mode ?? null;
  } catch {
    // best-effort
  }

  const status = state.draining
    ? 'STOPPED'
    : state.paused
      ? 'PAUSED'
      : state.lastError
        ? 'DEGRADED'
        : 'ACTIVE';

  return {
    workerId: config.workerId,
    status: status as 'ACTIVE' | 'PAUSED' | 'DEGRADED' | 'STOPPED',
    observedEgressIp: state.observedEgressIp,
    expectedEgressIp: config.expectedEgressIp,
    queuePending: depth.pending,
    queueProcessing: depth.processing,
    queueFailed: depth.failed,
    providerState,
    quotaMode,
    lastJobId: state.lastJobId,
    lastJobType: state.lastJobType,
    lastJobStatus: state.lastJobStatus,
    lastError: state.lastError,
    version: WORKER_VERSION,
    concurrency: config.concurrency,
    startedAt: state.startedAt,
    metadata: { egressMode: getEgressMode(), completed: depth.completed },
  };
}

async function runSlot(config: WorkerConfig, state: WorkerState): Promise<void> {
  while (!state.draining) {
    if (state.paused) {
      await sleep(config.pollIntervalMs);
      continue;
    }

    let record: EgressEventRecord | null = null;
    try {
      record = await claimNextEgressEvent(config.leaseSeconds);
    } catch (error) {
      state.lastError = messageOf(error);
      await sleep(config.pollIntervalMs);
      continue;
    }

    if (!record) {
      await sleep(config.pollIntervalMs);
      continue;
    }

    const payload = (record.payload ?? {}) as { job?: unknown };
    state.lastJobId = record.id;
    state.lastJobType = typeof payload.job === 'string' ? payload.job : null;
    state.lastJobStatus = 'processing';

    try {
      if (!isKnownEgressJob(payload.job)) {
        throw new Error(`Unknown egress job type: ${String(payload.job)}`);
      }
      await executeEgressJob(record);
      await completeEgressEvent(record.id);
      state.lastJobStatus = 'completed';
      state.lastError = null;
    } catch (error) {
      const msg = messageOf(error);
      state.lastError = msg;
      state.lastJobStatus = 'failed';
      // Bounded backoff + dead-letter are handled by failEvent (max_retries).
      await failEgressEvent(record.id, msg).catch(() => undefined);
    }
  }
}

export async function startWorker(): Promise<void> {
  const config = loadWorkerConfig();
  const mode = getEgressMode();

  if (mode !== 'worker' && process.env.WORKER_FORCE !== '1') {
    console.error(
      `[egress-worker] Refusing to start: APIFOOTBALL_EGRESS_MODE="${mode}". ` +
        `Set APIFOOTBALL_EGRESS_MODE=worker to consume provider work (or WORKER_FORCE=1 for a dry/health run).`
    );
    return;
  }

  const state: WorkerState = {
    draining: false,
    paused: false,
    pauseReason: null,
    startedAt: new Date().toISOString(),
    observedEgressIp: null,
    lastJobId: null,
    lastJobType: null,
    lastJobStatus: null,
    lastError: null,
  };

  console.info(
    `[egress-worker] boot workerId=${config.workerId} concurrency=${config.concurrency} ` +
      `mode=${mode} expectedEgressIp=${config.expectedEgressIp ?? 'unset'}`
  );

  // 1. Recover expired leases left by a previous crashed worker.
  try {
    const recovered = await recoverExpiredEgressLeases();
    if (recovered > 0) console.warn(`[egress-worker] recovered ${recovered} expired lease(s).`);
  } catch (error) {
    console.error(`[egress-worker] lease recovery failed: ${messageOf(error)}`);
  }

  // 2. Initial egress IP observation / drift check.
  state.paused = await computePaused(config, state);
  if (state.paused) console.error(`[egress-worker] PAUSED: ${state.pauseReason}`);

  await writeHeartbeat(await buildHeartbeatPayload(config, state));

  // 3. Heartbeat timer (also re-checks egress IP drift).
  const heartbeat = setInterval(async () => {
    try {
      const drift = await computePaused(config, state);
      if (drift && !state.paused) {
        state.paused = true;
        console.error(`[egress-worker] PAUSED: ${state.pauseReason}`);
      } else if (!drift && state.paused) {
        state.paused = false;
        console.warn('[egress-worker] egress IP restored; resuming claims.');
      }
      await writeHeartbeat(await buildHeartbeatPayload(config, state));
    } catch {
      // observability only
    }
  }, config.heartbeatIntervalMs);

  // 4. Graceful shutdown: stop claiming, let in-flight work finish.
  const shutdown = (signal: string) => {
    if (state.draining) return;
    console.warn(`[egress-worker] ${signal} received — draining (no new claims).`);
    state.draining = true;
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // 5. Bounded concurrency slots (each claims its own event; SKIP LOCKED prevents overlap).
  const slots = Array.from({ length: config.concurrency }, () => runSlot(config, state));
  await Promise.all(slots);

  clearInterval(heartbeat);
  await writeHeartbeat(await buildHeartbeatPayload(config, state));
  console.info('[egress-worker] stopped.');
}

const invokedDirectly =
  (process.argv[1] || '').replace(/\\/g, '/').endsWith('worker/index.ts') ||
  process.env.WORKER_AUTOSTART === '1';

if (invokedDirectly) {
  startWorker().catch((error) => {
    console.error(`[egress-worker] fatal: ${messageOf(error)}`);
    process.exit(1);
  });
}
