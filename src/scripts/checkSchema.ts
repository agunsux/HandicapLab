const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function checkSchema() {
  console.log('Fetching schema from:', supabaseUrl);
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${supabaseAnonKey}`
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }
    const data = await res.json() as any;
    console.log('Available tables/routes:');
    const paths = Object.keys(data.paths || {});
    paths.forEach(p => console.log('  -', p));
  } catch (error: any) {
    console.error('Error fetching schema:', error.message);
  }
}

checkSchema();
