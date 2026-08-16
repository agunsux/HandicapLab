// GET /api/v1/historical/status
// Fail-closed historical research status. Returns real Supabase Gold values
// when the credentialed DB is reachable, otherwise BLOCKED (CREDENTIAL_UNAVAILABLE
// or DB_QUERY_ERROR) with source-layer facts — never fake READY.
// Location: src/app/api/v1/historical/status/route.ts

import { getHistoricalStatus, type HistoricalDbProbe, type DbSnapshot } from '@/lib/historical/historicalResearchService';

export const dynamic = 'force-dynamic';

function makeDbProbe(): HistoricalDbProbe | undefined {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!key || !url) return undefined; // no credentialed environment → fail closed

  return async (): Promise<DbSnapshot> => {
    const base = `${url}/rest/v1`;
    const headers: Record<string, string> = { apikey: key, Authorization: `Bearer ${key}`, Accept: 'application/json' };
    const [manRes, covRes] = await Promise.all([
      fetch(`${base}/historical_dataset_manifest?select=*&limit=1`, { headers, cache: 'no-store' }),
      fetch(`${base}/gold_historical_coverage?select=*`, { headers, cache: 'no-store' }),
    ]);
    if (!manRes.ok || !covRes.ok) throw new Error(`gold query failed: ${manRes.status}/${covRes.status}`);
    const manifest = (await manRes.json()) as Array<Record<string, unknown>>;
    const coverage = (await covRes.json()) as DbSnapshot['coverageRows'];
    return { manifest: manifest[0] ?? null, coverageRows: coverage };
  };
}

export async function GET(): Promise<Response> {
  const payload = await getHistoricalStatus({ db: makeDbProbe() });
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}
