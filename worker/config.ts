// Controlled egress worker — configuration
// Location: worker/config.ts
//
// Fail-closed configuration for the single controlled API-Football worker.
// Missing/invalid credentials abort worker startup; the worker never fabricates
// a substitute credential.

import { hostname } from 'node:os';
import { validateCredential } from '@/lib/auth/credentialValidator';
import { getApiFootballKey } from '@/lib/providers/providerKey';

export interface WorkerConfig {
  supabaseUrl: string;
  supabaseServiceKey: string;
  apiFootballKey: string;
  cronSecret: string;
  workerId: string;
  concurrency: number;
  pollIntervalMs: number;
  leaseSeconds: number;
  heartbeatIntervalMs: number;
  egressIpCheckUrl: string;
  expectedEgressIp: string | null;
  maxConcurrency: number;
}

const MAX_CONCURRENCY = 2;
const DEFAULT_CONCURRENCY = 1;

function intFromEnv(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
}

export interface LoadWorkerConfigDeps {
  env?: NodeJS.ProcessEnv;
  hostnameFn?: () => string;
}

/** Load and validate worker configuration. Throws (fails closed) when invalid. */
export function loadWorkerConfig(deps: LoadWorkerConfigDeps = {}): WorkerConfig {
  const env = deps.env ?? process.env;
  const hostnameFn = deps.hostnameFn ?? hostname;

  const supabaseUrl = (env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '').trim();
  if (!supabaseUrl) {
    throw new Error('[FAIL CLOSED] Worker misconfigured: SUPABASE_URL is missing.');
  }

  const supabaseServiceKey = validateCredential(
    'SUPABASE_SERVICE_ROLE_KEY',
    env.SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_KEY,
    'jwt'
  );

  const apiFootballKey = validateCredential('APIFOOTBALL_KEY', getApiFootballKey(), 'opaque');

  const cronSecret = (env.CRON_SECRET || '').trim();
  if (!cronSecret) {
    throw new Error('[FAIL CLOSED] Worker misconfigured: CRON_SECRET is missing.');
  }

  const configuredConcurrency = intFromEnv(env.EGRESS_WORKER_CONCURRENCY, DEFAULT_CONCURRENCY);
  const concurrency = Math.min(Math.max(1, configuredConcurrency), MAX_CONCURRENCY);

  return {
    supabaseUrl,
    supabaseServiceKey,
    apiFootballKey,
    cronSecret,
    workerId: (env.WORKER_ID || hostnameFn() || 'egress-worker').trim(),
    concurrency,
    pollIntervalMs: intFromEnv(env.EGRESS_WORKER_POLL_MS, 2000),
    leaseSeconds: intFromEnv(env.EGRESS_WORKER_LEASE_SECONDS, 300),
    heartbeatIntervalMs: intFromEnv(env.EGRESS_WORKER_HEARTBEAT_MS, 30000),
    egressIpCheckUrl: env.EGRESS_IP_CHECK_URL || 'https://api.ipify.org?format=json',
    expectedEgressIp: (env.EGRESS_EXPECTED_IP || '').trim() || null,
    maxConcurrency: MAX_CONCURRENCY,
  };
}
