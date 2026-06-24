import 'dotenv/config';

async function main() {
  const ref = 'rgkrfzxipkrwqccfuqfq';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  console.log('Using Key:', key?.substring(0, 10) + '...');
  
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/sql`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: 'SELECT 1 as num;' })
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Response:', text);
  } catch (err) {
    console.error(err);
  }
}

main();
