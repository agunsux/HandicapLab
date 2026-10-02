/**
 * ODDPAPI v4 — BATCH ODDS PARITY + QUOTA PROBE
 * --------------------------------------------------------------------------
 * Purpose (SALMO P0): decide whether `/v4/odds-by-tournaments` can replace the
 * per-fixture `/v4/fixtures` + N x `/v4/odds` fan-out used by the three live
 * pipeline services (AH / OU / BTTS), WITHOUT changing any market semantics.
 *
 * Method: deterministic A/B on the SAME fixtures
 *   PATH A (current production)  : /v4/fixtures?sportId=10&hasOdds=true  then
 *                                  /v4/odds?fixtureId=<id>  (one per fixture)
 *   PATH B (proposed)            : /v4/odds-by-tournaments?tournamentIds=<T>
 *                                  &bookmaker=<slug>  (one per bookmaker)
 *
 * Evidence discipline:
 *   - the API key is NEVER printed, and is stripped from every persisted URL
 *   - raw provider bodies are NOT persisted; only structural extracts
 *   - sequential calls with a delay to respect the 30 req/min account limit
 *   - writes a machine-readable artifact to data/research/provider_audit/
 *
 * Usage:
 *   npx tsx scripts/research/provider-final-audit/oddspapiBatchParityProbe.ts
 *   npx tsx scripts/research/provider-final-audit/oddspapiBatchParityProbe.ts --fixtures=2 --delay=2100
 */
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

const BASE = 'https://api.oddspapi.io/v4';
const KEY = (process.env.ODDS_PAPI_KEY || '').trim();
const OUT_DIR = path.resolve('data/research/provider_audit');
const MARKETS_DICT = path.resolve('data/cache/oddspapi_markets_raw.json');

const argNum = (name: string, fallback: number): number => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  if (!hit) return fallback;
  const n = Number(hit.split('=')[1]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const argStr = (name: string, fallback: string): string => {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

const DELAY_MS = argNum('delay', 2100);
const TARGET_FIXTURES = argNum('fixtures', 2);
/** Force a specific OddsPapi tournamentId (e.g. 17 = Premier League). */
const FORCE_TOURNAMENT = argNum('tournament', 0) || null;
/** Bookmakers to compare. The batch endpoint accepts exactly ONE per request. */
const BOOKMAKERS = argStr('bookmakers', 'pinnacle,sbobet')
  .split(',')
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);


const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Never leak the key: redact it from any string destined for disk or stdout. */
function redact(s: string): string {
  if (!KEY) return s;
  return s.split(KEY).join('<REDACTED_API_KEY>');
}

interface CallResult {
  label: string;
  endpoint: string;
  httpStatus: number;
  latencyMs: number;
  byteLength: number;
  error?: string;
  body: any;
}

const calls: CallResult[] = [];

/**
 * Perform one GET. `pathAndQuery` MUST NOT contain the key — it is appended
 * here and the recorded `endpoint` never contains it.
 */
async function call(label: string, pathAndQuery: string): Promise<CallResult> {
  const joiner = pathAndQuery.includes('?') ? '&' : '?';
  const url = `${BASE}${pathAndQuery}${joiner}apiKey=${encodeURIComponent(KEY)}`;
  const endpointWithQuery = pathAndQuery;
  const start = Date.now();
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    const text = await res.text();
    let body: any = null;
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
    const r: CallResult = {
      label,
      endpoint: redact(endpointWithQuery),
      httpStatus: res.status,
      latencyMs: Date.now() - start,
      byteLength: text.length,
      body,
    };
    calls.push(r);
    console.log(
      `  ${label.padEnd(34)} HTTP ${r.httpStatus}  ${String(r.latencyMs).padStart(5)}ms  ${r.byteLength} bytes`
    );
    return r;
  } catch (err) {
    const r: CallResult = {
      label,
      endpoint: redact(endpointWithQuery),
      httpStatus: 0,
      latencyMs: Date.now() - start,
      byteLength: 0,
      error: err instanceof Error ? err.message : String(err),
      body: null,
    };
    calls.push(r);
    console.log(`  ${label.padEnd(34)} NETWORK ERROR ${r.error}`);
    return r;
  }
}

