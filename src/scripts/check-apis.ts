import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const apiFootballKey = process.env.API_FOOTBALL_KEY;
const oddsPapiKey = process.env.ODDSPAPI_KEY;

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
