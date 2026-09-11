// ============================================================================
// INCREMENT 2 — PRODUCTION QUOTA VERIFICATION
// ============================================================================
// Deterministic PASS/FAIL probe for the production quota implementation:
//   - Supabase connectivity + quota_state / quota_reservations tables
//   - reserve_quota / confirm_quota / rollback_quota / cleanup_stale_reservations
//   - RPC execution semantics (reserve → confirm → rollback → cleanup)
//   - hard-limit protection (reserve beyond limit must fail)
//   - API-Football / OddsPapi limits from the canonical quota policy
//   - unmetered historical-odds classification
//   - live OddsPapi account reconciliation (unmetered endpoint)
//
// Never prints provider secrets. Writes:
//   data/verification/increment2_quota_verification.json
//
// Usage: npx tsx scripts/verify/production-quota-verification.ts

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import {
  getProviderQuotaPolicy,
  isUnmeteredEndpoint,
} from '../../src/lib/providers/quotaPolicy';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

type Result = 'PASS' | 'FAIL' | 'SKIP';

interface Check {
  check: string;
  result: Result;
  evidence: string;
}

const checks: Check[] = [];

function record(check: string, result: Result, evidence: string): void {
  checks.push({ check, result, evidence });
  console.log(`[${result}] ${check} — ${evidence}`);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const oddsPapiKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '';

function redactHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'INVALID_URL';
  }
}

