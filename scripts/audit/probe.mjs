// READ-ONLY provider health probe: 1 metadata request per provider max.
// Prints status codes and quota headers, never the keys themselves.
import 'dotenv/config';

async function probe(name, url, opts = {}) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, { ...opts, redirect: 'manual', signal: AbortSignal.timeout(15000) });
    const ms = Date.now() - t0;
    let quota = {};
    ['x-requests-remaining', 'x-requests-used', 'x-ratelimit-remaining', 'x-ratelimit-limit', 'retry-after', 'x-app-usage', 'x-app-limit'].forEach((h) => {
      const v = res.headers.get(h);
      if (v) quota[h] = v;
    });
    const text = (await res.text()).slice(0, 400);
    console.log(JSON.stringify({ provider: name, status: res.status, ms, quota, body: text }));
  } catch (e) {
    console.log(JSON.stringify({ provider: name, error: e.message }));
  }
}

const apiFootballKey = process.env.API_FOOTBALL_KEY || process.env.APIFOOTBALL_KEY;
const oddsKey = process.env.ODDSPAPI_KEY || process.env.ODDS_PAPI_KEY;
const theStatsKey = process.env.THESTATS_API_KEY;
const fdKey = process.env.FOOTBALL_DATA_API_KEY;

await probe('api-football-status', 'https://v3.football.api-sports.io/status', {
  headers: { 'x-apisports-key': apiFootballKey || '' },
});

await probe('the-odds-api-sports', `https://api.the-odds-api.com/v4/sports/?apiKey=${encodeURIComponent(oddsKey || '')}`);

await probe('oddspapi.io-host', 'https://api.oddspapi.io/v4/sports', {});

await probe('thestatsapi-root', `https://api.thestatsapi.com/v1/sports?apiKey=${encodeURIComponent(theStatsKey || '')}`);

await probe('football-data-status', 'https://api.football-data.org/v4/competitions', {
  headers: { 'X-Auth-Token': fdKey || '' },
});
