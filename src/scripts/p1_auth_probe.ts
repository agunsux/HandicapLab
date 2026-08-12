import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env' });

async function runProbe() {
  console.log('HANDICAP_LAB — PHASE E ODDSPAPI AUTHENTICATION GATE');
  
  const key = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  if (!key || key.length === 0) {
    console.log('');
    console.log('ODDSPAPI CREDENTIAL:');
    console.log('MISSING');
    process.exit(1);
  }

  console.log('[PROBE] Validating credential against OddsPAPI /sports endpoint...');
  
  // Updated to the official v4 endpoint
  const url = `https://api.oddspapi.io/v4/sports?apiKey=${key}`;
  
  try {
    const res = await fetch(url);
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        console.log('INVALID_API_KEY');
      } else if (res.status === 429) {
        console.log('QUOTA_EXHAUSTED');
      } else {
        console.log(`HTTP_${res.status}`);
      }
      console.log(`Error details: ${res.status} ${res.statusText}`);
      
      const body = await res.text();
      console.log(`Provider response message: ${body}`);
      
      process.exit(1);
    }
    
    // Auth passed
    console.log('');
    console.log('ODDSPAPI AUTHENTICATION:');
    console.log('PASS');
    console.log('');
    console.log('API CALLS:');
    console.log('1');
    console.log('');
    
    let remaining = res.headers.get('x-ratelimit-remaining');
    let total = res.headers.get('x-ratelimit-limit');
    let quotaStr = 'UNKNOWN';
    if (total && remaining) {
       quotaStr = `${parseInt(total, 10) - parseInt(remaining, 10)} / ${total}`;
    }
    
    console.log('QUOTA CONSUMED:');
    console.log(quotaStr);
    
  } catch (error: any) {
    console.log('unexpected provider error');
    console.error(error.message);
    process.exit(1);
  }
}

runProbe();