/** Structural summary only — never a raw body. */
function shapeOf(v: any): any {
  if (v === null) return null;
  if (Array.isArray(v)) return { __array: true, length: v.length, itemKeys: v.length ? Object.keys(v[0] ?? {}) : [] };
  if (typeof v === 'object') return { __object: true, keys: Object.keys(v).slice(0, 40) };
  return typeof v;
}

interface QuotaSnapshot {
  httpStatus: number;
  request_limit: number | null;
  request_count: number | null;
  valid_until: string | null;
  is_active: boolean | null;
  bookmakerCount: number;
}

function quotaOf(r: CallResult): QuotaSnapshot | null {
  if (r.httpStatus !== 200 || !r.body?.subscriptions) return null;
  const s = r.body.subscriptions[0] ?? {};
  return {
    httpStatus: r.httpStatus,
    request_limit: s.request_limit ?? null,
    request_count: s.request_count ?? null,
    valid_until: s.valid_until ?? null,
    is_active: s.is_active ?? null,
    bookmakerCount: Object.keys(s.bookmakers ?? {}).length,
  };
}

// ─── Market dictionary (local cache; no provider call required) ───────────────
type MarketMeta = { marketId: number; marketName: string; marketType?: string; period?: string; handicap?: number };

function loadMarketDictionary(): Map<number, MarketMeta> {
  const map = new Map<number, MarketMeta>();
  if (!fs.existsSync(MARKETS_DICT)) return map;
  try {
    const raw = JSON.parse(fs.readFileSync(MARKETS_DICT, 'utf8')) as MarketMeta[];
    for (const m of raw) map.set(m.marketId, m);
  } catch {
    /* dictionary unavailable — market classification degrades to explicit unknown */
  }
  return map;
}

// ─── Canonical extraction / comparison ───────────────────────────────────────
interface OddPoint {
  price: number;
  changedAt: string | null;
  limit: number | null;
}
/** marketId -> outcomeId -> playerKey('0') -> OddPoint */
type OddsIndex = Record<string, Record<string, Record<string, OddPoint>>>;

/**
 * Extract a comparable odds index for ONE bookmaker from ONE fixture object.
 * Shape is identical for /v4/odds and /v4/odds-by-tournaments because both are
 * validated by NativeOddsFixtureSchema in the application.
 */
function extractBookmakerIndex(fixture: any, slug: string): OddsIndex | null {
  const book = fixture?.bookmakerOdds?.[slug];
  if (!book?.markets) return null;
  const out: OddsIndex = {};
  for (const [marketId, mData] of Object.entries<any>(book.markets)) {
    const outcomes: Record<string, Record<string, OddPoint>> = {};
    for (const [outcomeId, oData] of Object.entries<any>(mData?.outcomes ?? {})) {
      const players: Record<string, OddPoint> = {};
      for (const [playerKey, p] of Object.entries<any>(oData?.players ?? {})) {
        players[playerKey] = {
          price: p?.price ?? null,
          changedAt: p?.changedAt ?? null,
          limit: p?.limit ?? null,
        };
      }
      outcomes[outcomeId] = players;
    }
    out[marketId] = outcomes;
  }
  return out;
}

function bookmakerKeysOf(fixture: any): string[] {
  return Object.keys(fixture?.bookmakerOdds ?? {});
}

interface DiffResult {
  marketsCompared: number;
  pointsCompared: number;
  priceMatches: number;
  priceMismatches: number;
  changedAtMatches: number;
  changedAtMismatches: number;
  missingMarkets: string[];
  extraMarkets: string[];
  missingOutcomes: string[];
  extraOutcomes: string[];
}

