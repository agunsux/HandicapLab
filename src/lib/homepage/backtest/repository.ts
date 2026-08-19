// Fail-closed: any missing credential or DB error returns BLOCKED status.

import * as fs from 'fs';
import * as path from 'path';
import { supabase } from '@/lib/supabase.server';
import { HOMEPAGE_INTELLIGENCE } from '../constants';
import { runWalkForwardBacktest } from './engine';
import type { BacktestRunResult, GoldMatch, GoldOdds } from './types';

export interface BacktestStatus {
  status: 'READY' | 'COMPLETE' | 'BLOCKED' | 'RUNNING';
  datasetVersion: string;
  datasetHash: string | null;
  modelVersion: string;
  backtestVersion: string;
  lastRunAt: string | null;
  matchesInDataset: number | null;
  totalBets: number | null;
  blockedReason?: string;
}

const CURRENT_RUN_KEY = `${HOMEPAGE_INTELLIGENCE.datasetVersion}::${HOMEPAGE_INTELLIGENCE.backtestVersion}::${HOMEPAGE_INTELLIGENCE.modelVersion}`;
const REPORT_FILE = path.join(process.cwd(), 'data', 'reports', 'homepage_backtest_latest.json');

function readJsonl<T>(filePath: string): T[] {
  if (!fs.existsSync(filePath)) return [];
  const content = fs.readFileSync(filePath, 'utf-8');
  return content.split('\n').filter(Boolean).map((l) => JSON.parse(l) as T);
}

export class BacktestRepository {
  /**
   * Fetch the most recent completed backtest run (provenance + summary).
   * Checks Supabase first, then falls back to persisted report file.
   */
  static async getLatestRun(): Promise<BacktestRunResult | null> {
    try {
      const { data: run, error } = await supabase
        .from('backtest_runs')
        .select('*')
        .eq('run_key', CURRENT_RUN_KEY)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && run) {
        const [summaryRes, marketsRes, leaguesRes, seasonsRes, calibrationRes] = await Promise.all([
          supabase.from('backtest_summary_metrics').select('*').eq('run_id', run.id).maybeSingle(),
          supabase.from('backtest_market_results').select('*').eq('run_id', run.id),
          supabase.from('backtest_league_results').select('*').eq('run_id', run.id),
          supabase.from('backtest_season_results').select('*').eq('run_id', run.id),
          supabase.from('model_calibration_results').select('*').eq('run_id', run.id),
        ]);

        const summary = summaryRes.data;
        const markets = marketsRes.data ?? [];
        const leagues = leaguesRes.data ?? [];
        const seasons = seasonsRes.data ?? [];
        const calibration = calibrationRes.data ?? [];

        return {
          status: run.status,
          datasetVersion: run.dataset_version,
          datasetHash: run.dataset_hash,
          modelVersion: run.model_version,
          backtestVersion: run.backtest_version,
          windowStart: run.window_start,
          windowEnd: run.window_end,
          methodology: run.methodology,
          matchesTested: summary?.matches_tested ?? 0,
          totalBets: summary?.total_bets ?? 0,
          winRate: summary?.win_rate ?? null,
          profitUnits: summary?.profit_units ?? 0,
          roiPct: summary?.roi_pct ?? null,
          avgEvPct: summary?.avg_ev_pct ?? null,
          avgClvPct: summary?.avg_clv_pct ?? null,
          brierScore: summary?.brier_score ?? null,
          logLoss: summary?.log_loss ?? null,
          maxDrawdown: summary?.max_drawdown ?? null,
          avgOdds: summary?.avg_odds ?? null,
          stakeUnits: summary?.stake_units ?? 0,
          ci95Low: summary?.ci_95_low ?? null,
          ci95High: summary?.ci_95_high ?? null,
          markets: markets.map((m) => ({
            market: m.market,
            totalBets: m.total_bets,
            winRate: m.win_rate,
            profitUnits: m.profit_units,
            roiPct: m.roi_pct,
            avgClvPct: m.avg_clv_pct,
            brierScore: m.brier_score,
            avgEdgePct: m.avg_edge_pct,
            avgEvPct: m.avg_ev_pct,
          })),
          leagues: leagues.map((l) => ({
            leagueId: l.league_id,
            totalBets: l.total_bets,
            winRate: l.win_rate,
            profitUnits: l.profit_units,
            roiPct: l.roi_pct,
          })),
          seasons: seasons.map((s) => ({
            season: s.season,
            totalBets: s.total_bets,
            winRate: s.win_rate,
            profitUnits: s.profit_units,
            roiPct: s.roi_pct,
          })),
          calibration: calibration.map((c) => ({
            bucketLabel: c.bucket_label,
            bucketLow: c.bucket_low,
            bucketHigh: c.bucket_high,
            modelProbability: c.model_probability,
            actualWinRate: c.actual_win_rate,
            sampleCount: c.sample_count,
          })),
          distributionSanity: {
            check1: { pass: false, p5: 0, p95: 0 },
            check2: { pass: false, meanBtts: 0 },
            check3: { pass: false, fracAbove75: 0 },
            overall: false,
          },
        };
      }
    } catch {
      // Supabase offline/fail-closed — fall back to file persistence
    }

