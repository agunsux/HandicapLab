// READ-ONLY audit helper: queries Supabase via PostgREST with service role key.
// Never prints secrets. Only issues GET requests.
import 'dotenv/config';

const BASE = process.env.SUPABASE_URL + '/rest/v1';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

if (!KEY || KEY.length < 20) {
  console.error('MISSING_SERVICE_KEY');
  process.exit(1);
}

async function get(path, params, prefer = 'count=exact') {
  const qs = new URLSearchParams(params);
  const url = `${BASE}${path}${qs.toString() ? '?' + qs.toString() : ''}`;
  const res = await fetch(url, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
      Prefer: prefer,
    },
  });
  if (!res.ok) {
    return { error: res.status, body: (await res.text()).slice(0, 300) };
  }
  const cr = res.headers.get('content-range') || '';
  const m = cr.match(/\*\/(\d+)/);
  const count = m ? Number(m[1]) : null;
  const body = await res.json();
  return { data: body, count };
}

export async function listTables() {
  const r = await get('/', {}, '');
  if (r.error) return { error: r.error, body: r.body };
  const names = (r.data?.definitions ? Object.keys(r.data.definitions) : []);
  return { tables: names.filter((n) => !n.startsWith('_') && !n.includes('schemata')) };
}

export async function rawGet(path, params = {}, prefer = 'count=exact') {
  return get(path, params, prefer);
}

if (process.argv[1] && process.argv[1].endsWith('db.mjs')) {
  const cmd = process.argv[2];
  if (cmd === 'tables') {
    const r = await listTables();
    console.log(JSON.stringify(r));
  } else if (cmd === 'count') {
    const r = await get(`/${process.argv[3]}`, { select: 'id', limit: '0' });
    console.log(JSON.stringify({ count: r.count, error: r.error, body: r.body }));
  }
}
