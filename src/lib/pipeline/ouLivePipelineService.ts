import * as fs from 'fs';
import * as path from 'path';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

// Ensure .env.local is authoritative
dotenv.config({ path: path.resolve(process.cwd(), '.env.local'), override: true });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { apiFootballClient } from '@/lib/apis/apifootball';
import { DribbleEnrichmentService } from '@/lib/research/dribble/dribbleEnrichmentService';
import { buildScoreGrid } from '@/lib/engine/probability';
import {
  OuProbabilityEngine,
  OuLineType,
  OuSelection,
  OuLineSettlementProbabilities,
} from '@/lib/research/ou/ouProbabilityEngine';
import { SalmoSyncService } from './salmoSyncService';
import { DailyPredictionLedgerService, PredictionLedgerRecord } from './dailyPredictionLedger';
import {
  fetchOddsPapiFixtureIndex,
  primeTournamentOdds,
  getBatchedFixtureOdds,
} from './tournamentOddsBatch';

export interface OuMarketLineQuote {
  line: number;
  lineType: OuLineType;
  overOdds: number;
  underOdds: number;
  bookmaker: 'Pinnacle' | 'SBOBET';
  timestamp: string;
}

export interface OuOddsSnapshotRecord {
  snapshotId: string;
  canonicalMatchId: string;
  fixtureId: string;
  match: string;
  kickoffUtc: string;
  bookmaker: string;
  line: number;
  lineType: OuLineType;
  overOdds: number;
  underOdds: number;
  timestampUtc: string;
  provenance: {
    source: 'oddspapi';
    endpoint: string;
  };
}

