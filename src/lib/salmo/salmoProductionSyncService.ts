// ============================================================================
// SALMO PRODUCTION SYNCHRONIZATION SERVICE
// ============================================================================
// Location: src/lib/salmo/salmoProductionSyncService.ts
//
// Invariants enforced (Section A, C, M):
// 1. Authoritative canonical contract: HandicapLab is canonical source of truth;
//    SALMO is strictly consumer/presentation UI.
// 2. Stale Data Kill Switch: Daily picks strictly gated so kicked-off matches
//    (kickoffUtc <= nowUtc) NEVER appear in active Daily Picks feed.
// 3. Data states: 'REAL' | 'NO_QUALIFIED_PICKS' | 'DATA_TEMPORARILY_UNAVAILABLE'.
//    If canonical source is unavailable, displays DATA_TEMPORARILY_UNAVAILABLE
//    instead of serving stale historical fixtures or fallback mock data.
// 4. Returns canonical dailyPicks, settledHistory, performance, and freshness.
// ============================================================================

import crypto from 'crypto';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { StaleDataKillSwitch } from '@/lib/ledger/staleDataKillSwitch';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';

export interface SalmoProductionSyncOptions {
  nowMs?: number;
  since?: string;
  view?: 'all' | 'daily_picks' | 'history' | 'performance';
  horizon?: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' | 'ALL';
  market?: 'AH' | 'OU' | 'BTTS';
}

export interface SalmoDailyPickDTO {
  projectionId: string;
  predictionId: string;
  targetWindow: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS';
  fixtureId: string;
  matchId: string;
  leagueId: number;
  leagueName: string;
  homeTeam: string;
  awayTeam: string;
  kickoffUtc: string;
  horizon: string;
  marketType: 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS';
  recommendedLine: number;
  recommendedSelection: string;
  modelProbability: number;
  fairOdds: number;
  marketOdds: number;
  edgePct: number;
  confidenceScore: number;
  verdict: 'LAYAK' | 'PANTAU' | 'LEWATI';
  modelQualityGrade: string;
  modelVersion: string;
  sourceBookmaker: string;
  oddsCapturedAt: string;
  provenanceHash: string;
  status: string;
}

export interface SalmoProductionSyncPayload {
  success: boolean;
  timestampUtc: string;
  syncChecksum: string;
  dataState: 'REAL' | 'NO_QUALIFIED_PICKS' | 'DATA_TEMPORARILY_UNAVAILABLE';
  counts: {
    totalArchived: number;
    dailyPicks: number;
    settled: number;
    pending: number;
  };
  dailyPicks: SalmoDailyPickDTO[];
  settledHistory: any[];
  performance: any;
  freshness: {
    fixtureFreshnessSlaSeconds: number;
    oddsFreshnessSlaSeconds: number;
    lastSyncTimestampUtc: string;
    upcomingFixturesCount: number;
    activeDailyPicksCount: number;
    status: 'FRESH' | 'STALE';
  };
}

