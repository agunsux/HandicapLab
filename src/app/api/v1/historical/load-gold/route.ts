// POST /api/v1/historical/load-gold
// Temporarily enables manual gold-layer data loading from production env credentials.
// Once the load is confirmed and verified, this route should be removed.
// Location: src/app/api/v1/historical/load-gold/route.ts

import { loadGoldLayer } from '@/historical/europe/goldDbLoader';

export const dynamic = 'force-dynamic';

export async function POST(): Promise<Response> {
  try {
    const result = await loadGoldLayer();
    return new Response(JSON.stringify({ ok: true, ...result }), {
      status: 200,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
    });
  }
}