function diffIndex(a: OddsIndex | null, b: OddsIndex | null): DiffResult {
  const d: DiffResult = {
    marketsCompared: 0,
    pointsCompared: 0,
    priceMatches: 0,
    priceMismatches: 0,
    changedAtMatches: 0,
    changedAtMismatches: 0,
    missingMarkets: [],
    extraMarkets: [],
    missingOutcomes: [],
    extraOutcomes: [],
  };
  const aMarkets = Object.keys(a ?? {});
  const bMarkets = Object.keys(b ?? {});
  d.marketsCompared = aMarkets.length;
  d.missingMarkets = aMarkets.filter((m) => !bMarkets.includes(m));
  d.extraMarkets = bMarkets.filter((m) => !aMarkets.includes(m));

  for (const m of aMarkets.filter((x) => bMarkets.includes(x))) {
    const aOut = a![m];
    const bOut = b![m];
    const aKeys = Object.keys(aOut);
    const bKeys = Object.keys(bOut);
    for (const o of aKeys.filter((x) => !bKeys.includes(x))) d.missingOutcomes.push(`${m}/${o}`);
    for (const o of bKeys.filter((x) => !aKeys.includes(x))) d.extraOutcomes.push(`${m}/${o}`);

    for (const o of aKeys.filter((x) => bKeys.includes(x))) {
      const aP = Object.keys(aOut[o]);
      const bP = Object.keys(bOut[o]);
      for (const p of aP.filter((x) => !bP.includes(x))) d.missingOutcomes.push(`${m}/${o}/${p}`);
      for (const p of bP.filter((x) => !aP.includes(x))) d.extraOutcomes.push(`${m}/${o}/${p}`);

      for (const pk of aP.filter((x) => bP.includes(x))) {
        d.pointsCompared++;
        if (aOut[o][pk].price === bOut[o][pk].price) d.priceMatches++;
        else d.priceMismatches++;
        if (aOut[o][pk].changedAt === bOut[o][pk].changedAt) d.changedAtMatches++;
        else d.changedAtMismatches++;
      }
    }
  }
  return d;
}

/** Classify which SALMO core markets are present in an index. */
function coreMarketCoverage(
  index: OddsIndex | null,
  dict: Map<number, MarketMeta>
): { asianHandicap: number; overUnder: number; btts: number; quarterLineAh: number; unknownMarketIds: number[] } {
  const res = { asianHandicap: 0, overUnder: 0, btts: 0, quarterLineAh: 0, unknownMarketIds: [] as number[] };
  for (const mId of Object.keys(index ?? {})) {
    const meta = dict.get(Number(mId));
    if (!meta) {
      res.unknownMarketIds.push(Number(mId));
      continue;
    }
    const name = (meta.marketName || '').toLowerCase();
    const period = (meta.period || '').toLowerCase();
    if (name === 'asian handicap' && (period === 'fulltime' || period === '')) {
      res.asianHandicap++;
      const h = Number(meta.handicap);
      if (Number.isFinite(h) && Math.abs(h * 4 - Math.round(h * 4)) === 0 && Math.abs(h * 2 - Math.round(h * 2)) !== 0) {
        res.quarterLineAh++;
      }
    } else if (name === 'over under full time') res.overUnder++;
    else if (name === 'both teams to score') res.btts++;
  }
  return res;
}


