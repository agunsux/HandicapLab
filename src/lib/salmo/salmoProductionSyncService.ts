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

import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { CanonicalBetLedgerService } from '@/lib/ledger/canonicalBetLedger';
import { CanonicalPerformanceEngine } from '@/lib/ledger/canonicalPerformanceEngine';
import { StaleDataKillSwitch } from '@/lib/ledger/staleDataKillSwitch';
import { CanonicalFixtureFreshnessGate } from '@/lib/services/canonicalFixtureFreshnessGate';
import { GcsLedgerStorage } from '@/lib/pipeline/rescue/gcsLedgerStorage';

export interface SalmoProductionSyncOptions {
  nowMs?: number;
  since?: string;
  view?: 'all' | 'daily_picks' | 'history' | 'performance';
  horizon?: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' | 'ALL';
  market?: 'AH' | 'OU' | 'BTTS';
  modelVersion?: string;
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
  predictions?: any[];
}

export class SalmoProductionSyncService {
  /**
   * Helper to load rescue ledger rows synchronously (local filesystem or warm cache).
   */
  public static loadRescueRowsSync(): { rows: any[]; source: 'local' | 'cache' | 'none'; error?: string } {
    const rescueCandidates = [
      path.resolve(process.cwd(), 'data/ledger/rescue_prediction_ledger.jsonl'),
      path.resolve(os.tmpdir(), 'rescue_prediction_ledger.jsonl'),
      path.resolve('data/ledger/rescue_prediction_ledger.jsonl'),
    ];

    for (const p of rescueCandidates) {
      if (fs.existsSync(p)) {
        try {
          const content = fs.readFileSync(p, 'utf8');
          const validation = GcsLedgerStorage.validateLedgerContent(content);
          if (validation.valid && validation.rows.length > 0) {
            return { rows: validation.rows, source: 'local' };
          }
        } catch (e: any) {
          console.warn('[SalmoProductionSyncService] Error parsing local rescue ledger:', e?.message);
        }
      }
    }

    // Check warm in-memory cache
    const cached = GcsLedgerStorage.getCachedRows();
    if (cached && cached.length > 0) {
      return { rows: cached, source: 'cache' };
    }

    return { rows: [], source: 'none', error: 'LEDGER_UNAVAILABLE' };
  }

  /**
   * Helper to load rescue ledger rows asynchronously with durable GCS fallback.
   */
  public static async loadRescueRowsAsync(): Promise<{ rows: any[]; source: 'local' | 'cache' | 'gcs' | 'none'; error?: string }> {
    // 1. Check local files
    const syncRes = this.loadRescueRowsSync();
    if (syncRes.source === 'local' && syncRes.rows.length > 0) {
      return { rows: syncRes.rows, source: 'local' };
    }

    // 2. Check warm cache
    if (syncRes.source === 'cache' && syncRes.rows.length > 0) {
      return { rows: syncRes.rows, source: 'cache' };
    }

    // 3. Fall back to durable storage in GCS
    try {
      const gcsRows = await GcsLedgerStorage.getValidatedRows();
      if (gcsRows && gcsRows.length > 0) {
        return { rows: gcsRows, source: 'gcs' };
      }
    } catch (e: any) {
      console.warn('[SalmoProductionSyncService] GCS fallback failed:', e?.message);
    }

    return { rows: [], source: 'none', error: 'LEDGER_UNAVAILABLE' };
  }

  public static buildUnavailablePayload(timestampUtc: string): SalmoProductionSyncPayload {
    const counts = { totalArchived: 0, dailyPicks: 0, settled: 0, pending: 0 };
    const checksumSource = JSON.stringify({
      dataState: 'DATA_TEMPORARILY_UNAVAILABLE',
      pickIds: [],
      counts,
      nowBucket: Math.floor(Date.now() / 60000),
    });
    const syncChecksum = crypto.createHash('sha256').update(checksumSource).digest('hex');

    return {
      success: false,
      timestampUtc,
      syncChecksum,
      dataState: 'DATA_TEMPORARILY_UNAVAILABLE',
      counts,
      dailyPicks: [],
      settledHistory: [],
      performance: {
        modelVersion: 'poisson_v1_rescue',
        totalPredictions: 0,
        settledBets: 0,
        totalPicks: 0,
        status: 'UNAVAILABLE',
      },
      freshness: {
        fixtureFreshnessSlaSeconds: 3600,
        oddsFreshnessSlaSeconds: 3600,
        lastSyncTimestampUtc: timestampUtc,
        upcomingFixturesCount: 0,
        activeDailyPicksCount: 0,
        status: 'STALE',
      },
      predictions: [],
    };
  }

