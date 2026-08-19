// Homepage intelligence service — combines the persisted historical backtest
// results with the live upcoming opportunities into the homepage payload.
// All numbers come from real database values or real computations over them.

import { BacktestRepository } from './backtest/repository';
import { OpportunitiesService, OpportunitiesResponse } from './opportunities/service';
import { supabase } from '@/lib/supabase.server';

export interface HomepageResponse {
  generatedAt: string;
  historical: {
    status: 'READY' | 'COMPLETE' | 'BLOCKED' | 'RUNNING';
    datasetVersion: string | null;
    modelVersion: string | null;
    methodology?: string;
    summary: {
      matches: number | null;
      bets: number | null;
      winRate: number | null;
      roi: number | null;
      clv: number | null;
      brierScore: number | null;
      logLoss: number | null;
      maxDrawdown: number | null;
    } | null;
    markets: {
      market: string;
      totalBets: number;
      winRate: number | null;
      roiPct: number | null;
      avgClvPct: number | null;
      brierScore: number | null;
    }[];
    blockedReason?: string;
  };
  live: OpportunitiesResponse;
}

export class HomepageService {
  static async getHomepageData(): Promise<HomepageResponse> {
    const [backtest, live] = await Promise.all([
      BacktestRepository.getLatestRun(),
      OpportunitiesService.getOpportunities(),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      historical: {
        status: backtest?.status ?? 'READY',
        datasetVersion: backtest?.datasetVersion ?? null,
        modelVersion: backtest?.modelVersion ?? null,
        methodology: backtest?.methodology ?? 'walk-forward-expanding-window',
        summary: backtest
          ? {
              matches: backtest.matchesTested,
              bets: backtest.totalBets,
              winRate: backtest.winRate,
              roi: backtest.roiPct,
              clv: backtest.avgClvPct,
              brierScore: backtest.brierScore,
              logLoss: backtest.logLoss,
              maxDrawdown: backtest.maxDrawdown,
            }
          : null,
        markets:
          backtest?.markets.map((m) => ({
            market: m.market,
            totalBets: m.totalBets,
            winRate: m.winRate,
            roiPct: m.roiPct,
            avgClvPct: m.avgClvPct,
            brierScore: m.brierScore,
          })) ?? [],
        blockedReason: backtest?.blockedReason,
      },
      live,
    };
  }

  static async getDiagnostics() {
    const { data: diag } = await supabase
      .from('pipeline_diagnostics')
      .select('stage, status, ran_at, duration_ms, details')
      .order('ran_at', { ascending: false })
      .limit(50);

    const { count: upcomingFixtures } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'upcoming');

    const { count: pendingPicks } = await supabase
      .from('daily_picks')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    return {
      pipeline: diag ?? [],
      upcomingFixtures,
      pendingPicks,
    };
  }
}