// ─── Main ────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  console.log('=== ODDPAPI v4 BATCH PARITY / QUOTA PROBE ===');
  console.log(`key: ${KEY ? `PRESENT (len=${KEY.length})` : 'ABSENT'}  delay=${DELAY_MS}ms  targets=${TARGET_FIXTURES}`);
  if (!KEY) {
    console.error('ODDS_PAPI_KEY absent — aborting.');
    process.exit(1);
  }

  const evidence: Record<string, any> = {
    timestampUtc: new Date().toISOString(),
    probe: 'oddspapi-v4-batch-parity',
    base: BASE,
    calls: [] as any[],
    quota: {} as any,
    parity: {} as any,
    verdict: {} as any,
  };

  // 1 ── quota before (declared unmetered by policy; verified empirically) ───
  const acctBefore = await call('account(before)', '/account');
  const qBefore = quotaOf(acctBefore);
  evidence.quota.before = qBefore;
  await sleep(DELAY_MS);

  // 2 ── PATH A step 1: legacy discovery (/v4/fixtures hasOdds=true) ────────
  const now = new Date();
  const fromStr = now.toISOString().slice(0, 10);
  const toStr = new Date(now.getTime() + 7 * 86400_000).toISOString().slice(0, 10);
  const fixRes = await call('fixtures(7d,hasOdds)', `/fixtures?sportId=10&from=${fromStr}&to=${toStr}&hasOdds=true`);
  const allFixtures: any[] = Array.isArray(fixRes.body) ? fixRes.body : [];
  await sleep(DELAY_MS);

  // Deterministic target selection: richest tournament, lowest fixtureId.
  const byTournament = new Map<number, any[]>();
  for (const f of allFixtures) {
    if (!f?.tournamentId) continue;
    if (!byTournament.has(f.tournamentId)) byTournament.set(f.tournamentId, []);
    byTournament.get(f.tournamentId)!.push(f);
  }
  const ranked = [...byTournament.entries()].sort((a, b) => b[1].length - a[1].length);
  const forced = FORCE_TOURNAMENT ? ranked.find(([tid]) => tid === FORCE_TOURNAMENT) : undefined;
  const selected = forced ?? ranked[0];
  const chosenTournamentId = selected?.[0] ?? FORCE_TOURNAMENT ?? null;
  const chosenTournamentName = selected?.[1]?.[0]?.tournamentName ?? null;
  const targetFixtures = (selected?.[1] ?? [])
    .slice()
    .sort((a, b) => String(a.fixtureId).localeCompare(String(b.fixtureId)))
    .slice(0, TARGET_FIXTURES);

  console.log(`\n  discovery: ${allFixtures.length} fixtures / ${byTournament.size} tournaments`);
  console.log(`  chosen tournament: ${chosenTournamentId} (${chosenTournamentName}) — ${selected?.[1]?.length ?? 0} discovery fixtures`);
  console.log(`  target fixtureIds: ${targetFixtures.map((f) => f.fixtureId).join(', ')}\n`);

  evidence.discovery = {
    fixturesWithOdds: allFixtures.length,
    tournaments: byTournament.size,
    chosenTournamentId,
    chosenTournamentName,
    targetFixtureIds: targetFixtures.map((f) => String(f.fixtureId)),
  };

  // 3 ── PATH A step 2: per-fixture /v4/odds (CURRENT PRODUCTION PATH) ──────
  const legacyByFixture = new Map<string, any>();
  for (const f of targetFixtures) {
    const r = await call(`odds?fixtureId=${f.fixtureId}`, `/odds?fixtureId=${f.fixtureId}`);
    const obj = Array.isArray(r.body) ? r.body[0] : r.body;
    if (obj) legacyByFixture.set(String(f.fixtureId), obj);
    await sleep(DELAY_MS);
  }

  // 4 ── PATH B: /v4/odds-by-tournaments (PROPOSED; exactly 1 bookmaker/req) ─
  const batchByBookmaker = new Map<string, Map<string, any>>();
  const batchIdentityFields: Record<string, string[]> = {};
  const batchIntrospection: Record<string, any> = {};
  for (const slug of BOOKMAKERS) {
    const r = await call(
      `odds-by-tournaments(${slug})`,
      `/odds-by-tournaments?tournamentIds=${chosenTournamentId}&bookmaker=${slug}&oddsFormat=decimal`
    );
    const arr = Array.isArray(r.body) ? r.body : r.body ? [r.body] : [];
    const m = new Map<string, any>();
    for (const fx of arr) if (fx?.fixtureId) m.set(String(fx.fixtureId), fx);
    batchByBookmaker.set(slug, m);
    const sample = arr[0];
    batchIdentityFields[slug] = sample
      ? ['fixtureId', 'tournamentId', 'participant1Name', 'participant2Name', 'startTime', 'sportId'].filter(
          (k) => sample[k] !== undefined && sample[k] !== null
        )
      : [];
    const errCode = r.body?.error?.code ?? r.body?.error_code ?? null;
    console.log(`    -> ${m.size} fixtures returned for ${slug}${errCode ? ` (errorCode=${errCode})` : ''}`);
    // Record the batch window actually returned (structural only).
    batchIntrospection[slug] = {
      httpStatus: r.httpStatus,
      errorCode: errCode,
      returnedCount: arr.length,
      returned: arr.slice(0, 80).map((fx: any) => ({
        fixtureId: String(fx.fixtureId),
        tournamentId: fx.tournamentId,
        startTime: fx.startTime,
        bookmakerKeys: Object.keys(fx.bookmakerOdds ?? {}),
      })),
    };
    await sleep(DELAY_MS);
  }

  // 5 ── quota after ────────────────────────────────────────────────────────
  const acctAfter = await call('account(after)', '/account');
  const qAfter = quotaOf(acctAfter);
  evidence.quota.after = qAfter;
  evidence.quota.meteredCallsObserved =
    qBefore && qAfter && qBefore.request_count !== null && qAfter.request_count !== null
      ? qAfter.request_count - qBefore.request_count
      : null;
  evidence.quota.requestsIssued = calls.length;

  // 6 ── PARITY ─────────────────────────────────────────────────────────────
  const dict = loadMarketDictionary();
  evidence.marketDictionarySize = dict.size;

  const parity: any = {
    fixturesCompared: 0,
    fixturesInBothPaths: 0,
    fixturesMissingFromBatch: [] as string[],
    fixturesAbsentInBothPaths: [] as string[],
    identity: { compared: 0, matches: 0, mismatches: [] as any[] },
    bookmakerPresence: {} as any,
    perBookmaker: {} as any,
  };

  for (const slug of BOOKMAKERS) {
    parity.perBookmaker[slug] = {
      fixturesCompared: 0,
      pointsCompared: 0,
      priceMatches: 0,
      priceMismatches: 0,
      changedAtMatches: 0,
      changedAtMismatches: 0,
      missingMarkets: [] as string[],
      extraMarkets: [] as string[],
      missingOutcomes: [] as string[],
      extraOutcomes: [] as string[],
      legacyCoreCoverage: null as any,
      batchCoreCoverage: null as any,
    };
  }

  for (const f of targetFixtures) {
    const id = String(f.fixtureId);
    parity.fixturesCompared++;

    let batchFixture: any = null;
    for (const slug of BOOKMAKERS) {
      const hit = batchByBookmaker.get(slug)?.get(id);
      if (hit) { batchFixture = hit; break; }
    }
    const legacyFixture = legacyByFixture.get(id);
    const legacyHasAnyConsumed = !!legacyFixture && BOOKMAKERS.some((s) => bookmakerKeysOf(legacyFixture).includes(s));

    if (!batchFixture) {
      // Not returned by the batch. Only a LOSS if the legacy path does carry one
      // of the bookmakers SALMO consumes; if both paths lack it, it is an
      // absent-by-design fixture and produces no prediction either way.
      if (legacyHasAnyConsumed) parity.fixturesMissingFromBatch.push(id);
      else parity.fixturesAbsentInBothPaths.push(id);
      continue;
    }
    parity.fixturesInBothPaths++;

    // Identity parity on the fields the pipelines actually consume.
    // participant1Name/participant2Name are NOT returned by the batch endpoint;
    // they are consumed from the retained /v4/fixtures discovery call and are
    // therefore recorded as a documented delta, not a blocker.
    parity.identity.compared++;
    const CORE_ID_FIELDS = ['fixtureId', 'tournamentId', 'startTime', 'sportId'];
    const NAME_ID_FIELDS = ['participant1Name', 'participant2Name'];
    const coreMismatch = CORE_ID_FIELDS
      .filter((k) => f[k] !== batchFixture[k])
      .map((k) => ({ field: k, legacy: f[k], batch: batchFixture[k] }));
    const nameDelta = NAME_ID_FIELDS.filter((k) => f[k] !== undefined && f[k] !== null && batchFixture[k] == null);
    if (coreMismatch.length === 0) parity.identity.matches++;
    else parity.identity.mismatches.push({ fixtureId: id, mismatch: coreMismatch });
    if (nameDelta.length) parity.identity.batchOmitsFields = nameDelta;

    const legacyKeys = bookmakerKeysOf(legacyFixture);
    parity.bookmakerPresence[id] = {
      legacyBookmakerCount: legacyKeys.length,
      legacyHasPinnacle: legacyKeys.includes('pinnacle'),
      legacyHasSbobet: legacyKeys.includes('sbobet'),
      batchBookmakers: BOOKMAKERS.filter((s) => batchByBookmaker.get(s)?.has(id)),
    };

    for (const slug of BOOKMAKERS) {
      const batchFxForSlug = batchByBookmaker.get(slug)?.get(id);
      const legacyIdx = extractBookmakerIndex(legacyFixture, slug);
      const batchIdx = extractBookmakerIndex(batchFxForSlug ?? batchFixture, slug);
      const p = parity.perBookmaker[slug];
      if (!legacyIdx && !batchIdx) continue;
      p.fixturesCompared++;
      const d = diffIndex(legacyIdx, batchIdx);
      p.pointsCompared += d.pointsCompared;
      p.priceMatches += d.priceMatches;
      p.priceMismatches += d.priceMismatches;
      p.changedAtMatches += d.changedAtMatches;
      p.changedAtMismatches += d.changedAtMismatches;
      p.missingMarkets.push(...d.missingMarkets.map((m: string) => `${id}:${m}`));
      p.extraMarkets.push(...d.extraMarkets.map((m: string) => `${id}:${m}`));
      p.missingOutcomes.push(...d.missingOutcomes.map((m: string) => `${id}:${m}`));
      p.extraOutcomes.push(...d.extraOutcomes.map((m: string) => `${id}:${m}`));
      p.legacyCoreCoverage = coreMarketCoverage(legacyIdx, dict);
      p.batchCoreCoverage = coreMarketCoverage(batchIdx, dict);
    }
  }

  evidence.parity = parity;

  // 6b ── IDENTITY FIELD AVAILABILITY (per path) ────────────────────────────
  const idProbe = ['fixtureId', 'tournamentId', 'participant1Name', 'participant2Name', 'startTime', 'sportId'];
  const present = (o: any) => idProbe.filter((k) => o?.[k] !== undefined && o?.[k] !== null);
  const legacyOddsSample = [...legacyByFixture.values()][0];
  evidence.identityFields = {
    legacyFixturesIndex: present(targetFixtures[0]),
    legacyOddsByFixture: present(legacyOddsSample),
    batchByBookmaker: batchIdentityFields,
    note: 'The pipelines consume participant1Name/participant2Name from /v4/fixtures for canonical matching; /v4/odds-by-tournaments omits them.',
  };
  evidence.batchIntrospection = batchIntrospection;

  // 6c ── BATCH COVERAGE OF THE 7-DAY DISCOVERY SET (decisive P0 metric) ────
  const tournamentDiscoveryIds = (selected?.[1] ?? []).map((f: any) => String(f.fixtureId));
  const coverage: Record<string, any> = {
    tournamentId: chosenTournamentId,
    discoveryFixtureCount: tournamentDiscoveryIds.length,
  };
  for (const slug of BOOKMAKERS) {
    const m = batchByBookmaker.get(slug)!;
    const covered = tournamentDiscoveryIds.filter((id) => m.has(id));
    const missing = tournamentDiscoveryIds.filter((id) => !m.has(id));
    coverage[slug] = {
      returnedByBatch: m.size,
      discoveryCovered: covered.length,
      discoveryMissing: missing.length,
      coveragePct: tournamentDiscoveryIds.length
        ? Number(((covered.length / tournamentDiscoveryIds.length) * 100).toFixed(1))
        : 0,
      missingSample: missing.slice(0, 40),
    };
  }
  evidence.batchCoverageOfDiscovery = coverage;
  console.log('\n=== BATCH COVERAGE OF 7-DAY DISCOVERY SET ===');
  console.log(`  tournament ${chosenTournamentId}: ${tournamentDiscoveryIds.length} discovery fixtures`);
  for (const slug of BOOKMAKERS) {
    const c = coverage[slug];
    console.log(`  [${slug}] batch=${c.returnedByBatch} covered=${c.discoveryCovered}/${tournamentDiscoveryIds.length} (${c.coveragePct}%) missing=${c.discoveryMissing}`);
  }
  console.log('\n=== IDENTITY FIELD AVAILABILITY ===');
  console.log(`  /v4/fixtures           : ${JSON.stringify(evidence.identityFields.legacyFixturesIndex)}`);
  console.log(`  /v4/odds?fixtureId=    : ${JSON.stringify(evidence.identityFields.legacyOddsByFixture)}`);
  for (const [slug, fields] of Object.entries(batchIdentityFields)) {
    console.log(`  /v4/odds-by-tourn [${slug}]: ${JSON.stringify(fields)}`);
  }

  // 6d ── BOOKMAKER-PRESENCE PARITY SWEEP (the true replacement test) ───────
  // The batch endpoint returns exactly the fixtures for which the requested
  // bookmaker has odds. This sweep proves the legacy per-fixture path agrees,
  // so replacing N x /v4/odds with M x /v4/odds-by-tournaments is lossless for
  // the bookmakers SALMO actually consumes.
  const SWEEP = process.argv.slice(2).some((a) => a.startsWith('--sweepPresence='))
    ? Number(argStr('sweepPresence', '1')) === 1
    : tournamentDiscoveryIds.length <= 12;

  const presenceParity: any = {
    swept: SWEEP,
    discoveryFixtures: tournamentDiscoveryIds.length,
    perBookmaker: {} as any,
  };

  if (SWEEP) {
    console.log('\n=== BOOKMAKER PRESENCE SWEEP ===');
    const legacyPresence = new Map<string, Record<string, boolean>>();
    for (const id of tournamentDiscoveryIds) {
      const rec: Record<string, boolean> = {};
      const already = legacyByFixture.get(id);
      if (already) {
        // Reuse the legacy payload already fetched for the parity targets — no
        // extra metered call.
        const keys = bookmakerKeysOf(already);
        for (const slug of BOOKMAKERS) rec[slug] = keys.includes(slug);
        legacyPresence.set(id, rec);
        continue;
      }
      const r = await call(`presence:odds?fixtureId=${id}`, `/odds?fixtureId=${id}`);
      const o = Array.isArray(r.body) ? r.body[0] : r.body;
      const keys = bookmakerKeysOf(o);
      for (const slug of BOOKMAKERS) rec[slug] = keys.includes(slug);
      legacyPresence.set(id, rec);
      await sleep(DELAY_MS);
    }

    for (const slug of BOOKMAKERS) {
      const m = batchByBookmaker.get(slug)!;
      const agg = { agreePresent: 0, agreeAbsent: 0, legacyOnly: [] as string[], batchOnly: [] as string[] };
      for (const id of tournamentDiscoveryIds) {
        const inBatch = m.has(id);
        const inLegacy = legacyPresence.get(id)?.[slug] ?? false;
        if (inBatch && inLegacy) agg.agreePresent++;
        else if (!inBatch && !inLegacy) agg.agreeAbsent++;
        else if (inLegacy && !inBatch) agg.legacyOnly.push(id);
        else agg.batchOnly.push(id);
      }
      presenceParity.perBookmaker[slug] = agg;
      console.log(
        `  [${slug}] both-present=${agg.agreePresent} both-absent=${agg.agreeAbsent} legacyOnly=${agg.legacyOnly.length} batchOnly=${agg.batchOnly.length}`
      );
    }
  }
  evidence.presenceParity = presenceParity;
  const presenceParityPass = !SWEEP
    ? null
    : BOOKMAKERS.every(
        (s) => presenceParity.perBookmaker[s].legacyOnly.length === 0 && presenceParity.perBookmaker[s].batchOnly.length === 0
      );

  // 7 ── VERDICT ────────────────────────────────────────────────────────────
  const sum = (fn: (p: any) => number) => BOOKMAKERS.reduce((a, s) => a + fn(parity.perBookmaker[s]), 0);
  const totalPriceMismatch = sum((p) => p.priceMismatches);
  const totalMissingMarkets = sum((p) => p.missingMarkets.length);
  const totalMissingOutcomes = sum((p) => p.missingOutcomes.length);
  const totalExtraMarkets = sum((p) => p.extraMarkets.length);
  const identityMismatch = parity.identity.mismatches.length;
  const coreMarketsPresentInBatch = BOOKMAKERS.some((s) => {
    const c = parity.perBookmaker[s].batchCoreCoverage;
    return !!c && (c.asianHandicap > 0 || c.overUnder > 0 || c.btts > 0);
  });

  const parityPass =
    parity.fixturesCompared > 0 &&
    parity.fixturesMissingFromBatch.length === 0 &&
    totalPriceMismatch === 0 &&
    totalMissingMarkets === 0 &&
    totalMissingOutcomes === 0 &&
    identityMismatch === 0;

  // Aggregated replacement safety: the batch must cover the FULL 7-day discovery
  // set for every compared bookmaker, otherwise the pipeline silently loses
  // fixtures it would otherwise have priced.
  const coverageComplete = BOOKMAKERS.every((s) => coverage[s].coveragePct === 100 && coverage[s].discoveryMissing === 0);

  evidence.verdict = {
    valueParityOnOverlap: parityPass,
    presenceParityPass,
    batchCoverageComplete: coverageComplete,
    fullWindowReplaceable: parityPass && presenceParityPass === true,
    identityMismatch,
    totalPriceMismatch,
    totalMissingMarkets,
    totalMissingOutcomes,
    totalExtraMarkets,
    coreMarketsPresentInBatch,
    meteredCallsThisProbe: evidence.quota.meteredCallsObserved,
  };

  // 8 ── persist sanitized evidence (no key, no raw bodies) ─────────────────
  evidence.calls = calls.map((c) => ({
    label: c.label,
    endpoint: c.endpoint,
    httpStatus: c.httpStatus,
    latencyMs: c.latencyMs,
    byteLength: c.byteLength,
    error: c.error ?? null,
    topLevelShape: shapeOf(c.body),
  }));

  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const outFile = path.join(OUT_DIR, `oddspapi_batch_parity_${ts}.json`);
  fs.writeFileSync(outFile, redact(JSON.stringify(evidence, null, 2)));

  console.log('\n=== QUOTA ===');
  console.log(`  before: ${JSON.stringify(qBefore)}`);
  console.log(`  after : ${JSON.stringify(qAfter)}`);
  console.log(`  metered delta observed: ${evidence.quota.meteredCallsObserved}  (issued ${calls.length} HTTP calls)`);
  console.log('\n=== PARITY ===');
  console.log(`  fixtures compared: ${parity.fixturesCompared}  in-both-paths: ${parity.fixturesInBothPaths}  lost-vs-legacy: ${parity.fixturesMissingFromBatch.length}  absent-in-both: ${parity.fixturesAbsentInBothPaths.length}`);
  console.log(`  identity mismatches: ${identityMismatch}`);
  for (const slug of BOOKMAKERS) {
    const p = parity.perBookmaker[slug];
    console.log(`  [${slug}] points=${p.pointsCompared} priceMismatch=${p.priceMismatches} changedAtMismatch=${p.changedAtMismatches} missingMarkets=${p.missingMarkets.length} missingOutcomes=${p.missingOutcomes.length}`);
    console.log(`      legacy core coverage: ${JSON.stringify(p.legacyCoreCoverage)}`);
    console.log(`      batch  core coverage: ${JSON.stringify(p.batchCoreCoverage)}`);
  }
  console.log(`\nVALUE PARITY ON OVERLAP : ${parityPass ? 'PASS' : 'FAIL'}`);
  console.log(`PRESENCE PARITY SWEEP   : ${presenceParityPass === null ? 'NOT RUN' : presenceParityPass ? 'PASS' : 'FAIL'}`);
  console.log(`FULL-WINDOW REPLACEABLE : ${parityPass && presenceParityPass === true ? 'YES' : 'NO'}`);
  console.log(`evidence written: ${outFile}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});