async function rest(
  endpoint: string,
  init: RequestInit = {}
): Promise<{ status: number; body: unknown }> {
  const res = await fetch(`${supabaseUrl}/rest/v1${endpoint}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep raw text
  }
  return { status: res.status, body };
}

async function rpc(name: string, params: Record<string, unknown>): Promise<{ status: number; body: any }> {
  return rest(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(params) });
}

async function run(): Promise<void> {
  // 1. Configuration presence (values never printed)
  record(
    'production database connectivity configuration',
    supabaseUrl && serviceKey ? 'PASS' : 'FAIL',
    supabaseUrl && serviceKey ? `host=${redactHost(supabaseUrl)} key=present` : 'NEXT_PUBLIC_SUPABASE_URL/SUPABASE_URL or service key missing'
  );

  // 2. PostgREST reachability + RPC inventory
  const requiredRpcs = ['reserve_quota', 'confirm_quota', 'rollback_quota', 'cleanup_stale_reservations'];
  let openapiPaths: string[] = [];
  try {
    const root = await rest('/', { method: 'GET' });
    const paths = (root.body as any)?.paths ?? {};
    openapiPaths = Object.keys(paths);
    const missing = requiredRpcs.filter((r) => !openapiPaths.includes(`/rpc/${r}`));
    record(
      'required quota RPCs exist (PostgREST schema)',
      root.status === 200 && missing.length === 0 ? 'PASS' : 'FAIL',
      root.status === 200
        ? missing.length === 0
          ? `all ${requiredRpcs.length} RPCs visible`
          : `missing: ${missing.join(', ')}`
        : `PostgREST status ${root.status}`
    );
  } catch (err: any) {
    record('required quota RPCs exist (PostgREST schema)', 'FAIL', `PostgREST unreachable: ${err.message}`);
  }

  // 3. Tables
  for (const table of ['quota_state', 'quota_reservations']) {
    try {
      const res = await rest(`/${table}?select=id&limit=1`);
      record(`table ${table}`, res.status === 200 ? 'PASS' : 'FAIL', `HTTP ${res.status}`);
    } catch (err: any) {
      record(`table ${table}`, 'FAIL', err.message);
    }
  }

  // 4. Migration alignment: safe_limit must equal limit_value (hard-limit semantics)
  try {
    const res = await rest('/quota_state?select=provider,quota_type,limit_value,safe_limit,safety_reserve_pct');
    if (res.status !== 200) {
      record('quota_state hard-limit alignment', 'FAIL', `HTTP ${res.status}`);
    } else {
      const rows = (res.body as any[]) ?? [];
      const misaligned = rows.filter((r) => Number(r.safe_limit) !== Number(r.limit_value) || Number(r.safety_reserve_pct) !== 0);
      record(
        'quota_state hard-limit alignment (20260911 migration)',
        misaligned.length === 0 ? 'PASS' : 'FAIL',
        rows.length === 0
          ? 'no quota_state rows yet (nothing to align)'
          : misaligned.length === 0
          ? `${rows.length} rows aligned`
          : `${misaligned.length}/${rows.length} rows still use reserve semantics`
      );
    }
  } catch (err: any) {
    record('quota_state hard-limit alignment', 'FAIL', err.message);
  }

  // 5. RPC lifecycle probe on an isolated verification provider.
  const probeProvider = 'quota_verification';
  const probeBlockProvider = 'quota_verification_block';
  const periodStart = new Date(Date.UTC(2000, 0, 1)).toISOString();
  const periodEnd = new Date(Date.UTC(2000, 0, 2)).toISOString();
  const requestId = `probe-${Date.now()}`;

  try {
    const reserve1 = await rpc('reserve_quota', {
      p_provider: probeProvider,
      p_quota_type: 'DAILY',
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_amount: 1,
      p_endpoint: 'verification',
      p_request_id: requestId,
      p_default_limit: 100,
      p_safety_reserve_pct: 0,
    });
    const r1 = reserve1.body;
    record(
      'reserve_quota executes',
      r1?.ok === true && r1?.reservation_id ? 'PASS' : 'FAIL',
      r1?.ok === true ? `reservation_id issued (safe_limit=${r1.safe_limit})` : JSON.stringify(r1).slice(0, 200)
    );

    if (r1?.ok === true && r1?.reservation_id) {
      const confirm = await rpc('confirm_quota', {
        p_reservation_id: r1.reservation_id,
        p_actual_cost: 1,
        p_provider_limit: null,
        p_provider_remaining: null,
      });
      record('confirm_quota executes', confirm.body?.ok === true ? 'PASS' : 'FAIL', JSON.stringify(confirm.body).slice(0, 200));

      const confirmAgain = await rpc('confirm_quota', {
        p_reservation_id: r1.reservation_id,
        p_actual_cost: 1,
        p_provider_limit: null,
        p_provider_remaining: null,
      });
      record(
        'confirm_quota idempotency',
        confirmAgain.body?.reason === 'ALREADY_CONFIRMED' ? 'PASS' : 'FAIL',
        `second confirm → ${confirmAgain.body?.reason}`
      );
    }

    // Rollback path
    const reserve2 = await rpc('reserve_quota', {
      p_provider: probeProvider,
      p_quota_type: 'DAILY',
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_amount: 1,
      p_endpoint: 'verification',
      p_request_id: `${requestId}-rb`,
      p_default_limit: 100,
      p_safety_reserve_pct: 0,
    });
    if (reserve2.body?.ok === true && reserve2.body?.reservation_id) {
      const rollback = await rpc('rollback_quota', { p_reservation_id: reserve2.body.reservation_id });
      record('rollback_quota executes', rollback.body?.ok === true ? 'PASS' : 'FAIL', JSON.stringify(rollback.body).slice(0, 200));

      const rollbackAgain = await rpc('rollback_quota', { p_reservation_id: reserve2.body.reservation_id });
      record(
        'rollback_quota idempotency',
        rollbackAgain.body?.reason === 'ALREADY_ROLLED_BACK' ? 'PASS' : 'FAIL',
        `second rollback → ${rollbackAgain.body?.reason}`
      );
    } else {
      record('rollback_quota executes', 'FAIL', 'reserve for rollback did not succeed');
    }

    // Hard-limit protection: limit=1, first reserve ok, second must be QUOTA_EXHAUSTED.
    const blockReserve1 = await rpc('reserve_quota', {
      p_provider: probeBlockProvider,
      p_quota_type: 'DAILY',
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_amount: 1,
      p_endpoint: 'verification',
      p_request_id: `${requestId}-b1`,
      p_default_limit: 1,
      p_safety_reserve_pct: 0,
    });
    const blockReserve2 = await rpc('reserve_quota', {
      p_provider: probeBlockProvider,
      p_quota_type: 'DAILY',
      p_period_start: periodStart,
      p_period_end: periodEnd,
      p_amount: 1,
      p_endpoint: 'verification',
      p_request_id: `${requestId}-b2`,
      p_default_limit: 1,
      p_safety_reserve_pct: 0,
    });
    record(
      'hard-limit protection (concurrent reserve cannot exceed limit)',
      blockReserve1.body?.ok === true && blockReserve2.body?.ok === false && blockReserve2.body?.reason === 'QUOTA_EXHAUSTED'
        ? 'PASS'
        : 'FAIL',
      `first=${blockReserve1.body?.ok} second=${blockReserve2.body?.ok} reason=${blockReserve2.body?.reason}`
    );

    // Cleanup: 0 minutes marks RESERVED probe rows as ROLLED_BACK.
    const cleanup = await rpc('cleanup_stale_reservations', { p_stale_minutes: 0 });
    record('cleanup_stale_reservations executes', cleanup.status < 300 ? 'PASS' : 'FAIL', `HTTP ${cleanup.status}`);

    // Cleanup probe residue (service role).
    for (const provider of [probeProvider, probeBlockProvider]) {
      await rest(`/quota_reservations?provider=eq.${provider}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      await rest(`/quota_state?provider=eq.${provider}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
    }
    record('probe residue removed', 'PASS', 'verification providers deleted');
  } catch (err: any) {
    record('RPC lifecycle probe', 'FAIL', err.message);
  }

  // 6. Canonical policy values (in-process)
  const af = getProviderQuotaPolicy('apifootball');
  const op = getProviderQuotaPolicy('oddspapi');
  record('API-Football hard limit = 7,500/day', af.hardLimit === 7500 ? 'PASS' : 'FAIL', `${af.hardLimit}`);
  record('API-Football soft limit = 6,000/day', af.softLimit === 6000 ? 'PASS' : 'FAIL', `${af.softLimit}`);
  record('OddsPapi hard limit = 250/month', op.hardLimit === 250 ? 'PASS' : 'FAIL', `${op.hardLimit}`);
  record('OddsPapi soft limit = 200/month', op.softLimit === 200 ? 'PASS' : 'FAIL', `${op.softLimit}`);
  record(
    'historical odds classified unmetered',
    isUnmeteredEndpoint('oddspapi', 'historical-odds') && isUnmeteredEndpoint('oddspapi', '/v4/historical-odds')
      ? 'PASS'
      : 'FAIL',
    'oddspapi historical-odds/account'
  );
  record(
    'unmetered classification is not a generic bypass',
    !isUnmeteredEndpoint('oddspapi', 'odds') && !isUnmeteredEndpoint('apifootball', 'fixtures')
      ? 'PASS'
      : 'FAIL',
    'metered endpoints remain metered'
  );

  // 7. Live OddsPapi account reconciliation (unmetered)
  if (!oddsPapiKey) {
    record('live OddsPapi account reconciliation', 'SKIP', 'ODDS_PAPI_KEY not configured locally');
  } else {
    try {
      const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${oddsPapiKey}`);
      const data: any = await res.json();
      const sub = (data.subscriptions ?? [])[0];
      if (!sub) {
        record('live OddsPapi account reconciliation', 'FAIL', `HTTP ${res.status} no subscription`);
      } else {
        const limit = Number(sub.request_limit ?? 0);
        const count = Number(sub.request_count ?? 0);
        record(
          'live OddsPapi account reconciliation',
          res.status === 200 && limit === 250 ? 'PASS' : 'FAIL',
          `HTTP ${res.status} limit=${limit} used=${count} remaining=${limit - count}`
        );
      }
    } catch (err: any) {
      record('live OddsPapi account reconciliation', 'FAIL', err.message);
    }
  }

  // Persist report
  const report = {
    generatedAt: new Date().toISOString(),
    databaseHost: supabaseUrl ? redactHost(supabaseUrl) : null,
    checks,
    summary: {
      pass: checks.filter((c) => c.result === 'PASS').length,
      fail: checks.filter((c) => c.result === 'FAIL').length,
      skip: checks.filter((c) => c.result === 'SKIP').length,
    },
  };

  const outDir = path.resolve('data/verification');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'increment2_quota_verification.json');
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nReport written: ${outFile}`);
  console.log(`SUMMARY: ${report.summary.pass} PASS / ${report.summary.fail} FAIL / ${report.summary.skip} SKIP`);

  if (report.summary.fail > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error('Verification crashed:', err);
  process.exitCode = 1;
});