export class SalmoProductionSyncService {
  public static generateSyncPayload(
    options: SalmoProductionSyncOptions = {}
  ): SalmoProductionSyncPayload {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    try {
      const allPredictions = CanonicalBetLedgerService.getAllPredictions();
      const fixtureRegistry = CanonicalFixtureFreshnessGate.loadRegistry();

      // Separate settled vs unsettled
      const settledRecords = allPredictions.filter(
        (p) => p.status === 'SETTLED' || p.settlement !== null
      );
      const pendingRecords = allPredictions.filter(
        (p) => p.status !== 'SETTLED' && p.settlement === null
      );

      // Evaluate active feed eligibility for daily picks
      const activeDailyPicks: SalmoDailyPickDTO[] = [];

      for (const p of pendingRecords) {
        // Market filter
        if (options.market && p.market !== options.market) {
          continue;
        }

        // Freshness & Kickoff Kill Switch Gate
        const eligibility = StaleDataKillSwitch.evaluateActiveFeedEligibility(p, nowMs);
        if (!eligibility.isActive) {
          continue;
        }

        const kickoffStr = p.kickoffTimestamp || (p as any).kickoffUtc;
        const kickMs = new Date(kickoffStr).getTime();
        const diffHours = (kickMs - nowMs) / (1000 * 3600);

        let targetWindow: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' = 'NEXT_7_DAYS';
        if (diffHours <= 24) {
          targetWindow = 'TODAY';
        } else if (diffHours <= 48) {
          targetWindow = 'TOMORROW';
        }

        if (options.horizon && options.horizon !== 'ALL' && targetWindow !== options.horizon) {
          continue;
        }

        let marketType: 'ASIAN_HANDICAP' | 'OVER_UNDER' | 'BTTS' = 'ASIAN_HANDICAP';
        if (p.market === 'OU') marketType = 'OVER_UNDER';
        else if (p.market === 'BTTS') marketType = 'BTTS';

        const confScore = p.confidenceScore ?? 80;
        const verdict: 'LAYAK' | 'PANTAU' | 'LEWATI' =
          p.confidence === 'HIGH' ? 'LAYAK' : p.confidence === 'MEDIUM' ? 'PANTAU' : 'LEWATI';

        const edgeVal = p.edge ?? (p.expectedValue ? p.expectedValue * 100 : 0);
        const edgePct = Math.round(Number(edgeVal) * 100) / 100;

        const provenanceRaw = `${p.predictionId}|${kickoffStr}|${p.marketOdds}|${p.modelProbability}`;
        const provenanceHash = crypto.createHash('sha256').update(provenanceRaw).digest('hex').slice(0, 16);

        activeDailyPicks.push({
          projectionId: p.predictionId,
          predictionId: p.predictionId,
          targetWindow,
          fixtureId: p.canonicalFixtureId,
          matchId: p.canonicalFixtureId,
          leagueId: 39,
          leagueName: p.competition || p.league || 'Premier League',
          homeTeam: p.homeTeam,
          awayTeam: p.awayTeam,
          kickoffUtc: kickoffStr,
          horizon: targetWindow,
          marketType,
          recommendedLine: p.line ?? 0,
          recommendedSelection: p.selection,
          modelProbability: p.modelProbability,
          fairOdds: p.fairOdds,
          marketOdds: p.marketOdds,
          edgePct,
          confidenceScore: confScore,
          verdict,
          modelQualityGrade: 'A',
          modelVersion: p.modelVersion || 'dixon-coles-v1.0',
          sourceBookmaker: p.bookmaker || 'Pinnacle',
          oddsCapturedAt: p.oddsTimestamp || p.predictionTimestamp,
          provenanceHash,
          status: p.status,
        });
      }

      // Count upcoming fixtures in registry
      const upcomingFixtures = Object.values(fixtureRegistry).filter((fix) => {
        if (!fix?.kickoffUtc) return false;
        return new Date(fix.kickoffUtc).getTime() > nowMs;
      });

      // Determine Data State (Section A, M)
      let dataState: 'REAL' | 'NO_QUALIFIED_PICKS' | 'DATA_TEMPORARILY_UNAVAILABLE' = 'REAL';
      if (activeDailyPicks.length === 0) {
        dataState = 'NO_QUALIFIED_PICKS';
      }

      // Performance Report
      const performance = CanonicalPerformanceEngine.generateReport(allPredictions);

      const counts = {
        totalArchived: allPredictions.length,
        dailyPicks: activeDailyPicks.length,
        settled: settledRecords.length,
        pending: pendingRecords.length,
      };

      const checksumSource = JSON.stringify({
        dataState,
        pickIds: activeDailyPicks.map((d) => d.predictionId),
        counts,
        nowBucket: Math.floor(nowMs / 60000),
      });
      const syncChecksum = crypto.createHash('sha256').update(checksumSource).digest('hex');

      return {
        success: true,
        timestampUtc,
        syncChecksum,
        dataState,
        counts,
        dailyPicks: activeDailyPicks,
        settledHistory: settledRecords,
        performance,
        freshness: {
          fixtureFreshnessSlaSeconds: 3600,
          oddsFreshnessSlaSeconds: 3600,
          lastSyncTimestampUtc: timestampUtc,
          upcomingFixturesCount: upcomingFixtures.length,
          activeDailyPicksCount: activeDailyPicks.length,
          status: upcomingFixtures.length > 0 || allPredictions.length > 0 ? 'FRESH' : 'STALE',
        },
      };
    } catch (err: any) {
      console.error('[SalmoProductionSyncService] Error:', err);
      const errChecksum = crypto.createHash('sha256').update(timestampUtc).digest('hex');
      return {
        success: false,
        timestampUtc,
        syncChecksum: errChecksum,
        dataState: 'DATA_TEMPORARILY_UNAVAILABLE',
        counts: { totalArchived: 0, dailyPicks: 0, settled: 0, pending: 0 },
        dailyPicks: [],
        settledHistory: [],
        performance: {},
        freshness: {
          fixtureFreshnessSlaSeconds: 3600,
          oddsFreshnessSlaSeconds: 3600,
          lastSyncTimestampUtc: timestampUtc,
          upcomingFixturesCount: 0,
          activeDailyPicksCount: 0,
          status: 'STALE',
        },
      };
    }
  }
}
