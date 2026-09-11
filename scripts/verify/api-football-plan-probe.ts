// ============================================================================
// API-FOOTBALL PLAN PROBE (1 metered request)
// ============================================================================
// Calls /status and prints the provider-reported plan, subscription and the
// rate-limit headers that the ProviderGateway uses to reconcile quota_state.
// No secrets are printed.
//
// Usage: npx tsx scripts/verify/api-football-plan-probe.ts

import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const key = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY || '';

async function run(): Promise<void> {
  if (!key) {
    console.log('[SKIP] APIFOOTBALL_KEY not configured');
    return;
  }

  const res = await fetch('https://v3.football.api-sports.io/status', {
    headers: { 'x-apisports-key': key },
  });

  console.log(`HTTP ${res.status}`);
  const relevantHeaders: Record<string, string> = {};
  res.headers.forEach((value, name) => {
    if (name.toLowerCase().includes('ratelimit') || name.toLowerCase().includes('rate-limit')) {
      relevantHeaders[name] = value;
    }
  });
  console.log('rate-limit headers:', JSON.stringify(relevantHeaders));

  const json: any = await res.json();
  console.log('account:', JSON.stringify(json?.response?.account ?? null));
  console.log('subscription:', JSON.stringify(json?.response?.subscription ?? null));
  console.log('requests:', JSON.stringify(json?.response?.requests ?? null));
}

run().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exitCode = 1;
});
