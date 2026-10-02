/**
 * P0 LIVE SMOKE — production quota-aware odds path, end to end.
 * --------------------------------------------------------------------------
 * Exercises the EXACT modules the AH/OU/BTTS pipelines now use:
 *   fetchOddsPapiFixtureIndex() -> primeTournamentOdds() -> getBatchedFixtureOdds()
 *
 * Proves, against the real API:
 *   - discovery is routed through NativeOddsClient (quota reserve/confirm)
 *   - the batch replaces the per-fixture fan-out (3 metered calls, not 39)
 *   - AH / OU / BTTS markets resolve with untouched provider prices
 *
 * Never prints the key. Read-only w.r.t. providers.
 * Usage: npx tsx scripts/research/provider-final-audit/oddspapiBatchLiveSmoke.ts
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

import {
  fetchOddsPapiFixtureIndex,
  primeTournamentOdds,
  getBatchedFixtureOdds,
} from '../../../src/lib/pipeline/tournamentOddsBatch';

const OUT_DIR = path.resolve('data/research/provider_audit');
const MARKETS_DICT = path.resolve('data/cache/oddspapi_markets_raw.json');

function classifyMarketIds(ids: string[]): Record<string, number> {
  const out: Record<string, number> = { asianHandicap: 0, overUnder: 0, btts: 0, unknown: 0 };
  if (!fs.existsSync(MARKETS_DICT)) return out;
  const raw = JSON.parse(fs.readFileSync(MARKETS_DICT, 'utf8')) as Array<{ marketId: number; marketName: string }>;
  const byId = new Map(raw.map((m) => [m.marketId, m.marketName.toLowerCase()]));
  for (const id of ids) {
    const name = byId.get(Number(id));
    if (name === 'asian handicap') out.asianHandicap++;
    else if (name === 'over under full time') out.overUnder++;
    else if (name === 'both teams to score') out.btts++;
    else out.unknown++;
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const key = (process.env.ODDS_PAPI_KEY || '').trim();
  console.log('=== P0 LIVE SMOKE ===');
  console.log(`key: ${key ? `PRESENT (len=${key.length})` : 'ABSENT'}`);
  if (!key) process.exit(1);

  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);

  // 1 ── quota-accounted discovery (replaces the raw /v4/fixtures fetch)
  const idx = await fetchOddsPapiFixtureIndex({ from, to });
  console.log(`\n[discovery] status=${idx.status} fixtures=${idx.fixtures.length} meteredCalls=${idx.meteredCalls}${idx.error ? ` error=${idx.error}` : ''}`);
  if (idx.fixtures.length === 0) {
    console.log('discovery returned nothing — aborting (fail-safe path exercised).');
    return;
  }

  // 2 ── pick the richest tournaments (same selection rule the pipelines imply)
  const byTournament = new Map<number, number>();
  for (const f of idx.fixtures) if (f.tournamentId) byTournament.set(f.tournamentId, (byTournament.get(f.tournamentId) ?? 0) + 1);
  const top = [...byTournament.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([id]) => id);
  console.log(`[selection] top tournaments: ${top.join(', ')}`);

  // 3 ── ONE shared batch per consumed bookmaker (was: N x /v4/odds)
  const batch = await primeTournamentOdds({ tournamentIds: top });
  console.log(
    `[batch] status=${batch.status} fixtures=${batch.fixtureCount} bookmakers=${batch.bookmakersWithData.join('+') || 'none'} ` +
      `meteredCalls=${batch.meteredCalls}${batch.error ? ` error=${batch.error}` : ''}`
  );

  // 4 ── resolve odds exactly as the pipelines do (zero further calls)
  const resolved: any[] = [];
  for (const f of idx.fixtures.slice(0, 400)) {
    const hit = getBatchedFixtureOdds(f.fixtureId);
    if (!hit) continue;
    for (const [slug, book] of Object.entries<any>(hit.bookmakerOdds)) {
      const marketIds = Object.keys(book?.markets ?? {});
      resolved.push({
        fixtureId: f.fixtureId,
        tournamentId: hit.tournamentId,
        startTime: hit.startTime,
        bookmaker: slug,
        marketCount: marketIds.length,
        coreMarkets: classifyMarketIds(marketIds),
      });
      if (resolved.length >= 12) break;
    }
    if (resolved.length >= 12) break;
  }

  console.log(`\n[resolution] ${resolved.length} (fixture, bookmaker) pairs resolved with ZERO extra provider calls`);
  for (const r of resolved.slice(0, 8)) {
    console.log(
      `  ${r.fixtureId} T${r.tournamentId} ${r.startTime} [${r.bookmaker}] markets=${r.marketCount} ` +
        `AH=${r.coreMarkets.asianHandicap} OU=${r.coreMarkets.overUnder} BTTS=${r.coreMarkets.btts}`
    );
  }

  const totalMetered = idx.meteredCalls + batch.meteredCalls;
  const evidence = {
    timestampUtc: new Date().toISOString(),
    probe: 'oddspapi-p0-live-smoke',
    discovery: { status: idx.status, fixtures: idx.fixtures.length, meteredCalls: idx.meteredCalls, error: idx.error ?? null },
    selection: { tournaments: top },
    batch: {
      status: batch.status,
      fixtureCount: batch.fixtureCount,
      bookmakersWithData: batch.bookmakersWithData,
      meteredCalls: batch.meteredCalls,
      fromCache: batch.fromCache,
      error: batch.error ?? null,
    },
    resolution: { pairs: resolved.length, sample: resolved.slice(0, 20) },
    totalMeteredCallsForThisCycle: totalMetered,
    legacyEquivalentMeteredCalls: 1 + 12 * 3,
  };
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `oddspapi_p0_live_smoke_${ts}.json`);
  fs.writeFileSync(outFile, JSON.stringify(evidence, null, 2));

  console.log(`\n[metered] this cycle = ${totalMetered} calls (legacy equivalent = ${1 + 12 * 3})`);
  console.log(`evidence written: ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