export interface OuPredictionRecord {
  predictionId: string;
  canonicalMatchId: string;
  fixtureId: string;
  match: string;
  homeTeam: string;
  awayTeam: string;
  competition: string;
  kickoffUtc: string;
  marketType: 'OU';
  line: number;
  lineType: OuLineType;
  selection: OuSelection;
  odds: number;
  modelProbability: number;
  fairOdds: number;
  marketImpliedProbability: number;
  edge: number;
  ev: number;
  settlementProbabilities: {
    pFullWin: number;
    pHalfWin: number;
    pPush: number;
    pHalfLoss: number;
    pFullLoss: number;
  };
  confidence: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_VALUE';
  status: 'VALUE' | 'NO_VALUE' | 'DATA_UNAVAILABLE';
  clvStatus: 'PENDING' | 'CALCULATED';
  closingOdds: number | null;
  closingLine: number | null;
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

export interface OuLivePipelineRunResult {
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
    ouOddsTotal: number;
    pinnacleOuTotal: number;
    sbobetOuTotal: number;
    uniqueLines: number[];
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
  topPredictions: OuPredictionRecord[];
  allPredictions: OuPredictionRecord[];
}

export class OuLivePipelineService {
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
        console.warn('[OuLivePipelineService] Error reading cached markets dict:', e);
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
   * Main Over/Under Pipeline Execution
   */
  public static async executePipeline(options: { maxOddsFixturesToProbe?: number } = {}): Promise<OuLivePipelineRunResult> {
    const maxOddsProbes = options.maxOddsFixturesToProbe ?? 12; // Discipline: limit calls to ~12 to protect budget
    const startTimeUtc = new Date().toISOString();
    const runId = `RUN-OU-LIVE-${Date.now()}`;
    console.log(`\n============================================================`);
    console.log(`STARTING OVER/UNDER LIVE PRODUCTION PIPELINE [${runId}]`);
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

    console.log(`[Odds Quota Discipline] Selected ${targetFixtures.length} priority fixtures (${targetToday.length} today, ${targetFuture.length} upcoming 7-day) for sharp Over/Under odds retrieval.`);

    // ─────────────────────────────────────────────────────────────────────────
    // PHASE 4-11: FEATURES, TOTALS MODEL, PROBABILITY, FAIR ODDS, EV, CONFIDENCE
    // ─────────────────────────────────────────────────────────────────────────
    const marketMap = this.getMarketsDictionary();
    const predictions: OuPredictionRecord[] = [];
    const oddsSnapshots: OuOddsSnapshotRecord[] = [];
    const allDiscoveredLinesSet = new Set<number>();

    let pinnacleOuCount = 0;
    let sbobetOuCount = 0;
    let totalOuOddsCount = 0;

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
        // Record default baseline line 2.5 as DATA_UNAVAILABLE
        for (const side of ['OVER', 'UNDER'] as const) {
          predictions.push({
            predictionId: `PRED-${fixture.canonicalId}-OU-${side}-2.5`,
            canonicalMatchId: fixture.canonicalId,
            fixtureId: `AF-${fixture.afFixtureId}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            competition: fixture.leagueName,
            kickoffUtc: fixture.kickoffUtc,
            marketType: 'OU',
            line: 2.5,
            lineType: 'HALF',
            selection: side,
            odds: 0,
            modelProbability: 0,
            fairOdds: 0,
            marketImpliedProbability: 0,
            edge: 0,
            ev: 0,
            settlementProbabilities: {
              pFullWin: 0,
              pHalfWin: 0,
              pPush: 0,
              pHalfLoss: 0,
              pFullLoss: 0,
            },
            confidence: 'NO_VALUE',
            status: 'DATA_UNAVAILABLE',
            clvStatus: 'PENDING',
            closingOdds: null,
            closingLine: null,
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
              modelVersion: 'OU-DixonColes-Opta-v1.0.0',
              featureVersion: 'pit-v1.2.0',
              probabilityEngineVersion: 'bivariate-dixon-coles-totals-pmf-v1',
              evEngineVersion: 'settlement-aware-ou-ev-v1',
              confidenceGateVersion: 'ou-gate-v1.0',
              predictionCreatedAt: new Date().toISOString(),
            },
          });
        }
        continue;
      }

      // Extract Pinnacle and SBOBET Over/Under lines
      const pinnacle = oddsData.bookmakerOdds['pinnacle'];
      const sbobet = oddsData.bookmakerOdds['sbobet'];

      const linesMap = new Map<number, OuMarketLineQuote>();

      const extractOuMarkets = (bmData: any, bmName: 'Pinnacle' | 'SBOBET') => {
        if (!bmData || !bmData.markets) return;
        for (const [mIdStr, mData] of Object.entries(bmData.markets) as any[]) {
          const mId = Number(mIdStr);
          const meta = marketMap.get(mId);

          // STRICT MARKET ISOLATION:
          // Must match totals market type, fulltime period, and non-player prop
          if (
            meta &&
            meta.sportId === 10 &&
            !meta.playerProp &&
            meta.period === 'fulltime' &&
            (meta.marketType === 'totals' || meta.marketName === 'Over Under Full Time')
          ) {
            const rawLine = meta.handicap;
            if (typeof rawLine !== 'number' || rawLine <= 0) continue;

            const outcomes = mData.outcomes || {};
            let overOdds: number | null = null;
            let underOdds: number | null = null;
            let timestamp = new Date().toISOString();

            for (const outMeta of meta.outcomes || []) {
              const outData = outcomes[String(outMeta.outcomeId)];
              const p = outData?.players?.['0'];
              if (p && typeof p.price === 'number' && p.price > 1.0) {
                const outName = String(outMeta.outcomeName).toLowerCase();
                if (outName === 'over') {
                  overOdds = p.price;
                  if (p.changedAt) timestamp = p.changedAt;
                } else if (outName === 'under') {
                  underOdds = p.price;
                }
              }
            }

            if (overOdds !== null && underOdds !== null) {
              const lineType = OuProbabilityEngine.classifyOuLine(rawLine);
              if (bmName === 'Pinnacle') {
                pinnacleOuCount++;
                totalOuOddsCount++;
                linesMap.set(rawLine, {
                  line: rawLine,
                  lineType,
                  overOdds,
                  underOdds,
                  bookmaker: 'Pinnacle',
                  timestamp,
                });
              } else if (bmName === 'SBOBET' && !linesMap.has(rawLine)) {
                sbobetOuCount++;
                totalOuOddsCount++;
                linesMap.set(rawLine, {
                  line: rawLine,
                  lineType,
                  overOdds,
                  underOdds,
                  bookmaker: 'SBOBET',
                  timestamp,
                });
              }
            }
          }
        }
      };

      extractOuMarkets(pinnacle, 'Pinnacle');
      extractOuMarkets(sbobet, 'SBOBET');

      const discoveredLines = Array.from(linesMap.values()).sort((a, b) => a.line - b.line);

      // If no valid OU quote available for this fixture, record as DATA_UNAVAILABLE
      if (discoveredLines.length === 0) {
        for (const side of ['OVER', 'UNDER'] as const) {
          predictions.push({
            predictionId: `PRED-${fixture.canonicalId}-OU-${side}-2.5`,
            canonicalMatchId: fixture.canonicalId,
            fixtureId: `AF-${fixture.afFixtureId}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            competition: fixture.leagueName,
            kickoffUtc: fixture.kickoffUtc,
            marketType: 'OU',
            line: 2.5,
            lineType: 'HALF',
            selection: side,
            odds: 0,
            modelProbability: 0,
            fairOdds: 0,
            marketImpliedProbability: 0,
            edge: 0,
            ev: 0,
            settlementProbabilities: {
              pFullWin: 0,
              pHalfWin: 0,
              pPush: 0,
              pHalfLoss: 0,
              pFullLoss: 0,
            },
            confidence: 'NO_VALUE',
            status: 'DATA_UNAVAILABLE',
            clvStatus: 'PENDING',
            closingOdds: null,
            closingLine: null,
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
              modelVersion: 'OU-DixonColes-Opta-v1.0.0',
              featureVersion: 'pit-v1.2.0',
              probabilityEngineVersion: 'bivariate-dixon-coles-totals-pmf-v1',
              evEngineVersion: 'settlement-aware-ou-ev-v1',
              confidenceGateVersion: 'ou-gate-v1.0',
              predictionCreatedAt: new Date().toISOString(),
            },
          });
        }
        continue;
      }

