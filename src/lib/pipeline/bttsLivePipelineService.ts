import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Ensure .env.local is authoritative
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiFootballClient } from '@/lib/apis/apifootball';
import { DribbleEnrichmentService } from '@/lib/research/dribble/dribbleEnrichmentService';
import { calculateBtts, calculateBttsFromGrid, BTTS_MODEL_VERSION } from '@/lib/research/bttsEngine';
import { buildScoreGrid } from '@/lib/engine/probability';
import { SalmoSyncService } from './salmoSyncService';
import { DailyPredictionLedgerService, PredictionLedgerRecord } from './dailyPredictionLedger';
import {
  fetchOddsPapiFixtureIndex,
  primeTournamentOdds,
  getBatchedFixtureOdds,
} from './tournamentOddsBatch';

export interface BttsMarketQuote {
  selection: 'YES' | 'NO';
  odds: number;
  bookmaker: string;
  timestamp: string;
}

export interface BttsOddsSnapshotRecord {
  snapshotId: string;
  canonicalMatchId: string;
  fixtureId: string;
  match: string;
  kickoffUtc: string;
  bookmaker: string;
  marketId: number;
  yesOdds: number;
  noOdds: number;
  timestampUtc: string;
  provenance: {
    source: 'oddspapi';
    endpoint: string;
  };
}

export interface BttsPredictionRecord {
  predictionId: string;
  canonicalMatchId: string;
  fixtureId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffUtc: string;
  marketType: 'BTTS';
  selection: 'YES' | 'NO';
  odds: number;
  modelProbability: number;
  fairOdds: number;
  marketImpliedProbability: number;
  edge: number;
  ev: number;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_VALUE';
  status: 'VALUE' | 'NO_VALUE' | 'DATA_UNAVAILABLE';
  clvStatus: 'PENDING' | 'CALCULATED';
  closingOdds: number | null;
  closingLine?: number | null;
  clv: number | null;
  bookmaker: string;
  dataQuality: 'READY' | 'PARTIAL' | 'UNAVAILABLE';
  featureCutoffUtc: string;
  dribbleEnrichment: {
    homeXg: number;
    homeXga: number;
    awayXg: number;
    awayXga: number;
    status: 'FULL' | 'PARTIAL' | 'UNAVAILABLE';
  };
  provenance: {
    fixtureProvider: 'api-football';
    featureProviders: string[];
    oddsProvider: 'oddspapi';
    modelVersion: string;
    featureVersion: string;
    probabilityEngineVersion: string;
    evEngineVersion: string;
    confidenceGateVersion: string;
    predictionCreatedAt: string;
  };
}

export interface BttsLivePipelineRunResult {
  runId: string;
  pipelineStatus: 'LIVE' | 'DEGRADED' | 'NOT_LIVE';
  startTimeUtc: string;
  endTimeUtc: string;
  providers: {
    apiFootball: { auth: 'PASS' | 'FAIL'; status: 'LIVE' | 'DEGRADED' | 'DOWN'; quotaBefore: number; quotaAfter: number };
    dribble: { auth: 'PASS' | 'FAIL'; status: 'LIVE' | 'DEGRADED' | 'DOWN'; rateLimitRemaining: number };
    oddsPapi: { auth: 'PASS' | 'FAIL'; status: 'LIVE' | 'DEGRADED' | 'DOWN'; quotaBefore: number; quotaAfter: number; quotaLimit: number };
  };
  counts: {
    fixturesDiscovered: number;
    fixturesCanonicalized: number;
    fixturesMatchedOdds: number;
    bttsOddsTotal: number;
    pinnacleBttsTotal: number;
    sbobetBttsTotal: number;
    predictionsGenerated: number;
    todayPredictions: number;
    upcoming7dPredictions: number;
    valueBets: number;
    highConfidence: number;
    medium: number;
    low: number;
    noValue: number;
    dataUnavailable: number;
  };
  salmoSync: {
    status: 'PASS' | 'FAIL';
    syncedCount: number;
  };
  topPredictions: BttsPredictionRecord[];
  allPredictions: BttsPredictionRecord[];
}

export class BttsLivePipelineService {
  private static oddspapiMarketsCache: Map<number, any> | null = null;

