// Structure probe for /v4/historical-odds (UNMETERED). Dumps one real provider
// payload and prints its structural shape so normalization can be built against
// the actual contract instead of assumptions.
//
// Usage: npx tsx scripts/verify/oddspapi-historical-probe.ts

import './_load-env';
import * as fs from 'fs';
import * as path from 'path';
import { NativeOddsClient } from '../../src/lib/data/providers/odds/native/client';

async function run(): Promise<void> {
  const fixturesFile = path.resolve('data/cache/oddspapi_pl_fixtures.json');
  const fixtures = JSON.parse(fs.readFileSync(fixturesFile, 'utf-8'));
  const sample = fixtures
    .filter((f: any) => f.startTime >= '2026-01-01' && f.statusId === 2)
    .sort((a: any, b: any) => a.startTime.localeCompare(b.startTime))[0];

  if (!sample) {
    console.log('No 2026 finished fixture in cache');
    return;
  }

  console.log(`fixture: ${sample.fixtureId} ${sample.startTime} ${sample.participant1Name} vs ${sample.participant2Name}`);

  const client = new NativeOddsClient();
  const response: any = await client.fetchHistoricalOdds({
    fixtureId: sample.fixtureId,
    // betfair-ex is an exchange: the provider requires exactly one bookmaker
    // and one outcomeId per request, so the sample starts with non-exchange
    // sharp books available in the subscription.
    bookmakers: ['singbet-d', 'ibcbet'],
  });

  const outDir = path.resolve('data/historical/oddspapi/raw');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${sample.fixtureId}.json`);
  fs.writeFileSync(outFile, JSON.stringify(response, null, 2), 'utf-8');
  console.log(`raw written: ${outFile} (${fs.statSync(outFile).size} bytes)`);

  const bookmakers = Object.keys(response.bookmakers ?? {});
  console.log('bookmakers:', JSON.stringify(bookmakers));

  for (const bm of bookmakers) {
    const book = response.bookmakers[bm];
    console.log(`  [${bm}] book keys: ${JSON.stringify(Object.keys(book))}`);
    const markets = book.markets ?? {};
    for (const marketKey of Object.keys(markets).slice(0, 6)) {
      const market = markets[marketKey];
      console.log(`    market ${marketKey} keys: ${JSON.stringify(Object.keys(market))}`);
      const outcomes = market.outcomes ?? {};
      for (const outcomeKey of Object.keys(outcomes).slice(0, 4)) {
        const outcome = outcomes[outcomeKey];
        console.log(`      outcome ${outcomeKey} keys: ${JSON.stringify(Object.keys(outcome))}`);
        const players = outcome.players ?? {};
        for (const playerKey of Object.keys(players).slice(0, 2)) {
          const entries = Array.isArray(players[playerKey]) ? players[playerKey] : [players[playerKey]];
          const first = entries[0];
          const last = entries[entries.length - 1];
          console.log(
            `        player ${playerKey}: n=${entries.length} first=${JSON.stringify(first)} last=${JSON.stringify(last)}`
          );
        }
      }
    }
  }
}

run().catch((err) => {
  console.error('Probe failed:', err.message);
  process.exitCode = 1;
});