  private static buildRescuePayload(
    rescueRows: any[],
    options: SalmoProductionSyncOptions,
    nowMs: number,
    timestampUtc: string
  ): SalmoProductionSyncPayload {
    // Model version isolation (Section 8)
    let filteredRescue = rescueRows.filter(
      (r) => !options.modelVersion || r.model_version === options.modelVersion || r.model_version === 'poisson_v1_rescue'
    );

    // Apply query filters
    if (options.since) {
      filteredRescue = filteredRescue.filter(
        (r) => (r.created_at || r.kickoff_utc) >= options.since!
      );
    }
    if (options.market) {
      filteredRescue = filteredRescue.filter((r) => r.market === options.market);
    }

    const settledRecords = filteredRescue.filter(
      (r) => r.settlement?.status === 'SETTLED'
    );
    const pendingRecords = filteredRescue.filter(
      (r) => r.settlement?.status !== 'SETTLED'
    );

    // Invariant: Predictions != picks. Only actionable picks passing ConfidenceGate
    // and having kickoff > nowMs are eligible for active dailyPicks feed.
    const activeDailyPicks: SalmoDailyPickDTO[] = [];
    for (const r of pendingRecords) {
      if (!r.is_pick) continue;
      const kickMs = new Date(r.kickoff_utc).getTime();
      if (isNaN(kickMs) || kickMs <= nowMs) continue;

      const diffHours = (kickMs - nowMs) / (1000 * 3600);
      let targetWindow: 'TODAY' | 'TOMORROW' | 'NEXT_7_DAYS' = 'NEXT_7_DAYS';
      if (diffHours <= 24) targetWindow = 'TODAY';
      else if (diffHours <= 48) targetWindow = 'TOMORROW';

      if (
        options.horizon &&
        options.horizon !== 'ALL' &&
        targetWindow !== options.horizon
      ) {
        continue;
      }

      activeDailyPicks.push({
        projectionId: r.id,
        predictionId: r.id,
        targetWindow,
        fixtureId: String(r.fixture_id),
        matchId: String(r.fixture_id),
        leagueId: r.competition_id || 39,
        leagueName: r.competition || 'Top League',
        homeTeam: r.home_team,
        awayTeam: r.away_team,
        kickoffUtc: r.kickoff_utc,
        horizon: targetWindow,
        marketType:
          r.market === 'AH'
            ? 'ASIAN_HANDICAP'
            : r.market === 'OU'
            ? 'OVER_UNDER'
            : 'BTTS',
        recommendedLine: r.line ?? 0,
        recommendedSelection: r.selection,
        modelProbability: r.calibrated_probability ?? r.model_probability,
        fairOdds: r.fair_odds,
        marketOdds: r.market_odds ?? 0,
        edgePct: r.edge_pct ?? 0,
        confidenceScore: r.confidence_score ?? 0,
        verdict:
          r.confidence_tier === 'VALUE_HIGH'
            ? 'LAYAK'
            : r.confidence_tier === 'WATCH'
            ? 'PANTAU'
            : 'LEWATI',
        modelQualityGrade: 'A',
        modelVersion: r.model_version || 'poisson_v1_rescue',
        sourceBookmaker: r.odds_snapshot?.bookmaker || 'Pinnacle',
        oddsCapturedAt: r.odds_snapshot?.timestamp || r.created_at,
        provenanceHash: r.id,
        status: r.settlement?.status || 'PENDING',
      });
    }

    const upcomingFixtures = Array.from(
      new Set(
        filteredRescue
          .filter((r) => new Date(r.kickoff_utc).getTime() > nowMs)
          .map((r) => r.fixture_id)
      )
    );

    const dataState: 'REAL' | 'NO_QUALIFIED_PICKS' | 'DATA_TEMPORARILY_UNAVAILABLE' =
      activeDailyPicks.length > 0 ? 'REAL' : 'NO_QUALIFIED_PICKS';

    const counts = {
      totalArchived: filteredRescue.length,
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
    const syncChecksum = crypto
      .createHash('sha256')
      .update(checksumSource)
      .digest('hex');

    return {
      success: true,
      timestampUtc,
      syncChecksum,
      dataState,
      counts,
      dailyPicks: activeDailyPicks,
      settledHistory: settledRecords,
      performance: {
        modelVersion: 'poisson_v1_rescue',
        totalPredictions: filteredRescue.length,
        settledBets: settledRecords.length,
        totalPicks: activeDailyPicks.length,
        status: 'WALK_FORWARD_VALIDATED',
      },
      freshness: {
        fixtureFreshnessSlaSeconds: 3600,
        oddsFreshnessSlaSeconds: 3600,
        lastSyncTimestampUtc: timestampUtc,
        upcomingFixturesCount: upcomingFixtures.length,
        activeDailyPicksCount: activeDailyPicks.length,
        status:
          upcomingFixtures.length > 0 || filteredRescue.length > 0
            ? 'FRESH'
            : 'STALE',
      },
      predictions: filteredRescue,
    };
  }

  /**
   * Asynchronous version of generateSyncPayload that supports reading the durable rescue ledger from GCS.
   */
  public static async generateSyncPayloadAsync(
    options: SalmoProductionSyncOptions = {}
  ): Promise<SalmoProductionSyncPayload> {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    if (
      options.modelVersion === 'poisson_v1_rescue' ||
      options.modelVersion?.toLowerCase().includes('rescue')
    ) {
      const loadRes = await this.loadRescueRowsAsync();
      if (loadRes.error || loadRes.rows.length === 0) {
        return this.buildUnavailablePayload(timestampUtc);
      }
      return this.buildRescuePayload(loadRes.rows, options, nowMs, timestampUtc);
    }

    return this.generateSyncPayload(options);
  }

  public static generateSyncPayload(
    options: SalmoProductionSyncOptions = {}
  ): SalmoProductionSyncPayload {
    const nowMs = options.nowMs ?? Date.now();
    const timestampUtc = new Date(nowMs).toISOString();

    try {
      if (
        options.modelVersion === 'poisson_v1_rescue' ||
        options.modelVersion?.toLowerCase().includes('rescue')
      ) {
        const loadRes = this.loadRescueRowsSync();
        if (loadRes.error || loadRes.rows.length === 0) {
          return this.buildUnavailablePayload(timestampUtc);
        }
        return this.buildRescuePayload(loadRes.rows, options, nowMs, timestampUtc);
      }

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