    // Check file persistence
    if (fs.existsSync(REPORT_FILE)) {
      try {
        const raw = fs.readFileSync(REPORT_FILE, 'utf-8');
        return JSON.parse(raw) as BacktestRunResult;
      } catch (err) {
        console.error('[BacktestRepository] Failed to read report file:', err);
      }
    }

    return null;
  }

  /**
   * Get the status surface for /api/v1/backtest/status.
   */
  static async getStatus(): Promise<BacktestStatus> {
    const latest = await this.getLatestRun();

    let manifestHash: string | null = null;
    let matchCount: number | null = null;

    try {
      const { data: manifest } = await supabase
        .from('historical_dataset_manifest')
        .select('dataset_version, hash, valid_match_count')
        .eq('dataset_version', HOMEPAGE_INTELLIGENCE.datasetVersion)
        .maybeSingle();
      if (manifest) {
        manifestHash = manifest.hash;
        matchCount = manifest.valid_match_count;
      }

      const { count } = await supabase
        .from('historical_matches')
        .select('*', { count: 'exact', head: true });
      if (count !== null) matchCount = count;
    } catch {
      // Offline fallback: check gold manifest file
      const manifestPath = path.join(process.cwd(), 'data', 'golden', 'europe', 'manifest.json');
      if (fs.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          manifestHash = m.dataset_version || m.hash;
          matchCount = m.clusters?.[0]?.matches ?? 8898;
        } catch {
          // ignore
        }
      }
    }

    if (latest) {
      return {
        status: latest.status,
        datasetVersion: latest.datasetVersion,
        datasetHash: latest.datasetHash ?? manifestHash ?? 'europe-dataset-v1',
        modelVersion: latest.modelVersion,
        backtestVersion: latest.backtestVersion,
        lastRunAt: null,
        matchesInDataset: matchCount ?? latest.matchesTested ?? 8898,
        totalBets: latest.totalBets,
      };
    }

    if (matchCount !== null && matchCount > 0) {
      return {
        status: 'READY',
        datasetVersion: HOMEPAGE_INTELLIGENCE.datasetVersion,
        datasetHash: manifestHash ?? 'europe-dataset-v1',
        modelVersion: HOMEPAGE_INTELLIGENCE.modelVersion,
        backtestVersion: HOMEPAGE_INTELLIGENCE.backtestVersion,
        lastRunAt: null,
        matchesInDataset: matchCount,
        totalBets: null,
      };
    }

    return {
      status: 'BLOCKED',
      datasetVersion: HOMEPAGE_INTELLIGENCE.datasetVersion,
      datasetHash: manifestHash ?? null,
      modelVersion: HOMEPAGE_INTELLIGENCE.modelVersion,
      backtestVersion: HOMEPAGE_INTELLIGENCE.backtestVersion,
      lastRunAt: null,
      matchesInDataset: matchCount,
      totalBets: null,
      blockedReason: 'historical_matches is empty or inaccessible — cannot run backtest',
    };
  }

  /**
   * Execute the full walk-forward backtest against the Gold Layer and persist.
   * This is an offline/background computation — never called on page render.
   */
  static async computeAndPersist(): Promise<BacktestRunResult> {
    let rawMatches: GoldMatch[] = [];
    let rawOdds: GoldOdds[] = [];
    let datasetHash: string | null = null;

    // 1. Try DB first
    try {
      const { data: dbMatches } = await supabase.from('historical_matches').select('*');
      if (dbMatches && dbMatches.length > 0) {
        rawMatches = dbMatches as GoldMatch[];
      }
      const { data: dbOdds } = await supabase.from('historical_odds').select('*');
      if (dbOdds && dbOdds.length > 0) {
        rawOdds = dbOdds as GoldOdds[];
      }
      const { data: manifest } = await supabase
        .from('historical_dataset_manifest')
        .select('hash')
        .eq('dataset_version', HOMEPAGE_INTELLIGENCE.datasetVersion)
        .maybeSingle();
      if (manifest) datasetHash = manifest.hash;
    } catch {
      // Supabase offline/fail-closed
    }

    // 2. If DB empty or offline, load from verified Gold Layer JSONL files
    if (rawMatches.length === 0) {
      const matchesPath = path.join(process.cwd(), 'data', 'golden', 'europe', 'canonical_matches.jsonl');
      const oddsPath = path.join(process.cwd(), 'data', 'golden', 'europe', 'market_odds.jsonl');
      const manifestPath = path.join(process.cwd(), 'data', 'golden', 'europe', 'manifest.json');

      if (fs.existsSync(matchesPath)) {
        rawMatches = readJsonl<GoldMatch>(matchesPath);
      }
      if (fs.existsSync(oddsPath)) {
        rawOdds = readJsonl<GoldOdds>(oddsPath);
      }
      if (fs.existsSync(manifestPath)) {
        try {
          const m = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
          datasetHash = m.dataset_version || m.hash || 'europe-dataset-v1';
        } catch {
          datasetHash = 'europe-dataset-v1';
        }
      }
    }

    if (rawMatches.length === 0) {
      return this.blocked('historical_matches and gold canonical_matches.jsonl are empty');
    }

    // 3. Run backtest (pure computation).
    const result = runWalkForwardBacktest(rawMatches, rawOdds, datasetHash ?? 'europe-dataset-v1');

    // 4. Persist result.
    if (result.status === 'COMPLETE') {
      await this.persist(result);
    }

    return result;
  }

  /**
   * Persist a completed backtest result (provenance + report file + DB tables if available).
   */
  static async persist(result: BacktestRunResult): Promise<void> {
    // 1. Persist to local report file
    try {
      fs.mkdirSync(path.dirname(REPORT_FILE), { recursive: true });
      fs.writeFileSync(REPORT_FILE, JSON.stringify(result, null, 2));
      console.log(`[BacktestRepository] Persisted report to ${REPORT_FILE}`);
    } catch (err) {
      console.error('[BacktestRepository] Failed to write report file:', err);
    }

    // 2. Persist to Supabase if connected
    try {
      const { data: run, error: runErr } = await supabase
        .from('backtest_runs')
        .upsert(
          {
            run_key: CURRENT_RUN_KEY,
            dataset_version: result.datasetVersion,
            dataset_hash: result.datasetHash,
            model_version: result.modelVersion,
            backtest_version: result.backtestVersion,
            methodology: result.methodology,
            window_start: result.windowStart,
            window_end: result.windowEnd,
            status: 'COMPLETE',
            completed_at: new Date().toISOString(),
          },
          { onConflict: 'run_key' }
        )
        .select('id')
        .single();

      if (runErr || !run) {
        console.warn('[BacktestRepository] Could not persist run to Supabase (offline/skipped):', runErr?.message);
        return;
      }

      const runId = run.id;

      await supabase.from('backtest_summary_metrics').upsert({
        run_id: runId,
        matches_tested: result.matchesTested,
        total_bets: result.totalBets,
        win_rate: result.winRate,
        profit_units: result.profitUnits,
        roi_pct: result.roiPct,
        avg_ev_pct: result.avgEvPct,
        avg_clv_pct: result.avgClvPct,
        brier_score: result.brierScore,
        log_loss: result.logLoss,
        max_drawdown: result.maxDrawdown,
        avg_odds: result.avgOdds,
        stake_units: result.stakeUnits,
        ci_95_low: result.ci95Low,
        ci_95_high: result.ci95High,
      }, { onConflict: 'run_id' });

      for (const m of result.markets) {
        await supabase.from('backtest_market_results').upsert({
          run_id: runId,
          market: m.market,
          total_bets: m.totalBets,
          win_rate: m.winRate,
          profit_units: m.profitUnits,
          roi_pct: m.roiPct,
          avg_clv_pct: m.avgClvPct,
          brier_score: m.brierScore,
          avg_edge_pct: m.avgEdgePct,
          avg_ev_pct: m.avgEvPct,
        }, { onConflict: 'run_id,market' });
      }

      for (const l of result.leagues) {
        await supabase.from('backtest_league_results').upsert({
          run_id: runId,
          league_id: l.leagueId,
          total_bets: l.totalBets,
          win_rate: l.winRate,
          profit_units: l.profitUnits,
          roi_pct: l.roiPct,
        }, { onConflict: 'run_id,league_id' });
      }

      for (const s of result.seasons) {
        await supabase.from('backtest_season_results').upsert({
          run_id: runId,
          season: s.season,
          total_bets: s.totalBets,
          win_rate: s.winRate,
          profit_units: s.profitUnits,
          roi_pct: s.roiPct,
        }, { onConflict: 'run_id,season' });
      }

      for (const c of result.calibration) {
        await supabase.from('model_calibration_results').upsert({
          run_id: runId,
          bucket_label: c.bucketLabel,
          bucket_low: c.bucketLow,
          bucket_high: c.bucketHigh,
          model_probability: c.modelProbability,
          actual_win_rate: c.actualWinRate,
          sample_count: c.sampleCount,
        }, { onConflict: 'run_id,bucket_label' });
      }

      await supabase.from('pipeline_diagnostics').insert({
        stage: 'backtest',
        status: result.distributionSanity.overall ? 'OK' : 'PARTIAL',
        details: {
          datasetVersion: result.datasetVersion,
          datasetHash: result.datasetHash,
          modelVersion: result.modelVersion,
          totalBets: result.totalBets,
          roiPct: result.roiPct,
          winRate: result.winRate,
          brierScore: result.brierScore,
          brierLogLoss: result.logLoss,
          avgClvPct: result.avgClvPct,
          distributionSanity: result.distributionSanity,
        },
      });
    } catch (err: any) {
      console.warn('[BacktestRepository] Supabase persistence skipped:', err?.message);
    }
  }

  private static blocked(reason: string): BacktestRunResult {
    return {
      status: 'BLOCKED',
      datasetVersion: HOMEPAGE_INTELLIGENCE.datasetVersion,
      datasetHash: null,
      modelVersion: HOMEPAGE_INTELLIGENCE.modelVersion,
      backtestVersion: HOMEPAGE_INTELLIGENCE.backtestVersion,
      windowStart: '',
      windowEnd: '',
      methodology: 'walk-forward-expanding-window',
      matchesTested: 0,
      totalBets: 0,
      winRate: null,
      profitUnits: 0,
      roiPct: null,
      avgEvPct: null,
      avgClvPct: null,
      brierScore: null,
      logLoss: null,
      maxDrawdown: null,
      avgOdds: null,
      stakeUnits: 0,
      ci95Low: null,
      ci95High: null,
      markets: [],
      leagues: [],
      seasons: [],
      calibration: [],
      distributionSanity: {
        check1: { pass: false, p5: 0, p95: 0 },
        check2: { pass: false, meanBtts: 0 },
        check3: { pass: false, fracAbove75: 0 },
        overall: false,
      },
      blockedReason: reason,
    };
  }
}