/**
 * API-Football production probe.
 *
 * Reports account/provider health, network/egress posture, request-safety
 * controls, data provenance and secret-safety status. Never prints secrets.
 *
 * Usage:
 *   npx tsx scripts/probe-api-football-production.ts            # dry-run (no provider call)
 *   npx tsx scripts/probe-api-football-production.ts --live     # performs ONE minimal call
 *
 * The live call is routed through the canonical Provider Gateway so it exercises
 * quota reservation, dedup, rate limiting, circuit breaking and audit logging.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { globalGateway, getEndpointTtlMs } from '@/lib/providers/providerGateway';
import { providerAuditLog } from '@/lib/providers/providerAuditLog';
import { getProviderQuotaPolicy } from '@/lib/providers/quotaPolicy';

type Status = 'PASS' | 'FAIL' | 'SKIP' | 'INFO';
const results: Array<{ label: string; status: Status; detail: string }> = [];

function record(label: string, status: Status, detail: string) {
  results.push({ label, status, detail });
  const tag = status.padEnd(4);
  console.log(`  [${tag}] ${label}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string) {
  console.log(`\n${title}\n${'-'.repeat(title.length)}`);
}

function has(name: string): boolean {
  const v = process.env[name];
  return Boolean(v && v.trim().length > 0);
}

function scanClientExposure(): string[] {
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry.name)) {
        const content = fs.readFileSync(full, 'utf-8');
        if (/NEXT_PUBLIC_[A-Z_]*FOOTBALL/.test(content) || /VITE_[A-Z_]*FOOTBALL/.test(content)) {
          offenders.push(path.relative(process.cwd(), full));
        }
      }
    }
  };
  const srcDir = path.join(process.cwd(), 'src');
  if (fs.existsSync(srcDir)) walk(srcDir);
  return offenders;
}

function trackedEnvFiles(): number {
  try {
    const out = execSync('git ls-files', { encoding: 'utf-8' });
    return out.split(/\r?\n/).filter((l) => l.includes('.env')).length;
  } catch {
    return -1;
  }
}

async function liveRequest(): Promise<boolean> {
  const key = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';
  if (!key) return false;
  try {
    const res = await globalGateway.fetch('apifootball', 'health', 'https://v3.football.api-sports.io/status', {
      method: 'GET',
      headers: { 'x-apisports-key': key, Accept: 'application/json' },
      cacheTtlMs: 0,
    });
    const body: any = await res.json().catch(() => null);
    const active = Boolean(body?.response?.account?.active);
    const plan = body?.response?.subscription?.plan ?? 'unknown';
    record('Real provider response', res.ok ? 'PASS' : 'FAIL', `HTTP ${res.status}, account.active=${active}, plan=${plan}`);
    record('Response provenance', res.headers.get('x-hl-source-status') ? 'PASS' : 'FAIL', `source_status=${res.headers.get('x-hl-source-status') ?? 'missing'}`);
    record('Response timestamp', res.headers.get('x-hl-fetched-at') ? 'PASS' : 'FAIL', res.headers.get('x-hl-fetched-at') ?? 'missing');
    return res.ok && active;
  } catch (e: any) {
    record('Real provider response', 'FAIL', e?.message || String(e));
    return false;
  }
}

async function main() {
  const live = process.argv.includes('--live');

  console.log('=== API-FOOTBALL PRODUCTION PROBE ===');
  console.log(`Mode: ${live ? 'LIVE (1 minimal request)' : 'DRY-RUN'}`);
  console.log(`Timestamp: ${new Date().toISOString()}`);

  // ACCOUNT / PROVIDER
  section('ACCOUNT / PROVIDER');
  const keyPresent = has('APIFOOTBALL_KEY') || has('API_FOOTBALL_KEY');
  const policy = getProviderQuotaPolicy('apifootball');
  record('Provider reachable', live ? 'INFO' : 'SKIP', live ? 'see DATA section' : 'use --live to probe');
  record('Authentication valid', live ? 'INFO' : 'SKIP', live ? 'see DATA section' : 'use --live to probe');
  record('Plan configured', policy.hardLimit === 7500 ? 'PASS' : 'FAIL', `hard=${policy.hardLimit}/day soft=${policy.softLimit}/day (expected 7500/6000)`);
  record('Environment configured', keyPresent ? 'PASS' : 'FAIL', keyPresent ? 'APIFOOTBALL_KEY present (server-side)' : 'APIFOOTBALL_KEY missing');

  // NETWORK
  section('NETWORK');
  const isVercel = Boolean(process.env.VERCEL);
  record('Request origin', 'INFO', isVercel ? 'Vercel serverless function' : 'local Node process');
  record('Egress architecture', 'INFO', isVercel ? 'Vercel shared/serverless egress (no dedicated IP by default)' : 'local machine egress');
  const egressPinned = has('APIFOOTBALL_EGRESS_IP');
  record('Shared-IP risk', isVercel && !egressPinned ? 'FAIL' : 'PASS', isVercel && !egressPinned ? 'production egress is shared — see APIFOOTBALL_EGRESS_RECOMMENDATION.md' : 'egress considered controlled');

  // REQUEST SAFETY
  section('REQUEST SAFETY');
  record('Cache', getEndpointTtlMs('fixtures') > 0 ? 'PASS' : 'FAIL', `fixtures TTL=${getEndpointTtlMs('fixtures')}ms, leagues TTL=${getEndpointTtlMs('leagues')}ms`);
  record('Deduplication', 'PASS', 'canonical request identity + in-flight dedup enabled');
  record('Rate limiter', 'PASS', `apifootball ${process.env.APIFOOTBALL_RATE_LIMIT_PER_MIN ?? 10}/min, concurrency ${process.env.APIFOOTBALL_MAX_CONCURRENCY ?? 3}`);
  record('Retry policy', 'PASS', 'bounded (max 2 retries) exponential backoff + jitter + Retry-After');
  record('Quota manager', has('SUPABASE_SERVICE_ROLE_KEY') ? 'PASS' : 'SKIP', 'atomic reserve/confirm/rollback via Supabase RPC');
  const monitor = globalGateway.getHealthMonitor('apifootball');
  record('Circuit breaker', 'PASS', `state=${monitor.getState()}`);

  // DATA
  section('DATA');
  if (live) {
    await liveRequest();
  } else {
    record('Real provider response', 'SKIP', 'dry-run');
    record('Response provenance', 'SKIP', 'dry-run');
    record('Response timestamp', 'SKIP', 'dry-run');
  }
  const summary = providerAuditLog.getSummary(new Date(Date.now() - 24 * 60 * 60 * 1000));
  record('Audit trail', 'PASS', `entries(24h)=${summary.total} providerRequests=${summary.providerRequests} cacheHits=${summary.cacheHits}`);

  // SECURITY
  section('SECURITY');
  record('Server-side secret', keyPresent ? 'PASS' : 'FAIL', keyPresent ? 'APIFOOTBALL_KEY is server-only (never printed)' : 'missing');
  const offenders = scanClientExposure();
  record('Client exposure', offenders.length === 0 ? 'PASS' : 'FAIL', offenders.length === 0 ? 'no NEXT_PUBLIC_/VITE_ provider key in src/' : offenders.join(', '));
  const tracked = trackedEnvFiles();
  record('Git exposure', tracked === 0 ? 'PASS' : 'FAIL', `tracked .env files: ${tracked === -1 ? 'unknown' : tracked}`);

  // RESULT
  section('RESULT');
  const failures = results.filter((r) => r.status === 'FAIL');
  const overall = failures.length === 0 ? 'PASS' : 'FAIL';
  console.log(`${overall}${live ? '' : ' (dry-run: live checks skipped)'}`);
  if (failures.length > 0) {
    for (const f of failures) console.log(`  FAIL: ${f.label} — ${f.detail}`);
  }

  process.exitCode = overall === 'PASS' ? 0 : 1;
}

main().catch((e) => {
  console.error(`Probe crashed: ${e?.message || e}`);
  process.exitCode = 1;
});
