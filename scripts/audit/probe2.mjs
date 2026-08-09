// READ-ONLY provider health probe v2 — checks every key variant, never prints keys.
import 'dotenv/config';

async function probe(name, url, opts = {}, headersToRead = []) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - t0;
    const quota = {};
    headersToRead.forEach((h) => {
      const v = res.headers.get(h);
      if (v) quota[h] = v;
    });
    const text = (await res.text()).slice(0, 300);
    console.log(JSON.stringify({ provider: name, status: res.status, ms, quota, body: text }));
  } catch (e) {
    console.log(JSON.stringify({ provider: name, error: e.message }));
  }
}

const vars = {
  apifootball: process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY || '',
  oddsPapi36: process.env.ODDSPAPI_KEY || process.env.ODDS_PAPI_KEY || '',
  theOddsApi22: process.env.NEXT_PUBLIC_THE_ODDS_API_KEY || process.env.VITE_THE_ODDS_API_KEY || '',
  theStats: process.env.THESTATS_API_KEY || process.env.NEXT_PUBLIC_THESTATS_API_KEY || '',
  footballData: process.env.FOOTBALL_DATA_API_KEY || process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || process.env.VITE_FOOTBALL_DATA_API_KEY || '',
};
console.log(JSON.stringify({ keyLengths: {
  apifootball: vars.apifootball.length,
  oddsPapi36: vars.oddsPapi36.length,
  theOddsApi22: vars.theOddsApi22.length,
  theStats: vars.theStats.length,
  footballData: vars.footballData.length,
}}));

// 1. API-Football /status (already verified 200, skip re-probe)
// 2. The Odds API with both candidate keys
await probe('the-odds-api-key-36', `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(vars.oddsPapi36)}`, {}, ['x-requests-remaining', 'x-requests-used']);
await probe('the-odds-api-key-22', `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(vars.theOddsApi22)}`, {}, ['x-requests-remaining', 'x-requests-used']);
// 3. OddsPapi.io with the 36-char key (is ODDSPAPI_KEY an OddsPapi.io key?)
await probe('oddspapi-io-with-key', `https://api.oddspapi.io/v4/sports?apiKey=${encodeURIComponent(vars.oddsPapi36)}`, {}, []);
// 4. TheStatsAPI with its key on likely routes
await probe('thestatsapi-v1-leagues', `https://api.thestatsapi.com/v1/leagues?apiKey=${encodeURIComponent(vars.theStats)}`, {}, []);
// 5. Football-Data.org with explicit invalid token to test if 200 was auth-free
await probe('football-data-invalid-token', 'https://api.football-data.org/v4/competitions', { headers: { 'X-Auth-Token': 'invalid-token-000' } }, []);
// 6. Football-Data.org with the actual configured key
await probe('football-data-real-key', 'https://api.football-data.org/v4/competitions', { headers: { 'X-Auth-Token': vars.footballData } }, ['x-requests-remaining', 'x-requests-used']);
