import 'dotenv/config';

async function main() {
  const apiKey = process.env.API_FOOTBALL_KEY;
  console.log(`Checking API-Football status with key: ${apiKey}`);
  
  const urls = [
    'https://v3.football.api-sports.io/status',
    'https://api-football-v1.p.rapidapi.com/v3/status'
  ];

  for (const url of urls) {
    try {
      const headers: Record<string, string> = {};
      if (url.includes('rapidapi')) {
        headers['x-rapidapi-key'] = apiKey || '';
        headers['x-rapidapi-host'] = 'api-football-v1.p.rapidapi.com';
      } else {
        headers['x-apisports-key'] = apiKey || '';
      }
      
      const res = await fetch(url, { method: 'GET', headers });
      console.log(`URL: ${url}`);
      console.log(`Status: ${res.status} ${res.statusText}`);
      const data = await res.json();
      console.log('Response:', data);
    } catch (e) {
      console.error(`Error for ${url}:`, e);
    }
  }
}

main();