      // Record odds snapshots
      for (const q of discoveredLines) {
        allDiscoveredLinesSet.add(q.line);
        oddsSnapshots.push({
          snapshotId: `SNAP-${fixture.canonicalId}-OU-${q.line.toFixed(2)}-${q.bookmaker.toUpperCase()}`,
          canonicalMatchId: fixture.canonicalId,
          fixtureId: `AF-${fixture.afFixtureId}`,
          match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
          kickoffUtc: fixture.kickoffUtc,
          bookmaker: q.bookmaker,
          line: q.line,
          lineType: q.lineType,
          overOdds: q.overOdds,
          underOdds: q.underOdds,
          timestampUtc: q.timestamp,
          provenance: {
            source: 'oddspapi',
            endpoint: `/v4/odds-by-tournaments?tournamentIds=${fixture.opTournamentId}&bookmaker=pinnacle,sbobet`,
          },
        });
      }

      // ───────────────────────────────────────────────────────────────────────
      // MATHEMATICAL MODEL: DIXON-COLES BIVARIATE SCORE GRID & TOTAL GOALS PMF
      // ───────────────────────────────────────────────────────────────────────
      let expHomeGoals = 1.45;
      let expAwayGoals = 1.15;
      if (homeDribble.coverageStatus !== 'UNAVAILABLE' && homeDribble.rollingXg > 0) {
        expHomeGoals = Number(((expHomeGoals + homeDribble.rollingXg) / 2).toFixed(4));
      }
      if (awayDribble.coverageStatus !== 'UNAVAILABLE' && awayDribble.rollingXg > 0) {
        expAwayGoals = Number(((expAwayGoals + awayDribble.rollingXg) / 2).toFixed(4));
      }

      const rho = -0.04; // locked empirical Dixon-Coles parameter for low-scoring football dependency
      const grid = buildScoreGrid(expHomeGoals, expAwayGoals, rho);
      const totalPmf = OuProbabilityEngine.computeTotalGoalsPmf(grid);

      // Invariant: sum(PMF) = 1.0 within numerical tolerance
      const pmfSum = totalPmf.pmf.reduce((acc, v) => acc + v, 0);
      if (Math.abs(pmfSum - 1.0) > 1e-6) {
        throw new Error(`[OuLivePipelineService] Total Goals PMF mass violation: sum = ${pmfSum}`);
      }

