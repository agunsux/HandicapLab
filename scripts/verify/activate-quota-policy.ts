// ============================================================================
// INCREMENT 2 — ACTIVATE QUOTA POLICY ALIGNMENT (data-only)
// ============================================================================
// The Increment 1 migration 20260911000000_quota_policy_pro_hard_soft.sql
// contains two parts:
//   1. UPDATE quota_state → hard-limit semantics (safe_limit = limit_value,
//      safety_reserve_pct = 0)
//   2. NOTIFY pgrst (schema cache refresh — unnecessary here; RPCs already
//      visible per the verification probe)
//
// When the migration cannot be applied via DDL (no database password), part 1
// can be executed through the PostgREST API with the service role. This script
// performs exactly that data update, row by row, with an audit log. It never
// touches schema or RPC definitions.
//
// Usage: npx tsx scripts/verify/activate-quota-policy.ts

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';

interface QuotaRow {
  provider: string;
  quota_type: string;
  period_start: string;
  limit_value: number;
  safe_limit: number;
  safety_reserve_pct: number;
}

async function rest(endpoint: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
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
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep text
  }
  return { status: res.status, body };
}

async function run(): Promise<void> {
  if (!supabaseUrl || !serviceKey) {
    console.error('FAIL: Supabase URL/service key missing. Nothing changed.');
    process.exitCode = 1;
    return;
  }

  const list = await rest(
    '/quota_state?select=provider,quota_type,period_start,limit_value,safe_limit,safety_reserve_pct'
  );
  if (list.status !== 200) {
    console.error(`FAIL: could not read quota_state (HTTP ${list.status}). Nothing changed.`);
    process.exitCode = 1;
    return;
  }

  const rows = (list.body as QuotaRow[]) ?? [];
  const misaligned = rows.filter(
    (r) => Number(r.safe_limit) !== Number(r.limit_value) || Number(r.safety_reserve_pct) !== 0
  );

  console.log(`quota_state rows: ${rows.length}; misaligned: ${misaligned.length}`);

  let updated = 0;
  for (const row of misaligned) {
    const filter = `provider=eq.${encodeURIComponent(row.provider)}&quota_type=eq.${encodeURIComponent(
      row.quota_type
    )}&period_start=eq.${encodeURIComponent(row.period_start)}`;
    const patch = await rest(`/quota_state?${filter}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({
        safety_reserve_pct: 0,
        safe_limit: row.limit_value,
        updated_at: new Date().toISOString(),
      }),
    });
    if (patch.status >= 200 && patch.status < 300) {
      updated += 1;
      console.log(
        `  aligned ${row.provider} ${row.quota_type} ${row.period_start}: safe_limit ${row.safe_limit} -> ${row.limit_value}, reserve ${row.safety_reserve_pct}% -> 0%`
      );
    } else {
      console.error(`  FAILED ${row.provider} ${row.quota_type}: HTTP ${patch.status} ${JSON.stringify(patch.body).slice(0, 160)}`);
      process.exitCode = 1;
    }
  }

  const verify = await rest('/quota_state?select=provider,safe_limit,limit_value,safety_reserve_pct');
  const remaining = ((verify.body as QuotaRow[]) ?? []).filter(
    (r) => Number(r.safe_limit) !== Number(r.limit_value) || Number(r.safety_reserve_pct) !== 0
  );
  console.log(`updated: ${updated}; still misaligned: ${remaining.length}`);
  if (remaining.length > 0) process.exitCode = 1;
}

run().catch((err) => {
  console.error('Activation crashed:', err);
  process.exitCode = 1;
});
