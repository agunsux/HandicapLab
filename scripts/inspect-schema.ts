import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

async function check() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(url + '/rest/v1/', {
    headers: { apikey: key || '', Authorization: 'Bearer ' + (key || '') }
  });
  const spec = await res.json();
  console.log('Tables:', Object.keys(spec.definitions || {}));
  console.log('RPCs:', Object.keys(spec.paths || {}).filter(p => p.startsWith('/rpc/')));
}
check().catch(console.error);