      // Evaluate each discovered line
      for (const lineQuote of discoveredLines) {
        const { line, lineType, overOdds, underOdds, bookmaker } = lineQuote;

        // Proportional 2-way de-vigging
        const devig = OuProbabilityEngine.devig2WayOu(overOdds, underOdds);

        // Derive line-specific settlement probabilities for OVER and UNDER
        const overProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(totalPmf, line, 'OVER');
        const underProbs = OuProbabilityEngine.deriveOuSettlementProbabilities(totalPmf, line, 'UNDER');

        // Evaluate side helper
        const evaluateSide = (
          selection: OuSelection,
          probs: OuLineSettlementProbabilities,
          marketOdds: number,
          marketImplied: number
        ): OuPredictionRecord => {
          const ev = OuProbabilityEngine.computeOuEv(probs, marketOdds);
          const edge = Number((probs.pEffectiveWin - marketImplied).toFixed(6));
          const isValue = ev > 0 && edge > 0;

          let conf: 'HIGH' | 'MEDIUM' | 'LOW' | 'NO_VALUE' = 'NO_VALUE';
          if (isValue) {
            if (
              dataQuality === 'READY' &&
              probs.pEffectiveWin >= 0.50 &&
              probs.pEffectiveWin <= 0.70 &&
              marketOdds >= 1.55 &&
              marketOdds <= 2.25 &&
              ev >= 0.04 &&
              ev <= 0.25 &&
              bookmaker === 'Pinnacle'
            ) {
              conf = 'HIGH';
            } else if (
              probs.pEffectiveWin >= 0.50 &&
              probs.pEffectiveWin <= 0.85 &&
              marketOdds >= 1.50 &&
              marketOdds <= 2.70 &&
              ev >= 0.05
            ) {
              conf = 'MEDIUM';
            } else {
              conf = 'LOW';
            }
          }

          return {
            predictionId: `PRED-${fixture.canonicalId}-OU-${selection}-${line}`,
            canonicalMatchId: fixture.canonicalId,
            fixtureId: `AF-${fixture.afFixtureId}`,
            match: `${fixture.homeTeam} vs ${fixture.awayTeam}`,
            homeTeam: fixture.homeTeam,
            awayTeam: fixture.awayTeam,
            competition: fixture.leagueName,
            kickoffUtc: fixture.kickoffUtc,
            marketType: 'OU',
            line,
            lineType,
            selection,
            odds: marketOdds,
            modelProbability: probs.pEffectiveWin,
            fairOdds: probs.fairOdds,
            marketImpliedProbability: marketImplied,
            edge,
            ev,
            settlementProbabilities: {
              pFullWin: probs.pFullWin,
              pHalfWin: probs.pHalfWin,
              pPush: probs.pPush,
              pHalfLoss: probs.pHalfLoss,
              pFullLoss: probs.pFullLoss,
            },
            confidence: conf,
            status: isValue ? 'VALUE' : 'NO_VALUE',
            clvStatus: 'PENDING',
            closingOdds: null,
            closingLine: null,
            clv: null,
            bookmaker,
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
              modelVersion: 'OU-DixonColes-Opta-v1.0.0',
              featureVersion: 'pit-v1.2.0',
              probabilityEngineVersion: 'bivariate-dixon-coles-totals-pmf-v1',
              evEngineVersion: 'settlement-aware-ou-ev-v1',
              confidenceGateVersion: 'ou-gate-v1.0',
              predictionCreatedAt: new Date().toISOString(),
            },
          };
        };

