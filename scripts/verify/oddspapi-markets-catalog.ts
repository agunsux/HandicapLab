// Fetches and persists the OddsPapi market catalog (1 billable request).
// Market IDs are resolved from the live catalog; never hardcoded.
//
// Usage: npx tsx scripts/verify/oddspapi-markets-catalog.ts

import './_load-env';
import * as fs from 'fs';
import * as path from 'path';

const key = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '';

async function run(): Promise<void> {
  if (!key) {
    console.log('[SKIP] ODDS_PAPI_KEY not configured');
    return;
  }

  const res = await fetch(`https://api.oddspapi.io/v4/markets?language=en&apiKey=${key}`);
  console.log(`HTTP ${res.status}`);
  const body: any = await res.json();
  if (!res.ok) {
    console.log('error body:', JSON.stringify(body).slice(0, 300));
    process.exitCode = 1;
    return;
  }

  const cacheDir = path.resolve('data/cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const rawFile = path.join(cacheDir, 'oddspapi_markets_raw.json');
  fs.writeFileSync(rawFile, JSON.stringify(body, null, 2), 'utf-8');

  const markets = Array.isArray(body) ? body : body.markets ?? [];
  console.log(`markets: ${markets.length} (raw written: ${rawFile})`);

  const sampleIds = ['101', '104', '108', '1010', '1012', '1058'];
  for (const id of sampleIds) {
    const m = markets.find((x: any) => String(x.marketId) === id);
    if (m) {
      console.log(
        JSON.stringify({
          marketId: m.marketId,
          marketName: m.marketName,
          marketType: m.marketType,
          handicap: m.handicap,
          playerProp: m.playerProp,
          outcomes: (m.outcomes ?? []).map((o: any) => ({ id: o.outcomeId, name: o.outcomeName })),
        })
      );
    } else {
      console.log(`market ${id}: NOT FOUND in catalog`);
    }
  }
}

run().catch((err) => {
  console.error('Catalog fetch failed:', err.message);
  process.exitCode = 1;
});
