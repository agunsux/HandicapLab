import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiFootballKey = process.env.API_FOOTBALL_KEY;
const oddsPapiKey = process.env.ODDSPAPI_KEY;

/**
 * [NON-PRODUCTION / QUARANTINED SCRIPT]
 * P0 Invariant: Direct manual probes are strictly quarantined to prevent unmetered API calls.
 * Must NOT be run in automated workflows, CI, or production.
 */
if (!process.argv.includes('--allow-manual-probe')) {
  console.error('[GATEWAY_SAFETY_ERROR] Direct provider probes are quarantined per P0 safety policy.');
  console.error('To run explicitly for diagnostic inspection, provide: --allow-manual-probe');
  process.exit(1);
}

async function checkApis() {
  console.log('--- API HEALTH ---');
  if (apiFootballKey) {
    try {
      const res = await fetch('https://v3.football.api-sports.io/status', {
        headers: { 'x-apisports-key': apiFootballKey }
      });
      const data = await res.json();
      console.log('API-Football:', data.errors.length > 0 ? data.errors : 'OK (Valid Key)');
      console.log('Account Info:', data.response?.account || 'N/A');
    } catch (e) {
      console.log('API-Football Error:', (e as Error).message);
    }
  } else {
    console.log('API-Football: No Key');
  }

  if (process.env.ODDSPAPI_KEY) {
    try {
      const res = await fetch(`https://api.oddspapi.com/v1/status?apikey=${process.env.ODDSPAPI_KEY}`);
      const data = await res.json();
      console.log('OddsPAPI Status:', res.status, data);
    } catch (e) {
      console.log('OddsPAPI Error:', (e as Error).message);
    }
  } else {
    console.log('OddsPAPI: No Key');
  }
}

checkApis().catch(console.error);
