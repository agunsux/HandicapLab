import { supabase } from '../lib/supabase.server';

async function main() {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  console.log('Fetching OpenAPI spec...');
  try {
    const res = await fetch(url, {
      headers: {
        'apikey': key!,
        'Authorization': `Bearer ${key}`
      }
    });
    if (res.ok) {
      const data = await res.json() as any;
      console.log('Tables defined in schema:', Object.keys(data.definitions));
    } else {
      console.log('Failed:', await res.text());
    }
  } catch (err: any) {
    console.error('Error:', err);
  }
}

main();
