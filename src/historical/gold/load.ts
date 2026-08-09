import 'dotenv/config';
import type { RawMatchRow } from '../types';

const BASE = process.env.SUPABASE_URL + '/rest/v1';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

export async function loadRawMatches(): Promise<RawMatchRow[]> {
  const rows: RawMatchRow[] = [];
  let offset = 0;
  const LIMIT = 1000;
  for (;;) {
    const qs = new URLSearchParams({ select: '*', limit: String(LIMIT), offset: String(offset), order: 'id.asc' });
    const res = await fetch(`${BASE}/raw_matches?${qs}`, {
      headers: { apikey: KEY ?? '', Authorization: `Bearer ${KEY ?? ''}`, Accept: 'application/json', Prefer: 'count=exact' },
    });
    if (!res.ok) throw new Error(`raw_matches fetch failed: ${res.status} ${await res.text()}`);
    const batch = (await res.json()) as RawMatchRow[];
    rows.push(...batch);
    const cr = res.headers.get('content-range') || '';
    const m = cr.match(/\/(\d+)$/);
    const total = m ? Number(m[1]) : batch.length;
    if (batch.length < LIMIT || rows.length >= total) break;
    offset += LIMIT;
  }
  return rows;
}
