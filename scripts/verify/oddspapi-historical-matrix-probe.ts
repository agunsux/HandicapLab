// Historical-odds coverage matrix probe (UNMETERED endpoint) — RAW HTTP.
// Uses direct fetch so the production circuit breaker does not mask provider
// responses during exploration. Read-only diagnostics: no quota consumption.
//
// Usage: npx tsx scripts/verify/oddspapi-historical-matrix-probe.ts

import './_load-env';
import * as fs from 'fs';
import * as path from 'path';

const BOOKMAKERS = ['pinnacle', 'singbet-d', 'ibcbet', 'circasports', 'matchbook', 'betdaq'];
const COOLDOWN_MS = 5200;

const key = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY || '';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function probe(fixtureId: string, bookmaker: string): Promise<{ status: number; observations: number; body: any }> {
  const url = `https://api.oddspapi.io/v4/historical-odds?fixtureId=${encodeURIComponent(fixtureId)}&bookmakers=${encodeURIComponent(bookmaker)}&apiKey=${key}`;
  const res = await fetch(url);
  const body: any = await res.json().catch(() => null);
  let observations = 0;
  if (res.ok && body?.bookmakers) {
    for (const book of Object.values(body.bookmakers) as any[]) {
      for (const market of Object.values(book.markets ?? {}) as any[]) {
        for (const outcome of Object.values(market.outcomes ?? {}) as any[]) {
          for (const entries of Object.values(outcome.players ?? {}) as any[]) {
            observations += Array.isArray(entries) ? entries.length : 1;
          }
        }
      }
    }
  }
  return { status: res.status, observations, body };
}

async function run(): Promise<void> {
  const fixtures = JSON.parse(
    fs.readFileSync(path.resolve('data/cache/oddspapi_pl_fixtures.json'), 'utf-8')
  ) as any[];

  const byMonth = new Map<string, any>();
  for (const f of fixtures.filter((x) => x.startTime >= '2026-01-01' && x.statusId === 2)) {
    const month = f.startTime.slice(0, 7);
    if (!byMonth.has(month)) byMonth.set(month, f);
  }
  const samples = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(0, 4);

  const results: Array<Record<string, unknown>> = [];
  let firstSuccess: { fixture: any; bookmaker: string; body: any } | null = null;

  for (const [month, fixture] of samples) {
    for (const bookmaker of BOOKMAKERS) {
      const r = await probe(fixture.fixtureId, bookmaker);
      const errorCode = r.body?.error?.code ?? null;
      results.push({
        month,
        fixtureId: fixture.fixtureId,
        bookmaker,
        status: r.status,
        errorCode,
        observations: r.observations,
      });
      console.log(
        `[${r.status}${errorCode ? ' ' + errorCode : ''}] ${month} ${fixture.participant1Name} vs ${fixture.participant2Name} | ${bookmaker} | obs=${r.observations}`
      );
      if (r.status === 200 && r.observations > 0 && !firstSuccess) {
        firstSuccess = { fixture, bookmaker, body: r.body };
      }
      await sleep(COOLDOWN_MS);
    }
  }

  const outDir = path.resolve('data/historical/oddspapi');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'coverage_matrix_probe.json'),
    JSON.stringify({ generatedAt: new Date().toISOString(), results }, null, 2),
    'utf-8'
  );

  if (firstSuccess) {
    const file = path.join(outDir, 'raw', `${firstSuccess.fixture.fixtureId}_${firstSuccess.bookmaker}.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(firstSuccess.body, null, 2), 'utf-8');
    console.log(`\nFirst successful payload written: ${file}`);
    const book = firstSuccess.body.bookmakers?.[firstSuccess.bookmaker];
    const marketKeys = Object.keys(book?.markets ?? {});
    console.log(`markets returned: ${JSON.stringify(marketKeys.slice(0, 20))}`);
    const firstMarket = book?.markets?.[marketKeys[0]];
    console.log(`market ${marketKeys[0]} keys: ${JSON.stringify(Object.keys(firstMarket ?? {}))}`);
    const firstOutcome = firstMarket?.outcomes?.[Object.keys(firstMarket.outcomes ?? {})[0]];
    console.log(`outcome keys: ${JSON.stringify(Object.keys(firstOutcome ?? {}))}`);
  } else {
    console.log('\nNO bookmaker returned historical odds for the sampled fixtures.');
  }
}

run().catch((err) => {
  console.error('Matrix probe failed:', err.message);
  process.exitCode = 1;
});