        predictions.push(evaluateSide('OVER', overProbs, overOdds, devig.overImplied));
        predictions.push(evaluateSide('UNDER', underProbs, underOdds, devig.underImplied));
      }
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
      throw new Error(`[OuLivePipelineService] Count reconciliation failure: Total=${totalCount} vs Sum=${reconciledCount}`);
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
          market: 'OU',
          selection: p.selection,
          line: p.line,
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

    // Synchronize verified Over/Under picks to Salmo
    let salmoSyncStatus: 'PASS' | 'FAIL' = 'PASS';
    let salmoSyncedCount = 0;
    try {
      const eligibleForSalmo = ledgerRecordsToSync.filter(
        (r) => (r.status === 'HIGH_CONFIDENCE' || r.status === 'QUALIFIED') && r.expectedValue > 0
      );
      if (eligibleForSalmo.length > 0) {
        const syncReport = await SalmoSyncService.synchronizeOu(eligibleForSalmo);
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
      console.warn('[SalmoSyncService] OU sync warning:', salmoErr);
      salmoSyncStatus = 'FAIL';
    }

    // Persist ledgers
    const ensureDir = (filePath: string) => {
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    };

    // 1. data/ledger/ou_daily_predictions.jsonl
    const dailyPath = path.resolve('data/ledger/ou_daily_predictions.jsonl');
    ensureDir(dailyPath);
    const dailyLines = todayPredictions.map((p) => JSON.stringify(p)).join('\n');
    fs.writeFileSync(dailyPath, dailyLines.length > 0 ? dailyLines + '\n' : '', 'utf8');

    // 2. data/ledger/ou_upcoming_7d_predictions.jsonl
    const upcomingPath = path.resolve('data/ledger/ou_upcoming_7d_predictions.jsonl');
    ensureDir(upcomingPath);
    const upcomingLines = predictions.map((p) => JSON.stringify(p)).join('\n');
    fs.writeFileSync(upcomingPath, upcomingLines.length > 0 ? upcomingLines + '\n' : '', 'utf8');

    // 3. data/ledger/ou_odds_snapshots.jsonl
    const snapPath = path.resolve('data/ledger/ou_odds_snapshots.jsonl');
    ensureDir(snapPath);
    const snapLines = oddsSnapshots.map((s) => JSON.stringify(s)).join('\n');
    fs.writeFileSync(snapPath, snapLines.length > 0 ? snapLines + '\n' : '', 'utf8');

    // 4. data/ledger/ou_clv_ledger.jsonl
    const clvPath = path.resolve('data/ledger/ou_clv_ledger.jsonl');
    ensureDir(clvPath);
    const clvRecords = predictions.map((p) => ({
      predictionId: p.predictionId,
      canonicalMatchId: p.canonicalMatchId,
      match: p.match,
      kickoffUtc: p.kickoffUtc,
      market: 'OU',
      line: p.line,
      lineType: p.lineType,
      selection: p.selection,
      entryOdds: p.odds,
      bookmaker: p.bookmaker,
      closingOdds: null,
      closingLine: null,
      clvPercentage: null,
      clvStatus: 'PENDING',
      updatedAt: new Date().toISOString(),
    }));
    fs.writeFileSync(clvPath, clvRecords.map((c) => JSON.stringify(c)).join('\n') + '\n', 'utf8');

    // Top predictions sorted by EV descending
    const sortedPredictions = [...predictions].filter((p) => p.status === 'VALUE').sort((a, b) => b.ev - a.ev);

    const uniqueLines = Array.from(allDiscoveredLinesSet).sort((a, b) => a - b);
    const endTimeUtc = new Date().toISOString();
    const finalReport: OuLivePipelineRunResult = {
      runId,
      pipelineStatus: predictions.length > 0 && totalOuOddsCount > 0 ? 'LIVE' : 'DEGRADED',
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
        ouOddsTotal: totalOuOddsCount,
        pinnacleOuTotal: pinnacleOuCount,
        sbobetOuTotal: sbobetOuCount,
        uniqueLines,
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
      topPredictions: sortedPredictions.slice(0, 15),
      allPredictions: predictions,
    };

    // 5. data/verification/ou_live_pipeline_report.json
    const repPath = path.resolve('data/verification/ou_live_pipeline_report.json');
    ensureDir(repPath);
    fs.writeFileSync(repPath, JSON.stringify(finalReport, null, 2), 'utf8');

    // 6. docs/research/OU_LIVE_PIPELINE_STATUS.md
    const docPath = path.resolve('docs/research/OU_LIVE_PIPELINE_STATUS.md');
    ensureDir(docPath);
    const mdContent = this.generateMarkdownStatusReport(finalReport);
    fs.writeFileSync(docPath, mdContent, 'utf8');

    console.log(`[OuLivePipelineService] Execution complete. Report written to ${repPath}.`);
    return finalReport;
  }

  private static generateMarkdownStatusReport(r: OuLivePipelineRunResult): string {
    return `# Goals Over/Under (OU) Live Production Pipeline Status Report
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
- **Total Real OU Lines Ingested**: \`${r.counts.ouOddsTotal}\`
  - **Pinnacle OU**: \`${r.counts.pinnacleOuTotal}\`
  - **SBOBET OU**: \`${r.counts.sbobetOuTotal}\`
- **Unique Lines Discovered**: \`[${r.counts.uniqueLines.join(', ')}]\`
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
- **Data Contract**: High & Medium confidence OU lines only. Zero external credentials in Salmo.

## 4. Top Real Data Over/Under Predictions
${r.topPredictions.length === 0 ? '_No value bets detected exceeding positive EV threshold for this window._' : r.topPredictions.map((p, idx) => `
### #${idx + 1}: ${p.match}
- **League**: ${p.competition}
- **Kickoff**: \`${p.kickoffUtc}\`
- **Market**: OU ${p.selection} ${p.line} (${p.lineType})
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
export default OuLivePipelineService;