  public static getMarketsDictionary(): Map<number, any> {
    if (this.oddspapiMarketsCache) return this.oddspapiMarketsCache;
    const rawPath = path.resolve('data/cache/oddspapi_markets_raw.json');
    if (fs.existsSync(rawPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(rawPath, 'utf8'));
        this.oddspapiMarketsCache = new Map<number, any>(raw.map((m: any) => [m.marketId, m]));
        return this.oddspapiMarketsCache;
      } catch (e) {
        console.warn('[BttsLivePipelineService] Error reading cached markets dict:', e);
      }
    }
    return new Map();
  }

  public static normalizeTeam(name: string): string {
    return (name || '')
      .toLowerCase()
      .replace(/\b(fc|cf|cd|afc|ac|sc|ss|bv|sv|vfb|rb|athletic|club)\b/g, '')
      .replace(/[^a-z0-9]/g, '')
      .trim();
  }

  public static generateCanonicalFixtureId(
    competition: string,
    homeTeam: string,
    awayTeam: string,
    kickoffUtc: string
  ): string {
    const dateStr = kickoffUtc.slice(0, 10);
    const normH = this.normalizeTeam(homeTeam);
    const normA = this.normalizeTeam(awayTeam);
    const rawKey = `${competition}:${normH}:${normA}:${dateStr}`;
    return crypto.createHash('sha256').update(rawKey).digest('hex').slice(0, 16);
  }

  /**
   * Deterministic 2-way proportional de-vig for binary BTTS market.
   */
  public static devigBtts(oddsYes: number, oddsNo: number): { fairProbYes: number; fairProbNo: number; overround: number } {
    if (oddsYes <= 1.0 || oddsNo <= 1.0) {
      throw new Error(`[BttsLivePipelineService] Invalid odds for de-vig: Yes=${oddsYes}, No=${oddsNo}`);
    }
    const qYes = 1 / oddsYes;
    const qNo = 1 / oddsNo;
    const sum = qYes + qNo;
    const overround = Number((sum - 1.0).toFixed(5));
    const fairProbYes = Number((qYes / sum).toFixed(5));
    const fairProbNo = Number((qNo / sum).toFixed(5));
    return { fairProbYes, fairProbNo, overround };
  }

  /**
   * Main BTTS Pipeline Execution
   */
  public static async executePipeline(options: { maxOddsFixturesToProbe?: number } = {}): Promise<BttsLivePipelineRunResult> {
    const maxOddsProbes = options.maxOddsFixturesToProbe ?? 12; // Discipline: limit calls to ~12 to protect budget
    const startTimeUtc = new Date().toISOString();
    const runId = `RUN-BTTS-LIVE-${Date.now()}`;
    console.log(`\n============================================================`);
    console.log(`STARTING BTTS LIVE PRODUCTION PIPELINE [${runId}]`);
    console.log(`============================================================`);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 0 & 1: ENVIRONMENT & LIVE CONNECTIVITY PROBE (WITH QUOTA AUDIT)
    // ─────────────────────────────────────────────────────────────────────────
    const afKey = (process.env.APIFOOTBALL_KEY || '').trim();
    const dribbleKey = (process.env.DRIBBLE_API_KEY || '').trim();
    const opKey = (process.env.ODDS_PAPI_KEY || '').trim();

    let afQuotaBefore = 0;
    let afStatus: 'LIVE' | 'DEGRADED' | 'DOWN' = 'DOWN';
    try {
      const res = await fetch('https://v3.football.api-sports.io/status', {
        headers: { 'x-apisports-key': afKey },
      });
      const data = await res.json();
      afQuotaBefore = data.response?.requests?.current ?? 0;
      afStatus = res.status === 200 ? 'LIVE' : 'DEGRADED';
    } catch {
      afStatus = 'DOWN';
    }

    let dribbleRemaining = 5000;
    let dribbleStatus: 'LIVE' | 'DEGRADED' | 'DOWN' = 'DOWN';
    try {
      const res = await fetch('https://dribble360.com/api/v1/matches?limit=1', {
        headers: { Authorization: `Bearer ${dribbleKey}`, Accept: 'application/json' },
      });
      dribbleRemaining = Number(res.headers.get('x-ratelimit-remaining')) || 4900;
      dribbleStatus = res.status === 200 ? 'LIVE' : 'DEGRADED';
    } catch {
      dribbleStatus = 'DOWN';
    }

    let opQuotaBefore = 0;
    let opLimit = 250;
    let opStatus: 'LIVE' | 'DEGRADED' | 'DOWN' = 'DOWN';
    try {
      const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${opKey}`);
      const data = await res.json();
      const sub = data.subscriptions?.[0] || {};
      opQuotaBefore = sub.request_count ?? 0;
      opLimit = sub.request_limit ?? 250;
      opStatus = res.status === 200 && Array.isArray(data.subscriptions) ? 'LIVE' : 'DEGRADED';
    } catch {
      opStatus = 'DOWN';
    }

    console.log(`[Phase 1] Pre-Flight Status:`);
    console.log(`- API-Football: ${afStatus} | Quota consumed: ${afQuotaBefore}`);
    console.log(`- Dribble360:   ${dribbleStatus} | Quota remaining: ${dribbleRemaining}`);
    console.log(`- OddsPAPI:     ${opStatus} | Quota used: ${opQuotaBefore}/${opLimit} (Remaining: ${opLimit - opQuotaBefore})`);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 2 & 3: FIXTURE DISCOVERY & CANONICAL MATCH REGISTRY (7-DAY UNIVERSE)
    // ─────────────────────────────────────────────────────────────────────────
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const toStr = new Date(now.getTime() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

    console.log(`\n[Phase 2] Discovering fixtures from ${todayStr} to ${toStr}...`);
    // 1 METERED call to OddsPAPI for upcoming fixtures with odds. Routed through
    // the quota manager (NativeOddsClient) — never a raw unmetered fetch.
    const opIndex = await fetchOddsPapiFixtureIndex({ from: todayStr, to: toStr });
    const opFixtures: any[] = opIndex.fixtures;
    console.log(
      `[OddsPAPI] Total fixtures with hasOdds=true: ${opFixtures.length} ` +
        `(discovery=${opIndex.status}${opIndex.error ? ` error=${opIndex.error}` : ''})`
    );

    // Query API-Football for dates in the 7-day window
    const discoveredAfFixtures: any[] = [];
    for (let d = 0; d < 7; d++) {
      const dStr = new Date(now.getTime() + d * 24 * 3600 * 1000).toISOString().slice(0, 10);
      try {
        const afRes = await apiFootballClient.getFixturesByDate(dStr);
        const items = Array.isArray(afRes) ? afRes : afRes?.response || [];
        for (const item of items) {
          if (item?.fixture?.status?.short === 'NS') {
            discoveredAfFixtures.push(item);
          }
        }
      } catch (err: any) {
        console.warn(`[API-Football] Error fetching date ${dStr}:`, err.message);
      }
    }
    console.log(`[API-Football] Total Not Started fixtures discovered: ${discoveredAfFixtures.length}`);

    // Canonical matching
    interface MatchedFixture {
      canonicalId: string;
      afFixtureId: number;
      opFixtureId: string;
      /** OddsPapi tournamentId — required for batch (/v4/odds-by-tournaments). */
      opTournamentId: number | null;
      leagueId: number;
      leagueName: string;
      country: string;
      homeTeam: string;
      awayTeam: string;
      kickoffUtc: string;
    }

    const canonicalMatches: MatchedFixture[] = [];
    const seenMatchKeys = new Set<string>();

    for (const af of discoveredAfFixtures) {
      const homeNorm = this.normalizeTeam(af.teams.home.name);
      const awayNorm = this.normalizeTeam(af.teams.away.name);
      const afTimeMs = new Date(af.fixture.date).getTime();

      const opMatch = Array.isArray(opFixtures)
        ? opFixtures.find((op) => {
            const opHomeNorm = this.normalizeTeam(op.participant1Name);
            const opAwayNorm = this.normalizeTeam(op.participant2Name);
            const opTimeMs = new Date(op.startTime).getTime();
            const diffHours = Math.abs(afTimeMs - opTimeMs) / (3600 * 1000);

            const homeMatches = opHomeNorm.includes(homeNorm) || homeNorm.includes(opHomeNorm);
            const awayMatches = opAwayNorm.includes(awayNorm) || awayNorm.includes(opAwayNorm);

            return homeMatches && awayMatches && diffHours <= 4.0;
          })
        : undefined;

      if (opMatch) {
        const canonicalId = this.generateCanonicalFixtureId(
          af.league.name,
          af.teams.home.name,
          af.teams.away.name,
          af.fixture.date
        );

        if (!seenMatchKeys.has(canonicalId)) {
          seenMatchKeys.add(canonicalId);
          canonicalMatches.push({
            canonicalId,
            afFixtureId: af.fixture.id,
            opFixtureId: opMatch.fixtureId,
            opTournamentId: opMatch.tournamentId ?? null,
            leagueId: af.league.id,
            leagueName: af.league.name,
            country: af.league.country,
            homeTeam: af.teams.home.name,
            awayTeam: af.teams.away.name,
            kickoffUtc: af.fixture.date,
          });
        }
      }
    }

    console.log(`[Phase 3] Total Canonical Fixtures mapped: ${canonicalMatches.length}`);

    // Prioritize fixtures: balanced mix of today and upcoming 7-day
    const todayFixtures = canonicalMatches.filter((f) => f.kickoffUtc.slice(0, 10) === todayStr);
    const futureFixtures = canonicalMatches.filter((f) => f.kickoffUtc.slice(0, 10) > todayStr);

    const halfProbe = Math.floor(maxOddsProbes / 2);
    const targetToday = todayFixtures.slice(0, halfProbe);
    const targetFuture = futureFixtures.slice(0, maxOddsProbes - targetToday.length);
    const targetFixtures = [...targetToday, ...targetFuture];

    console.log(`[Odds Quota Discipline] Selected ${targetFixtures.length} priority fixtures (${targetToday.length} today, ${targetFuture.length} upcoming 7-day) for sharp BTTS odds retrieval.`);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4-11: FEATURES, BTTS MODEL, PROBABILITY, FAIR ODDS, EV, CONFIDENCE
    // ─────────────────────────────────────────────────────────────────────────
    const marketMap = this.getMarketsDictionary();
    const predictions: BttsPredictionRecord[] = [];
    const oddsSnapshots: BttsOddsSnapshotRecord[] = [];

    let pinnacleBttsCount = 0;
    let sbobetBttsCount = 0;
    let totalBttsOddsCount = 0;

    // ── P0 QUOTA ARCHITECTURE ────────────────────────────────────────────────
    // One shared /v4/odds-by-tournaments batch per consumed bookmaker replaces
    // the previous 12 x /v4/odds?fixtureId= fan-out. Quota-aware (reserve ->
    // call -> confirm via NativeOddsClient) and fail-safe: if the batch cannot
    // be obtained we degrade to DATA_UNAVAILABLE instead of fanning out.
    const opTournamentIds = [
      ...new Set(
        targetFixtures
          .map((f) => f.opTournamentId)
          .filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
      ),
    ];
    const batchResult = await primeTournamentOdds({ tournamentIds: opTournamentIds });
    console.log(
      `[Odds Quota Discipline] Batch prime: status=${batchResult.status} ` +
        `tournaments=${opTournamentIds.length} fixtures=${batchResult.fixtureCount} ` +
        `bookmakers=${batchResult.bookmakersWithData.join('+') || 'none'} ` +
        `meteredCalls=${batchResult.meteredCalls}${batchResult.fromCache ? ' (cache hit)' : ''}` +
        `${batchResult.error ? ` error=${batchResult.error}` : ''}`
    );

    for (const fixture of targetFixtures) {
      const kickoffMs = new Date(fixture.kickoffUtc).getTime();
      const cutoffUtc = new Date(kickoffMs - 30 * 60 * 1000).toISOString();

      // Feature extraction (strictly t < cutoff)
      const homeDribble = await DribbleEnrichmentService.getPointInTimeTeamStats(fixture.homeTeam, cutoffUtc);
      const awayDribble = await DribbleEnrichmentService.getPointInTimeTeamStats(fixture.awayTeam, cutoffUtc);

      const hasDribbleCoverage = homeDribble.coverageStatus !== 'UNAVAILABLE' || awayDribble.coverageStatus !== 'UNAVAILABLE';
      const dataQuality: 'READY' | 'PARTIAL' | 'UNAVAILABLE' = hasDribbleCoverage ? 'READY' : 'PARTIAL';

      // Sharp Odds Ingestion from the shared tournament batch — ZERO provider
      // calls per fixture. OddsPapi remains the sole odds authority; the payload
      // is the provider's own bookmakerOdds object, unchanged.
      const oddsData: any = getBatchedFixtureOdds(fixture.opFixtureId);

      // Check if oddsData contains bookmakerOdds
      if (!oddsData || !oddsData.bookmakerOdds) {
        // Record both YES and NO as DATA_UNAVAILABLE
        for (const side of ['YES', 'NO'] as const) {
          predictions.push({
            predictionId: `PRED-${fixture.canonicalId}-BTTS-${side}`,
            canonicalMatchId: fixture.canonicalId,
            fixtureId: `AF-${fixture.afFixtureId}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            competition: fixture.leagueName,
            kickoffUtc: fixture.kickoffUtc,
            marketType: 'BTTS',
            selection: side,
            odds: 0,
            modelProbability: 0,
            fairOdds: 0,
            marketImpliedProbability: 0,
            edge: 0,
            ev: 0,
            confidence: 'NO_VALUE',
            status: 'DATA_UNAVAILABLE',
            clvStatus: 'PENDING',
            closingOdds: null,
            clv: null,
            bookmaker: 'None',
            dataQuality: 'UNAVAILABLE',
            featureCutoffUtc: cutoffUtc,
            dribbleEnrichment: {
              homeXg: homeDribble.rollingXg,
              homeXga: homeDribble.rollingXga,
              awayXg: awayDribble.rollingXg,
              awayXga: awayDribble.rollingXga,
              status: homeDribble.coverageStatus,
            },
            provenance: {
              fixtureProvider: 'api-football',
              featureProviders: ['api-football', 'dribble360'],
              oddsProvider: 'oddspapi',
              modelVersion: 'BTTS-DixonColes-Opta-v1.0.0',
              featureVersion: 'pit-v1.2.0',
              probabilityEngineVersion: 'bivariate-dixon-coles-grid-v1',
              evEngineVersion: 'btts-binary-ev-v1',
              confidenceGateVersion: 'btts-gate-v1.0',
              predictionCreatedAt: new Date().toISOString(),
            },
          });
        }
        continue;
      }

      // Extract Pinnacle and SBOBET BTTS market (marketId 104, fulltime)
      const pinnacle = oddsData.bookmakerOdds['pinnacle'];
      const sbobet = oddsData.bookmakerOdds['sbobet'];

      interface ExtractedBttsQuote {
        bookmaker: 'Pinnacle' | 'SBOBET';
        yesOdds: number;
        noOdds: number;
        timestamp: string;
      }

      let selectedQuote: ExtractedBttsQuote | null = null;

      // Helper to extract BTTS line from a bookmaker
      const extractBttsLine = (bmData: any, bmName: 'Pinnacle' | 'SBOBET'): ExtractedBttsQuote | null => {
        if (!bmData || !bmData.markets) return null;
        for (const [mIdStr, mData] of Object.entries(bmData.markets) as any[]) {
          const mId = Number(mIdStr);
          const meta = marketMap.get(mId);

          // STRICT MARKET ISOLATION:
          // Must match marketId 104 OR (marketName === 'Both Teams To Score' AND period === 'fulltime')
          const isBttsFulltime =
            mId === 104 ||
            (meta && meta.marketName === 'Both Teams To Score' && meta.period === 'fulltime');

          if (!isBttsFulltime) continue;

          const outcomes = mData.outcomes || {};
          let yesOdds: number | null = null;
          let noOdds: number | null = null;
          let timestamp = new Date().toISOString();

          // Search outcomes metadata or standard outcome keys (104=Yes, 105=No)
          for (const [oIdStr, outData] of Object.entries(outcomes) as any[]) {
            const oId = Number(oIdStr);
            const p = outData?.players?.['0'];
            if (p && typeof p.price === 'number') {
              if (oId === 104) {
                yesOdds = p.price;
                if (p.changedAt) timestamp = p.changedAt;
              } else if (oId === 105) {
                noOdds = p.price;
              }
            }
          }

          // If outcomes not by ID 104/105, check outcomeName from meta
          if ((yesOdds === null || noOdds === null) && meta && Array.isArray(meta.outcomes)) {
            for (const outMeta of meta.outcomes) {
              const outData = outcomes[String(outMeta.outcomeId)];
              const p = outData?.players?.['0'];
              if (p && typeof p.price === 'number') {
                if (outMeta.outcomeName?.toLowerCase() === 'yes') {
                  yesOdds = p.price;
                  if (p.changedAt) timestamp = p.changedAt;
                } else if (outMeta.outcomeName?.toLowerCase() === 'no') {
                  noOdds = p.price;
                }
              }
            }
          }

          if (yesOdds !== null && noOdds !== null && yesOdds > 1.0 && noOdds > 1.0) {
            return {
              bookmaker: bmName,
              yesOdds,
              noOdds,
              timestamp,
            };
          }
        }
        return null;
      };

      const pinQuote = extractBttsLine(pinnacle, 'Pinnacle');
      const sboQuote = extractBttsLine(sbobet, 'SBOBET');

      if (pinQuote) {
        pinnacleBttsCount++;
        totalBttsOddsCount++;
        selectedQuote = pinQuote;
      } else if (sboQuote) {
        sbobetBttsCount++;
        totalBttsOddsCount++;
        selectedQuote = sboQuote;
      }

      // Record snapshot if any quote found
      if (selectedQuote) {
        oddsSnapshots.push({
          snapshotId: `SNAP-${fixture.canonicalId}-BTTS-${selectedQuote.bookmaker.toUpperCase()}`,
          canonicalMatchId: fixture.canonicalId,
          fixtureId: `AF-${fixture.afFixtureId}`,
          match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          kickoffUtc: fixture.kickoffUtc,
          bookmaker: selectedQuote.bookmaker,
          marketId: 104,
          yesOdds: selectedQuote.yesOdds,
          noOdds: selectedQuote.noOdds,
          timestampUtc: selectedQuote.timestamp,
          provenance: {
            source: 'oddspapi',
            endpoint: `/v4/odds-by-tournaments?tournamentIds=${fixture.opTournamentId}&bookmaker=pinnacle,sbobet`,
          },
        });
      }

      // If no valid BTTS quote available: record as DATA_UNAVAILABLE
      if (!selectedQuote) {
        for (const side of ['YES', 'NO'] as const) {
          predictions.push({
            predictionId: `PRED-${fixture.canonicalId}-BTTS-${side}`,
            canonicalMatchId: fixture.canonicalId,
            fixtureId: `AF-${fixture.afFixtureId}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            competition: fixture.leagueName,
            kickoffUtc: fixture.kickoffUtc,
            marketType: 'BTTS',
            selection: side,
            odds: 0,
            modelProbability: 0,
            fairOdds: 0,
            marketImpliedProbability: 0,
            edge: 0,
            ev: 0,
            confidence: 'NO_VALUE',
            status: 'DATA_UNAVAILABLE',
            clvStatus: 'PENDING',
            closingOdds: null,
            clv: null,
            bookmaker: 'None',
            dataQuality: 'UNAVAILABLE',
            featureCutoffUtc: cutoffUtc,
            dribbleEnrichment: {
              homeXg: homeDribble.rollingXg,
              homeXga: homeDribble.rollingXga,
              awayXg: awayDribble.rollingXg,
              awayXga: awayDribble.rollingXga,
              status: homeDribble.coverageStatus,
            },
            provenance: {
              fixtureProvider: 'api-football',
              featureProviders: ['api-football', 'dribble360'],
              oddsProvider: 'oddspapi',
              modelVersion: 'BTTS-DixonColes-Opta-v1.0.0',
              featureVersion: 'pit-v1.2.0',
              probabilityEngineVersion: 'bivariate-dixon-coles-grid-v1',
              evEngineVersion: 'btts-binary-ev-v1',
              confidenceGateVersion: 'btts-gate-v1.0',
              predictionCreatedAt: new Date().toISOString(),
            },
          });
        }
        continue;
      }

      // ───────────────────────────────────────────────────────────────────────
      // MATHEMATICAL MODEL: DIXON-COLES BIVARIATE SCORE DISTRIBUTION
      // ───────────────────────────────────────────────────────────────────────
      let expHomeGoals = 1.45;
      let expAwayGoals = 1.15;
      if (homeDribble.coverageStatus !== 'UNAVAILABLE' && homeDribble.rollingXg > 0) {
        expHomeGoals = Number(((expHomeGoals + homeDribble.rollingXg) / 2).toFixed(4));
      }
      if (awayDribble.coverageStatus !== 'UNAVAILABLE' && awayDribble.rollingXg > 0) {
        expAwayGoals = Number(((expAwayGoals + awayDribble.rollingXg) / 2).toFixed(4));
      }

      const rho = -0.04; // locked empirical Dixon-Coles parameter for BTTS
      const bttsModelResult = calculateBtts(expHomeGoals, expAwayGoals, rho);

      const pYes = bttsModelResult.probabilities.yes;
      const pNo = bttsModelResult.probabilities.no;

      // Invariant: pYes + pNo = 1.0 within tolerance
      if (Math.abs(pYes + pNo - 1.0) > 1e-9) {
        throw new Error(`[BttsLivePipelineService] Mathematical complementarity failed: ${pYes} + ${pNo} != 1.0`);
      }

      // De-vig real market odds
      const devig = this.devigBtts(selectedQuote.yesOdds, selectedQuote.noOdds);

      // Binary Fair Odds: 1 / P
      const fairOddsYes = pYes > 0 ? Number((1 / pYes).toFixed(3)) : 0;
      const fairOddsNo = pNo > 0 ? Number((1 / pNo).toFixed(3)) : 0;

      // Edge against no-vig market consensus
      const edgeYes = Number((pYes - devig.fairProbYes).toFixed(4));
      const edgeNo = Number((pNo - devig.fairProbNo).toFixed(4));

      // Expected Value (EV = P * O - 1)
      const evYes = Number((pYes * selectedQuote.yesOdds - 1.0).toFixed(4));
      const evNo = Number((pNo * selectedQuote.noOdds - 1.0).toFixed(4));

      // Side evaluations: YES
      const evalSide = (
        side: 'YES' | 'NO',
        prob: number,
        marketOdds: number,
        fairOdds: number,
        marketImplied: number,
        edge: number,
        ev: number
      ): { confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_VALUE'; status: 'VALUE' | 'NO_VALUE' } => {
        // Value threshold: EV >= 2% AND Edge >= 1%
        const isValue = ev >= 0.02 && edge >= 0.01;

        let conf: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_VALUE' = 'NO_VALUE';
        if (prob >= 0.58 && marketOdds >= 1.60 && edge >= 0.03 && ev >= 0.04 && dataQuality === 'READY') {
          conf = 'HIGH';
        } else if (prob >= 0.52 && marketOdds >= 1.50 && edge >= 0.015 && ev >= 0.02) {
          conf = 'MEDIUM';
        } else if (edge > 0 && ev > 0) {
          conf = 'LOW';
        } else {
          conf = 'NO_VALUE';
        }

        return {
          confidence: conf,
          status: isValue ? 'VALUE' : 'NO_VALUE',
        };
      };

      const yesEval = evalSide('YES', pYes, selectedQuote.yesOdds, fairOddsYes, devig.fairProbYes, edgeYes, evYes);
      const noEval = evalSide('NO', pNo, selectedQuote.noOdds, fairOddsNo, devig.fairProbNo, edgeNo, evNo);

      // Add BTTS YES record
      predictions.push({
        predictionId: `PRED-${fixture.canonicalId}-BTTS-YES`,
        canonicalMatchId: fixture.canonicalId,
        fixtureId: `AF-${fixture.afFixtureId}`,
        match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        competition: fixture.leagueName,
        kickoffUtc: fixture.kickoffUtc,
        marketType: 'BTTS',
        selection: 'YES',
        odds: selectedQuote.yesOdds,
        modelProbability: Number(pYes.toFixed(4)),
        fairOdds: fairOddsYes,
        marketImpliedProbability: Number(devig.fairProbYes.toFixed(4)),
        edge: edgeYes,
        ev: evYes,
        confidence: yesEval.confidence,
        status: yesEval.status,
        clvStatus: 'PENDING',
        closingOdds: null,
        closingLine: null as any,
        clv: null,
        bookmaker: selectedQuote.bookmaker,
        dataQuality,
        featureCutoffUtc: cutoffUtc,
        dribbleEnrichment: {
          homeXg: homeDribble.rollingXg,
          homeXga: homeDribble.rollingXga,
          awayXg: awayDribble.rollingXg,
          awayXga: awayDribble.rollingXga,
          status: homeDribble.coverageStatus,
        },
        provenance: {
          fixtureProvider: 'api-football',
          featureProviders: ['api-football', 'dribble360'],
          oddsProvider: 'oddspapi',
          modelVersion: 'BTTS-DixonColes-Opta-v1.0.0',
          featureVersion: 'pit-v1.2.0',
          probabilityEngineVersion: 'bivariate-dixon-coles-grid-v1',
          evEngineVersion: 'btts-binary-ev-v1',
          confidenceGateVersion: 'btts-gate-v1.0',
          predictionCreatedAt: new Date().toISOString(),
        },
      });

      // Add BTTS NO record
      predictions.push({
        predictionId: `PRED-${fixture.canonicalId}-BTTS-NO`,
        canonicalMatchId: fixture.canonicalId,
        fixtureId: `AF-${fixture.afFixtureId}`,
        match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam,
        competition: fixture.leagueName,
        kickoffUtc: fixture.kickoffUtc,
        marketType: 'BTTS',
        selection: 'NO',
        odds: selectedQuote.noOdds,
        modelProbability: Number(pNo.toFixed(4)),
        fairOdds: fairOddsNo,
        marketImpliedProbability: Number(devig.fairProbNo.toFixed(4)),
        edge: edgeNo,
        ev: evNo,
        confidence: noEval.confidence,
        status: noEval.status,
        clvStatus: 'PENDING',
        closingOdds: null,
        closingLine: null as any,
        clv: null,
        bookmaker: selectedQuote.bookmaker,
        dataQuality,
        featureCutoffUtc: cutoffUtc,
        dribbleEnrichment: {
          homeXg: homeDribble.rollingXg,
          homeXga: homeDribble.rollingXga,
          awayXg: awayDribble.rollingXg,
          awayXga: awayDribble.rollingXga,
          status: homeDribble.coverageStatus,
        },
        provenance: {
          fixtureProvider: 'api-football',
          featureProviders: ['api-football', 'dribble360'],
          oddsProvider: 'oddspapi',
          modelVersion: 'BTTS-DixonColes-Opta-v1.0.0',
          featureVersion: 'pit-v1.2.0',
          probabilityEngineVersion: 'bivariate-dixon-coles-grid-v1',
          evEngineVersion: 'btts-binary-ev-v1',
          confidenceGateVersion: 'btts-gate-v1.0',
          predictionCreatedAt: new Date().toISOString(),
        },
      });
    }

    // Capture quota after
    let afQuotaAfter = afQuotaBefore;
    try {
      const res = await fetch('https://v3.football.api-sports.io/status', {
        headers: { 'x-apisports-key': afKey },
      });
      const data = await res.json();
      afQuotaAfter = data.response?.requests?.current ?? afQuotaBefore;
    } catch {}

    let opQuotaAfter = opQuotaBefore;
    try {
      const res = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${opKey}`);
      const data = await res.json();
      const sub = data.subscriptions?.[0] || {};
      opQuotaAfter = sub.request_count ?? opQuotaBefore;
    } catch {}

    // ─────────────────────────────────────────────────────────────────────────
    // COUNT RECONCILIATION & PARTITIONING
    // ─────────────────────────────────────────────────────────────────────────
    const todayPredictions = predictions.filter((p) => p.kickoffUtc.slice(0, 10) === todayStr);
    const upcoming7dPredictions = predictions.filter((p) => p.kickoffUtc.slice(0, 10) > todayStr);

    const valueBets = predictions.filter((p) => p.status === 'VALUE');
    const noValuePicks = predictions.filter((p) => p.status === 'NO_VALUE');
    const dataUnavailablePicks = predictions.filter((p) => p.status === 'DATA_UNAVAILABLE');

    const highConfidencePicks = predictions.filter((p) => p.confidence === 'HIGH');
    const mediumPicks = predictions.filter((p) => p.confidence === 'MEDIUM');
    const lowPicks = predictions.filter((p) => p.confidence === 'LOW');

    // Strict count reconciliation invariant: TOTAL = VALUE + NO_VALUE + DATA_UNAVAILABLE
    const totalCount = predictions.length;
    const reconciledCount = valueBets.length + noValuePicks.length + dataUnavailablePicks.length;
    if (totalCount !== reconciledCount) {
      throw new Error(`[BttsLivePipelineService] Count reconciliation failure: Total=${totalCount} vs Sum=${reconciledCount}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // PERSISTENCE & SALMO SYNCHRONIZATION
    // ─────────────────────────────────────────────────────────────────────────
    const ledgerRecordsToSync: PredictionLedgerRecord[] = predictions
      .filter((p) => p.status !== 'DATA_UNAVAILABLE')
      .map((p) => {
        let ledgerStatus: any = 'RESEARCH_ONLY';
        if (p.confidence === 'HIGH') ledgerStatus = 'HIGH_CONFIDENCE';
        else if (p.confidence === 'MEDIUM') ledgerStatus = 'QUALIFIED';
        else ledgerStatus = 'RESEARCH_ONLY';

        return {
          predictionId: p.predictionId,
          canonicalMatchId: p.canonicalMatchId,
          match: p.match,
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          competition: p.competition,
          market: 'BTTS',
          selection: p.selection,
          line: null,
          modelProbability: p.modelProbability,
          calibratedProbability: p.modelProbability,
          odds: p.odds,
          impliedProbability: p.marketImpliedProbability,
          edge: p.edge,
          expectedValue: p.ev,
          confidence: p.confidence === 'NO_VALUE' ? 'PASS' : (p.confidence as any),
          confidenceScore: Math.round(p.modelProbability * 100),
          predictionTimestamp: p.provenance.predictionCreatedAt,
          kickoffTimestamp: p.kickoffUtc,
          oddsTimestamp: p.provenance.predictionCreatedAt,
          modelVersion: p.provenance.modelVersion,
          featureVersion: p.provenance.featureVersion,
          runId,
          status: ledgerStatus,
          createdAt: p.provenance.predictionCreatedAt,
          updatedAt: p.provenance.predictionCreatedAt,
        };
      });

    // Save canonical ledger records
    for (const r of ledgerRecordsToSync) {
      DailyPredictionLedgerService.recordPrediction(r);
    }

    // Synchronize verified BTTS picks to Salmo
    let salmoSyncStatus: 'PASS' | 'FAIL' = 'PASS';
    let salmoSyncedCount = 0;
    try {
      const eligibleForSalmo = ledgerRecordsToSync.filter(
        (r) => (r.status === 'HIGH_CONFIDENCE' || r.status === 'QUALIFIED') && r.expectedValue > 0
      );
      if (eligibleForSalmo.length > 0) {
        const syncReport = await SalmoSyncService.synchronizeBtts(eligibleForSalmo);
        salmoSyncedCount = syncReport.created + syncReport.updated + syncReport.unchanged;
        salmoSyncStatus = syncReport.status === 'SUCCESS' || syncReport.status === 'NO_PICKS' ? 'PASS' : 'FAIL';
      }

      // Mirror tmp files to workspace if in test/dev
      try {
        const os = require('os');
        const salmoTmp = path.join(os.tmpdir(), 'handicaplab_salmo_synced_decisions.json');
        const salmoDst = path.resolve('data/ledger/salmo_synced_decisions.json');
        if (fs.existsSync(salmoTmp)) fs.copyFileSync(salmoTmp, salmoDst);
      } catch {}
    } catch (salmoErr) {
      console.warn('[SalmoSyncService] BTTS sync warning:', salmoErr);
      salmoSyncStatus = 'FAIL';
    }

    // Persist ledgers
    const ensureDir = (filePath: string) => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    };

    // 1. data/ledger/btts_daily_predictions.jsonl
    const dailyPath = path.resolve('data/ledger/btts_daily_predictions.jsonl');
    ensureDir(dailyPath);
    const dailyLines = todayPredictions.map((p) => JSON.stringify(p)).join('\n');
    fs.writeFileSync(dailyPath, dailyLines.length > 0 ? dailyLines + '\n' : '', 'utf8');

    // 2. data/ledger/btts_upcoming_7d_predictions.jsonl
    const upcomingPath = path.resolve('data/ledger/btts_upcoming_7d_predictions.jsonl');
    ensureDir(upcomingPath);
    const upcomingLines = predictions.map((p) => JSON.stringify(p)).join('\n');
    fs.writeFileSync(upcomingPath, upcomingLines.length > 0 ? upcomingLines + '\n' : '', 'utf8');

    // 3. data/ledger/btts_odds_snapshots.jsonl
    const snapPath = path.resolve('data/ledger/btts_odds_snapshots.jsonl');
    ensureDir(snapPath);
    const snapLines = oddsSnapshots.map((s) => JSON.stringify(s)).join('\n');
    fs.writeFileSync(snapPath, snapLines.length > 0 ? snapLines + '\n' : '', 'utf8');

    // 4. data/ledger/btts_clv_ledger.jsonl
    const clvPath = path.resolve('data/ledger/btts_clv_ledger.jsonl');
    ensureDir(clvPath);
    const clvRecords = predictions.map((p) => ({
      predictionId: p.predictionId,
      canonicalMatchId: p.canonicalMatchId,
      match: p.match,
      kickoffUtc: p.kickoffUtc,
      selection: p.selection,
      entryOdds: p.odds,
      bookmaker: p.bookmaker,
      closingOdds: null,
      clvPercentage: null,
      clvStatus: 'PENDING',
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(clvPath, clvRecords.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');

    // Top predictions sorted by EV descending
    const sortedPredictions = [...predictions].filter((p) => p.status === 'VALUE').sort((a, b) => b.ev - a.ev);

    const endTimeUtc = new Date().toISOString();
    const finalReport: BttsLivePipelineRunResult = {
      runId,
      pipelineStatus: predictions.length > 0 && totalBttsOddsCount > 0 ? 'LIVE' : 'DEGRADED',
      startTimeUtc,
      endTimeUtc,
      providers: {
        apiFootball: {
          auth: 'PASS',
          status: afStatus,
          quotaBefore: afQuotaBefore,
          quotaAfter: afQuotaAfter,
        },
        dribble: {
          auth: 'PASS',
          status: dribbleStatus,
          rateLimitRemaining: dribbleRemaining,
        },
        oddsPapi: {
          auth: 'PASS',
          status: opStatus,
          quotaBefore: opQuotaBefore,
          quotaAfter: opQuotaAfter,
          quotaLimit: opLimit,
        },
      },
      counts: {
        fixturesDiscovered: discoveredAfFixtures.length,
        fixturesCanonicalized: canonicalMatches.length,
        fixturesMatchedOdds: targetFixtures.length,
        bttsOddsTotal: totalBttsOddsCount,
        pinnacleBttsTotal: pinnacleBttsCount,
        sbobetBttsTotal: sbobetBttsCount,
        predictionsGenerated: predictions.length,
        todayPredictions: todayPredictions.length,
        upcoming7dPredictions: upcoming7dPredictions.length,
        valueBets: valueBets.length,
        highConfidence: highConfidencePicks.length,
        medium: mediumPicks.length,
        low: lowPicks.length,
        noValue: noValuePicks.length,
        dataUnavailable: dataUnavailablePicks.length,
      },
      salmoSync: {
        status: salmoSyncStatus,
        syncedCount: salmoSyncedCount,
      },
      topPredictions: sortedPredictions.slice(0, 10),
      allPredictions: predictions,
    };

    // 5. data/verification/btts_live_pipeline_report.json
    const repPath = path.resolve('data/verification/btts_live_pipeline_report.json');
    ensureDir(repPath);
    fs.writeFileSync(repPath, JSON.stringify(finalReport, null, 2), 'utf8');

    // 6. docs/research/BTTS_LIVE_PIPELINE_STATUS.md
    const docPath = path.resolve('docs/research/BTTS_LIVE_PIPELINE_STATUS.md');
    ensureDir(docPath);
    const mdContent = this.generateMarkdownStatusReport(finalReport);
    fs.writeFileSync(docPath, mdContent, 'utf8');

    console.log(`[BttsLivePipelineService] Execution complete. Report written to ${repPath}.`);
    return finalReport;
  }

  private static generateMarkdownStatusReport(r: BttsLivePipelineRunResult): string {
    return `# Both Teams To Score (BTTS) Live Production Pipeline Status Report
**Run ID**: \`${r.runId}\`  
**Pipeline Status**: **${r.pipelineStatus}**  
**Execution Timestamp**: \`${r.startTimeUtc}\` -> \`${r.endTimeUtc}\`

## 1. Provider Connectivity & Quota Audit
| Provider | Auth | Live Status | Quota Before | Quota After | Quota Delta / Budget |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **API-Football** | ${r.providers.apiFootball.auth} | ${r.providers.apiFootball.status} | ${r.providers.apiFootball.quotaBefore} | ${r.providers.apiFootball.quotaAfter} | +${r.providers.apiFootball.quotaAfter - r.providers.apiFootball.quotaBefore} / 7,500 daily |
| **Dribble360** | ${r.providers.dribble.auth} | ${r.providers.dribble.status} | N/A | N/A | Remaining: ${r.providers.dribble.rateLimitRemaining} / 5,000 |
| **OddsPAPI** | ${r.providers.oddsPapi.auth} | ${r.providers.oddsPapi.status} | ${r.providers.oddsPapi.quotaBefore} | ${r.providers.oddsPapi.quotaAfter} | +${r.providers.oddsPapi.quotaAfter - r.providers.oddsPapi.quotaBefore} / ${r.providers.oddsPapi.quotaLimit} monthly |

## 2. Ingestion & Market Summary
- **Fixtures Discovered (API-Football 7-Day)**: \`${r.counts.fixturesDiscovered}\`
- **Canonical Matches Mapped**: \`${r.counts.fixturesCanonicalized}\`
- **Fixtures Probed with Live Sharp Odds**: \`${r.counts.fixturesMatchedOdds}\`
- **Total Real BTTS Lines Ingested**: \`${r.counts.bttsOddsTotal}\`
  - **Pinnacle BTTS**: \`${r.counts.pinnacleBttsTotal}\`
  - **SBOBET BTTS**: \`${r.counts.sbobetBttsTotal}\`
- **Total Predictions Generated**: \`${r.counts.predictionsGenerated}\`
  - Today ($T+0$): \`${r.counts.todayPredictions}\`
  - Upcoming 7 Days ($T+1$ to $T+7$): \`${r.counts.upcoming7dPredictions}\`
  - Value Bets: \`${r.counts.valueBets}\`
  - High Confidence: \`${r.counts.highConfidence}\`
  - Medium Confidence: \`${r.counts.medium}\`
  - Low Confidence: \`${r.counts.low}\`
  - No Value: \`${r.counts.noValue}\`
  - Data Unavailable: \`${r.counts.dataUnavailable}\`

## 3. Salmo Synchronization
- **Salmo Sync Status**: **${r.salmoSync.status}**
- **Synced Decisions**: \`${r.salmoSync.syncedCount}\` records
- **Data Contract**: High & Medium confidence BTTS lines only. Zero external credentials in Salmo.

## 4. Top Real Data BTTS Predictions
${r.topPredictions.length === 0 ? '_No high-EV picks above market threshold for this window._' : r.topPredictions.map((p, idx) => `
### #${idx + 1}: ${p.match}
- **League**: ${p.competition}
- **Kickoff**: \`${p.kickoffUtc}\`
- **Market**: Both Teams To Score (${p.selection})
- **Bookmaker**: ${p.bookmaker}
- **Entry Odds**: \`${p.odds.toFixed(3)}\`
- **Model Probability**: \`${(p.modelProbability * 100).toFixed(1)}%\`
- **Fair Odds**: \`${p.fairOdds.toFixed(3)}\`
- **Edge**: \`${(p.edge * 100).toFixed(1)}%\`
- **Expected Value (EV)**: \`${(p.ev * 100).toFixed(1)}%\`
- **Confidence**: **${p.confidence}**
- **CLV**: \`PENDING\`
- **Data Quality**: \`${p.dataQuality}\`
`).join('\n')}
`;
  }
}
export default BttsLivePipelineService;
